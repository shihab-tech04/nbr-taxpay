-- Read-only assertions against an isolated Supabase instance.
do $$
begin
  if (select count(*) from public.sim_payment_users where id in ('user1','user2','user3','user4','user5','user6')
      and name_en is not null and name_bn is not null
      and role_code is not null and tin_stub like 'DEMO-TIN-%') <> 6 then
    raise exception 'Expected all six returning taxpayer profiles';
  end if;
  if (select count(*) from public.sim_tax_service_records) <> 19 then
    raise exception 'Expected exactly 19 existing-user fictional service records';
  end if;
  if (select count(distinct user_id) from public.sim_tax_service_records) <> 6 then
    raise exception 'Only the six returning taxpayers may begin with service records';
  end if;
  if (select count(*) from public.sim_payment_users where id in ('user7','user8','user9','user10')
        and role_code = 'TAXPAYER_INDIVIDUAL'
        and name_en is null and name_bn is null
        and focus_en is null and focus_bn is null
        and tin_stub is null and jurisdiction_label is null) <> 4 then
    raise exception 'All four first-time user profiles must have zero optional profile fields';
  end if;
  if exists (select 1 from public.sim_tax_service_records
              where user_id in ('user7','user8','user9','user10'))
     or exists (select 1 from public.sim_payment_transactions
                where payer_id in ('user7','user8','user9','user10'))
     or exists (select 1 from public.sim_payment_allocations
                where beneficiary_id in ('user7','user8','user9','user10'))
     or exists (select 1 from public.sim_payment_notifications
                where user_id in ('user7','user8','user9','user10')) then
    raise exception 'A new account contains pre-existing simulated payment data';
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
  if (select count(*) from public.sim_tax_service_records) <> 19 then
    raise exception 'Anonymous PostgREST client cannot read fictional service records';
  end if;
  if (select count(*) from public.sim_payment_users where role_code is not null) <> 10 then
    raise exception 'Anonymous PostgREST client cannot read synthetic profile metadata';
  end if;
end;
$$;
rollback;
