begin;

do $$
declare
  v_a constant text := repeat('a', 64);
  v_b constant text := repeat('b', 64);
  v_list_a uuid;
  v_list_b uuid;
  v_person_a uuid;
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
  v_person_a := (v_data->0->>'id')::uuid;
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
  if jsonb_array_length(public.taxpay_guest_beneficiary_rows(v_a, 0, 500)) <> 2 then
    raise exception 'Cross-session delete changed Guest A rows';
  end if;
  perform public.taxpay_guest_beneficiary_update(v_a, v_person_a, 'Renamed synthetic guest');
  if public.taxpay_guest_beneficiary_remove(v_a, v_person_a)->>'deleted' <> 'true' then
    raise exception 'Owner delete did not complete';
  end if;
  if jsonb_array_length(public.taxpay_guest_beneficiary_rows(v_a, 0, 500)) <> 1 then
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

\echo 'PASS: guest capabilities persist and isolate beneficiary CRUD; account-owned RLS and service-role-only RPC boundary remain intact'
