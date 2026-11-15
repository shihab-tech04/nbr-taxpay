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
  if (select count(*) from public.sim_payment_users where role_code is not null) <> 55 then
    raise exception 'Anonymous PostgREST client cannot read synthetic profile metadata';
  end if;
end;
$$;
rollback;


-- Fifty-five individual demo capability exchanges must work in disposable SQL;
-- none of these fictional identities may create a real Supabase Auth user.
do $test_55_profiles$
declare
 n integer;
 data jsonb;
 cap text;
 sid text;
 seen_caps text[] := '{}';
 seen_sessions text[] := '{}';
 before_auth bigint;
begin
 select count(*) into before_auth from auth.users;
 for n in 1..55 loop
   data := public.taxpay_demo_profile_login('user'||n,'user'||n);
   if data->>'profileId' is distinct from 'user'||n then
     raise exception 'Incorrect demo capability profile for user number %',n;
   end if;
   cap := data->>'capability';
   sid := data->>'paymentSessionId';
   if coalesce(cap,'') !~ '^[A-Za-z0-9_-]{43}$'
      or coalesce(sid,'') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
     raise exception 'Missing server-issued capability/session for profile number %',n;
   end if;
   if cap=any(seen_caps) or sid=any(seen_sessions) then
     raise exception 'Different preview profiles share a capability/session';
   end if;
   seen_caps := array_append(seen_caps,cap);
   seen_sessions := array_append(seen_sessions,sid);
 end loop;
 if (select count(*) from auth.users) <> before_auth then
   raise exception 'Synthetic login must never create real Auth accounts';
 end if;
 begin
   perform public.taxpay_demo_profile_login('user56','user56');
   raise exception 'Out-of-range fictional identity unexpectedly accepted';
 exception when others then
   if sqlerrm <> 'INVALID_DEMO_LOGIN' then raise; end if;
 end;
 begin
   perform public.taxpay_demo_profile_login('user55','incorrect');
   raise exception 'Incorrect fictional credentials unexpectedly accepted';
 exception when others then
   if sqlerrm <> 'INVALID_DEMO_LOGIN' then raise; end if;
 end;
end;
$test_55_profiles$;
