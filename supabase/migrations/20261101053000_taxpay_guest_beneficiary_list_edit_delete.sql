-- Add only guest saved-list rename/delete. Existing private-session capabilities,
-- member RLS, account-owned data and payment records remain unchanged.
begin;

create function public.taxpay_guest_beneficiary_rename_list(
  p_capability_hash text, p_list_id uuid, p_name text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, taxpay_guest_private as $$
declare
  v_session_id uuid;
  v_result jsonb;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  if p_name is null or length(btrim(p_name)) not between 1 and 80 then
    raise exception 'INVALID_LIST_NAME';
  end if;
  update taxpay_guest_private.lists
     set name = btrim(p_name)
   where id = p_list_id and session_id = v_session_id
   returning jsonb_build_object('id', id, 'name', name) into v_result;
  if v_result is null then raise exception 'NOT_FOUND'; end if;
  return v_result;
end;
$$;

create function public.taxpay_guest_beneficiary_delete_list(
  p_capability_hash text, p_list_id uuid
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, taxpay_guest_private as $$
declare
  v_session_id uuid;
  v_deleted_id uuid;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  delete from taxpay_guest_private.lists
   where id = p_list_id and session_id = v_session_id
   returning id into v_deleted_id;
  if v_deleted_id is null then raise exception 'NOT_FOUND'; end if;
  -- Guest list's existing FK ON DELETE CASCADE removes its saved contacts only.
  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.taxpay_guest_beneficiary_rename_list(text,uuid,text) from public, anon, authenticated;
revoke all on function public.taxpay_guest_beneficiary_delete_list(text,uuid) from public, anon, authenticated;
grant execute on function public.taxpay_guest_beneficiary_rename_list(text,uuid,text) to service_role;
grant execute on function public.taxpay_guest_beneficiary_delete_list(text,uuid) to service_role;
commit;
