-- Move one guest-preview beneficiary between lists owned by the same capability.
-- No name/TIN edits, no deletions and no changes to account-owned/payment tables.
begin;
create function public.taxpay_guest_beneficiary_move(
  p_capability_hash text, p_beneficiary_id uuid,
  p_source_list_id uuid, p_target_list_id uuid
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, taxpay_guest_private as $$
declare
  v_session_id uuid;
  v_result jsonb;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  if p_source_list_id is null or p_target_list_id is null
     or p_source_list_id = p_target_list_id then
    raise exception 'INVALID_BENEFICIARY';
  end if;
  if not exists (
    select 1 from taxpay_guest_private.lists
    where id = p_target_list_id and session_id = v_session_id
  ) then
    raise exception 'NOT_FOUND';
  end if;
  begin
    update taxpay_guest_private.beneficiaries
       set list_id = p_target_list_id, updated_at = now()
     where id = p_beneficiary_id and list_id = p_source_list_id
       and session_id = v_session_id
     returning jsonb_build_object('id', id, 'list_id', list_id, 'tin', tin,
       'display_name', display_name, 'created_at', created_at,
       'updated_at', updated_at) into v_result;
  exception when unique_violation then
    raise exception 'BENEFICIARY_ALREADY_IN_LIST';
  end;
  if v_result is null then raise exception 'NOT_FOUND'; end if;
  return v_result;
end;
$$;
revoke all on function public.taxpay_guest_beneficiary_move(text,uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.taxpay_guest_beneficiary_move(text,uuid,uuid,uuid)
  to service_role;
comment on function public.taxpay_guest_beneficiary_move(text,uuid,uuid,uuid)
  is 'Capability-scoped atomic list transfer of one saved guest contact; TIN/name remain immutable.';
commit;
