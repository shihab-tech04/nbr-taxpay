-- REVIEW CANDIDATE ONLY. Not a production migration.
-- Promote through the normal Supabase migration workflow after isolated tests.
-- Applies only to group creation/owner reassignment, not contacts or payments.
-- Existing excess groups remain readable; no rows are removed by this script.
begin;
create or replace function taxpay_guest_private.enforce_account_beneficiary_group_cap()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' then
    if new.owner_uid = old.owner_uid then return new; end if;
  end if;
  -- Count must obtain a fresh snapshot after the owner-scoped lock.
  -- Fail closed for stricter transaction isolation rather than risk stale counts.
  if current_setting('transaction_isolation') not in ('read committed','read uncommitted') then
    raise exception 'BENEFICIARY_GROUP_LIMIT_RETRY' using errcode = '40001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('taxpay-account-group:' || new.owner_uid::text,0));
  if (select count(*) from public.taxpay_beneficiary_lists where owner_uid = new.owner_uid) >= 5 then
    raise exception 'BENEFICIARY_GROUP_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create or replace function taxpay_guest_private.enforce_guest_beneficiary_group_cap()
returns trigger language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' then
    if new.session_id = old.session_id then return new; end if;
  end if;
  if current_setting('transaction_isolation') not in ('read committed','read uncommitted') then
    raise exception 'BENEFICIARY_GROUP_LIMIT_RETRY' using errcode = '40001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('taxpay-guest-group:' || new.session_id::text,0));
  if (select count(*) from taxpay_guest_private.lists where session_id = new.session_id) >= 5 then
    raise exception 'BENEFICIARY_GROUP_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function taxpay_guest_private.enforce_account_beneficiary_group_cap() from public, anon, authenticated;
revoke execute on function taxpay_guest_private.enforce_guest_beneficiary_group_cap() from public, anon, authenticated;
drop trigger if exists enforce_beneficiary_group_cap on public.taxpay_beneficiary_lists;
create trigger enforce_beneficiary_group_cap before insert or update of owner_uid on public.taxpay_beneficiary_lists
for each row execute function taxpay_guest_private.enforce_account_beneficiary_group_cap();
drop trigger if exists enforce_beneficiary_group_cap on taxpay_guest_private.lists;
create trigger enforce_beneficiary_group_cap before insert or update of session_id on taxpay_guest_private.lists
for each row execute function taxpay_guest_private.enforce_guest_beneficiary_group_cap();

-- Guard direct authenticated list deletion; keep existing administrative owner
-- lifecycle cascades untouched. The row lock precedes this trigger.
create or replace function taxpay_guest_private.guard_account_group_delete()
returns trigger language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if current_user in ('authenticated','anon') and exists (
    select 1 from public.taxpay_beneficiaries
    where owner_uid=old.owner_uid and list_id=old.id
  ) then
    raise exception 'BENEFICIARY_GROUP_NOT_EMPTY' using errcode='P0001';
  end if;
  return old;
end;
$$;
revoke execute on function taxpay_guest_private.guard_account_group_delete() from public, anon, authenticated;
drop trigger if exists guard_account_group_delete on public.taxpay_beneficiary_lists;
create trigger guard_account_group_delete before delete on public.taxpay_beneficiary_lists
for each row execute function taxpay_guest_private.guard_account_group_delete();

-- Real account: use the authenticated identity, not a client supplied owner.
create or replace function public.taxpay_transfer_beneficiary_group(p_source_id uuid,p_target_id uuid)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
declare v_owner uuid:=auth.uid(); v_locked integer; v_count integer;
begin
  if v_owner is null or p_source_id is null or p_target_id is null or p_source_id=p_target_id then
    raise exception 'NOT_FOUND';
  end if;
  perform 1 from public.taxpay_beneficiary_lists
    where owner_uid=v_owner and id in (p_source_id,p_target_id) order by id for update;
  get diagnostics v_locked=row_count;
  if v_locked<>2 then raise exception 'NOT_FOUND'; end if;
  begin
    update public.taxpay_beneficiaries set list_id=p_target_id
      where owner_uid=v_owner and list_id=p_source_id;
    get diagnostics v_count=row_count;
  exception when unique_violation then raise exception 'BENEFICIARY_ALREADY_IN_LIST';
  end;
  delete from public.taxpay_beneficiary_lists where id=p_source_id and owner_uid=v_owner;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('deleted',true,'moved',v_count);
end;
$$;
revoke execute on function public.taxpay_transfer_beneficiary_group(uuid,uuid) from public, anon, service_role;
grant execute on function public.taxpay_transfer_beneficiary_group(uuid,uuid) to authenticated;

-- Preserve the existing service-only, capability-bound gateway contract.
-- Existing callers may delete empty lists, never their saved people.
create or replace function public.taxpay_guest_beneficiary_delete_list(p_capability_hash text,p_list_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog,taxpay_guest_private
as $$
declare v_session_id uuid;
begin
  v_session_id:=taxpay_guest_private.touch_session(p_capability_hash);
  perform 1 from taxpay_guest_private.lists where id=p_list_id and session_id=v_session_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from taxpay_guest_private.beneficiaries where list_id=p_list_id and session_id=v_session_id) then
    raise exception 'BENEFICIARY_GROUP_NOT_EMPTY';
  end if;
  delete from taxpay_guest_private.lists where id=p_list_id and session_id=v_session_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('deleted',true);
end;
$$;

-- Same service-only capability gate as the existing guest move/delete RPCs.
create or replace function public.taxpay_guest_beneficiary_transfer_group(p_capability_hash text,p_source_id uuid,p_target_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog,taxpay_guest_private
as $$
declare v_session_id uuid; v_locked integer; v_count integer;
begin
  v_session_id:=taxpay_guest_private.touch_session(p_capability_hash);
  if p_source_id is null or p_target_id is null or p_source_id=p_target_id then raise exception 'NOT_FOUND'; end if;
  perform 1 from taxpay_guest_private.lists
    where session_id=v_session_id and id in (p_source_id,p_target_id) order by id for update;
  get diagnostics v_locked=row_count;
  if v_locked<>2 then raise exception 'NOT_FOUND'; end if;
  begin
    update taxpay_guest_private.beneficiaries set list_id=p_target_id
      where session_id=v_session_id and list_id=p_source_id;
    get diagnostics v_count=row_count;
  exception when unique_violation then raise exception 'BENEFICIARY_ALREADY_IN_LIST';
  end;
  delete from taxpay_guest_private.lists where id=p_source_id and session_id=v_session_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('deleted',true,'moved',v_count);
end;
$$;
revoke execute on function public.taxpay_guest_beneficiary_transfer_group(text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.taxpay_guest_beneficiary_transfer_group(text,uuid,uuid) to service_role;

commit;
-- Required before promotion: authenticated owner RLS count visibility, two independent
-- concurrent fifth/sixth creates, direct permitted SQL, legacy >5, existing-name guest
-- retry at capacity, owner isolation, bulk, same-owner rename, delete/create, and restore.
-- Test transfer, duplicate collision rollback, unauthorized target and nonempty delete before promotion.
-- Existing hosted rows remain unchanged; database reconciliation is separate pending work.
