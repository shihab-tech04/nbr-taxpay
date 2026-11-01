begin;

do $$
declare
  v_a constant text := repeat('a', 64);
  v_b constant text := repeat('b', 64);
  v_list_a uuid;
  v_list_b uuid;
  v_list_a_target uuid;
  v_person_a uuid;
  v_person_b uuid;
  v_original_name text;
  v_move jsonb;
  v_data jsonb;
begin
  perform public.taxpay_guest_beneficiary_open(v_a);
  perform public.taxpay_guest_beneficiary_open(v_a);
  perform public.taxpay_guest_beneficiary_open(v_b);

  v_list_a := (public.taxpay_guest_beneficiary_create_list(v_a, 'Family')->>'id')::uuid;
  v_list_b := (public.taxpay_guest_beneficiary_create_list(v_b, 'Family')->>'id')::uuid;
  if v_list_a = v_list_b then raise exception 'Guest sessions shared a beneficiary list'; end if;

  if public.taxpay_guest_beneficiary_add(v_a, v_list_a,
    '[{"tin":"012345678901","display_name":"Synthetic Guest A"},
      {"tin":"012345678901","display_name":"Duplicate retry"},
      {"tin":"987654321098","display_name":"Synthetic Guest A2"}]'::jsonb) <> 2 then
    raise exception 'Guest insert must ignore duplicate TIN rows';
  end if;
  if public.taxpay_guest_beneficiary_add(v_a, v_list_a,
    '[{"tin":"012345678901","display_name":"Retry after lost response"}]'::jsonb) <> 0 then
    raise exception 'Guest add retry must be idempotent';
  end if;
  v_data := public.taxpay_guest_beneficiary_rows(v_a, 0, 500);
  if jsonb_array_length(v_data) <> 2 then raise exception 'Guest owner cannot read their rows'; end if;
  select (item.value->>'id')::uuid, item.value->>'display_name'
    into v_person_a, v_original_name
  from jsonb_array_elements(v_data) as item(value)
  where item.value->>'tin' = '012345678901';
  select (item.value->>'id')::uuid
    into v_person_b
  from jsonb_array_elements(v_data) as item(value)
  where item.value->>'tin' = '987654321098';
  if v_person_a is null or v_person_b is null then
    raise exception 'Guest owner row lookup by TIN failed';
  end if;

  v_list_a_target := (public.taxpay_guest_beneficiary_create_list(v_a, 'Clients')->>'id')::uuid;
  if public.taxpay_guest_beneficiary_add(v_a, v_list_a_target,
    '[{"tin":"012345678901","display_name":"Target duplicate"}]'::jsonb) <> 1 then
    raise exception 'Guest target list duplicate fixture was not added';
  end if;
  begin
    perform public.taxpay_guest_beneficiary_move(v_a, v_person_a, v_list_a, v_list_a_target);
    raise exception 'Duplicate guest beneficiary move unexpectedly succeeded';
  exception when others then
    if sqlerrm not like '%BENEFICIARY_ALREADY_IN_LIST%' then raise; end if;
  end;
  v_data := public.taxpay_guest_beneficiary_rows(v_a, 0, 500);
  if not exists (
    select 1 from jsonb_array_elements(v_data) as item(value)
    where item.value->>'id' = v_person_a::text
      and item.value->>'list_id' = v_list_a::text
      and item.value->>'display_name' = v_original_name
  ) then
    raise exception 'Duplicate guest move changed or removed the source beneficiary';
  end if;

  v_move := public.taxpay_guest_beneficiary_move(v_a, v_person_b, v_list_a, v_list_a_target);
  if v_move->>'id' is distinct from v_person_b::text
     or v_move->>'list_id' is distinct from v_list_a_target::text
     or v_move->>'tin' is distinct from '987654321098'
     or v_move->>'display_name' is distinct from 'Synthetic Guest A2' then
    raise exception 'Successful guest move changed the beneficiary identity or target';
  end if;
  begin
    perform public.taxpay_guest_beneficiary_move(v_b, v_person_b, v_list_a, v_list_b);
    raise exception 'Guest B moved Guest A beneficiary';
  exception when others then
    if sqlerrm not like '%NOT_FOUND%' then raise; end if;
  end;
  begin
    perform public.taxpay_guest_beneficiary_move(v_a, v_person_a, v_list_a, v_list_a);
    raise exception 'Guest beneficiary moved to its existing list';
  exception when others then
    if sqlerrm not like '%INVALID_BENEFICIARY%' then raise; end if;
  end;
  if jsonb_array_length(public.taxpay_guest_beneficiary_rows(v_b, 0, 500)) <> 0 then
    raise exception 'Guest B read Guest A beneficiary data';
  end if;
  if jsonb_array_length(public.taxpay_guest_beneficiary_lists(v_b)) <> 1 then
    raise exception 'Guest B list read returned wrong result count';
  end if;
  if (public.taxpay_guest_beneficiary_lists(v_b)->0->>'id')::uuid <> v_list_b then
    raise exception 'Guest B list read exposed Guest A list';
  end if;

  begin
    perform public.taxpay_guest_beneficiary_add(v_b, v_list_a,
      '[{"tin":"555555555555","display_name":"Cross-session attempt"}]'::jsonb);
    raise exception 'Guest B wrote into Guest A list';
  exception when others then
    if sqlerrm not like '%NOT_FOUND%' then raise; end if;
  end;
  begin
    perform public.taxpay_guest_beneficiary_update(v_b, v_person_a, 'Cross-session edit');
    raise exception 'Guest B edited Guest A beneficiary';
  exception when others then
    if sqlerrm not like '%NOT_FOUND%' then raise; end if;
  end;
  if public.taxpay_guest_beneficiary_remove(v_b, v_person_a)->>'deleted' <> 'true' then
    raise exception 'Cross-session delete should be a harmless no-op';
  end if;
  if jsonb_array_length(public.taxpay_guest_beneficiary_rows(v_a, 0, 500)) <> 3 then
    raise exception 'Cross-session delete changed Guest A rows';
  end if;
  perform public.taxpay_guest_beneficiary_update(v_a, v_person_a, 'Renamed synthetic guest');
  if public.taxpay_guest_beneficiary_remove(v_a, v_person_a)->>'deleted' <> 'true' then
    raise exception 'Owner delete did not complete';
  end if;
  if jsonb_array_length(public.taxpay_guest_beneficiary_rows(v_a, 0, 500)) <> 2 then
    raise exception 'Owner delete did not remove exactly one beneficiary';
  end if;

  if has_schema_privilege('anon', 'taxpay_guest_private', 'USAGE') or
     has_schema_privilege('authenticated', 'taxpay_guest_private', 'USAGE') or
     has_schema_privilege('service_role', 'taxpay_guest_private', 'USAGE') then
    raise exception 'Private guest schema must not be directly reachable by API roles';
  end if;
  if has_table_privilege('anon', 'taxpay_guest_private.beneficiaries', 'SELECT') or
     has_table_privilege('authenticated', 'taxpay_guest_private.beneficiaries', 'SELECT') or
     has_table_privilege('service_role', 'taxpay_guest_private.beneficiaries', 'SELECT') then
    raise exception 'Guest tables must be reachable only through scoped RPCs';
  end if;
  if has_function_privilege('anon', 'public.taxpay_guest_beneficiary_lists(text)', 'EXECUTE') or
     has_function_privilege('authenticated', 'public.taxpay_guest_beneficiary_lists(text)', 'EXECUTE') or
     not has_function_privilege('service_role', 'public.taxpay_guest_beneficiary_lists(text)', 'EXECUTE') then
    raise exception 'Only service_role may execute guest beneficiary RPCs';
  end if;
  if has_function_privilege('anon', 'public.taxpay_guest_beneficiary_move(text,uuid,uuid,uuid)', 'EXECUTE') or
     has_function_privilege('authenticated', 'public.taxpay_guest_beneficiary_move(text,uuid,uuid,uuid)', 'EXECUTE') or
     not has_function_privilege('service_role', 'public.taxpay_guest_beneficiary_move(text,uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'Only service_role may execute the guest beneficiary move RPC';
  end if;
  if has_table_privilege('anon', 'public.taxpay_beneficiary_lists', 'SELECT') or
     has_table_privilege('anon', 'public.taxpay_beneficiaries', 'SELECT') or
     (select count(*) from pg_policies where schemaname = 'public'
       and tablename in ('taxpay_beneficiary_lists', 'taxpay_beneficiaries')) <> 8 then
    raise exception 'Existing account-owned beneficiary RLS contract changed';
  end if;
end;
$$;

set local role service_role;
select public.taxpay_guest_beneficiary_open(repeat('c', 64));
select public.taxpay_guest_beneficiary_lists(repeat('c', 64));
reset role;

rollback;

\echo 'PASS: guest capabilities persist and isolate beneficiary CRUD and atomic list moves; account-owned RLS and service-role-only RPC boundary remain intact'
