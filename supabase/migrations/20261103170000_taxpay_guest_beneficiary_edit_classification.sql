-- Add an atomic, capability-scoped edit for saved beneficiary classification.
-- The existing lists, guest move and name-edit RPCs are intentionally unchanged.
-- Editing a tag is a self-declaration, not proof of kinship/permission.
begin;

create or replace function public.taxpay_guest_beneficiary_edit_classification(
  p_capability_hash text,
  p_beneficiary_id uuid,
  p_source_list_id uuid,
  p_target_list_id uuid,
  p_tag text,
  p_relationship text,
  p_other_label text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, taxpay_guest_private
as $fn$
declare
  v_session_id uuid;
  v_result jsonb;
begin
  v_session_id := taxpay_guest_private.touch_session(p_capability_hash);
  if p_source_list_id is null or p_target_list_id is null or
    not (
      (p_tag = 'clients' and p_relationship is null and p_other_label is null) or
      (p_tag = 'friends_family' and p_relationship in
        ('father','mother','siblings','son','daughter','spouse','friends')
        and p_other_label is null) or
      (p_tag = 'others' and p_relationship is null and p_other_label is not null
        and length(p_other_label) between 1 and 80 and p_other_label = btrim(p_other_label))
    ) then
    raise exception 'INVALID_BENEFICIARY';
  end if;
  if not exists (
    select 1 from taxpay_guest_private.lists
    where id = p_target_list_id and session_id = v_session_id
  ) then raise exception 'NOT_FOUND'; end if;

  begin
    update taxpay_guest_private.beneficiaries
      set list_id = p_target_list_id, tag = p_tag, relationship = p_relationship,
          other_label = p_other_label, updated_at = now()
      where id = p_beneficiary_id and session_id = v_session_id
        and list_id = p_source_list_id
      returning jsonb_build_object(
        'id',id,'list_id',list_id,'tin',tin,'display_name',display_name,
        'tag',tag,'relationship',relationship,'other_label',other_label,
        'created_at',created_at,'updated_at',updated_at
      ) into v_result;
  exception when unique_violation then
    raise exception 'BENEFICIARY_ALREADY_IN_LIST';
  end;
  if v_result is null then raise exception 'NOT_FOUND'; end if;
  return v_result;
end;
$fn$;

revoke all on function public.taxpay_guest_beneficiary_edit_classification(
  text,uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.taxpay_guest_beneficiary_edit_classification(
  text,uuid,uuid,uuid,text,text,text) to service_role;

commit;
