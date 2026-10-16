-- Read-only assertions against an isolated Supabase instance.
do $$
begin
  if (select count(*) from public.sim_payment_users where name_en is not null and name_bn is not null
      and role_code is not null and tin_stub like 'DEMO-TIN-%') <> 10 then
    raise exception 'Expected all ten independently populated SQL demo profiles';
  end if;
  if (select count(*) from public.sim_tax_service_records) <> 31 then
    raise exception 'Expected exactly 31 initial fictional service records';
  end if;
  if (select count(distinct user_id) from public.sim_tax_service_records) <> 10 then
    raise exception 'A taxpayer preview account has no service records';
  end if;
  if (select count(distinct service_code) from public.sim_tax_service_records) <> 8 then
    raise exception 'One of the eight tax services is missing';
  end if;
  if (select count(*) from public.sim_tax_service_records where not simulation_only) > 0 then
    raise exception 'Real payments must never enter the public sample table';
  end if;
  if (select count(*) from public.sim_tax_service_records where service_code = 'TRAVEL_TAX'
      and assessment_year is not null) > 0 then
    raise exception 'Travel tax is independent from assessment-year income tax';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.sim_tax_service_records'::regclass) then
    raise exception 'The fictional service table must use RLS';
  end if;
  if not has_table_privilege('anon','public.sim_tax_service_records','SELECT')
      or has_table_privilege('anon','public.sim_tax_service_records','INSERT')
      or has_table_privilege('anon','public.sim_tax_service_records','UPDATE')
      or has_table_privilege('anon','public.sim_tax_service_records','DELETE') then
    raise exception 'Anonymous access must remain strictly read-only';
  end if;
  if not has_table_privilege('authenticated','public.sim_tax_service_records','SELECT')
      or has_table_privilege('authenticated','public.sim_tax_service_records','INSERT')
      or has_table_privilege('authenticated','public.sim_tax_service_records','UPDATE')
      or has_table_privilege('authenticated','public.sim_tax_service_records','DELETE') then
    raise exception 'Signed-in clients must not modify the public simulation records';
  end if;
end;
$$;

begin;
set local role anon;
do $$
begin
  if (select count(*) from public.sim_tax_service_records) <> 31 then
    raise exception 'Anonymous PostgREST client cannot read fictional service records';
  end if;
  if (select count(*) from public.sim_payment_users where role_code is not null) <> 10 then
    raise exception 'Anonymous PostgREST client cannot read synthetic profile metadata';
  end if;
end;
$$;
rollback;
