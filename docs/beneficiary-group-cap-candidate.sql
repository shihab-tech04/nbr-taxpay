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
commit;
-- Required before promotion: authenticated owner RLS count visibility, two independent
-- concurrent fifth/sixth creates, direct permitted SQL, legacy >5, existing-name guest
-- retry at capacity, owner isolation, bulk, same-owner rename, delete/create, and restore.
-- Group transfer/delete and database reconciliation are separate pending work.
