-- TaxPay fictional 30-account profile registry. Does NOT create verified taxpayers or tax credits.
alter table public.sim_payment_users drop constraint sim_payment_users_id_check;
alter table public.sim_payment_users add constraint sim_payment_users_id_check check(id ~ '^user([1-9]|[12][0-9]|30)$');
alter table taxpay_guest_private.demo_profiles drop constraint demo_profiles_demo_id_check;
alter table taxpay_guest_private.demo_profiles add constraint demo_profiles_demo_id_check check(demo_id ~ '^user([1-9]|[12][0-9]|30)$');
insert into public.sim_payment_users(id,role_code,name_en,name_bn,focus_en,focus_bn,tin_stub,jurisdiction_label)
select 'user'||n,
 case when mod(n,7)=0 then 'WITHHOLDING_AGENT' when mod(n,5)=0 then 'TAXPAYER_CORPORATE' else 'TAXPAYER_INDIVIDUAL' end,
 'Taxpayer Account '||n,'করদাতা অ্যাকাউন্ট '||n,
 case mod(n,4) when 0 then 'Mixed-year payments' when 1 then 'Travel tax combinations' when 2 then 'Multiple-beneficiary payments' else 'Income tax heads' end,
 'বিভিন্ন কর পরিশোধের বিবরণ','DEMO-TIN-'||lpad(n::text,3,'0'),'circle-'||n
from generate_series(11,30) n on conflict(id) do nothing;
-- Private capability and session defaults independently generate unpredictable values.
insert into taxpay_guest_private.demo_profiles(demo_id)
select 'user'||n from generate_series(11,30) n on conflict(demo_id) do nothing;
do $mig$
declare f record;original text;revised text;checked integer:=0;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where p.prokind='f' and ns.nspname in ('public','demo_payment')
  and p.proname in ('validate_demo_authorized_payment','demo_auth_list','demo_auth_transition',
   'demo_story1_demo_history','demo_story1_demo_history_page','taxpay_demo_profile_login')
 loop
   original:=pg_get_functiondef(f.oid);
   revised:=replace(replace(original,'^user(10|[1-9])$','^user([1-9]|[12][0-9]|30)$'),
     '^user([1-9]|10)$','^user([1-9]|[12][0-9]|30)$');
   if revised=original and original not like '%^user([1-9]|[12][0-9]|30)$%'
     then raise exception 'Unexpected guard in %',f.proname; end if;
   if revised<>original then execute revised; end if;
   checked:=checked+1;
 end loop;
 if checked<>6 then raise exception 'Expected six guarded functions, found %',checked; end if;
 if (select count(*) from public.sim_payment_users where id ~ '^user([1-9]|[12][0-9]|30)$')<>30
    or (select count(*) from taxpay_guest_private.demo_profiles where demo_id ~ '^user([1-9]|[12][0-9]|30)$')<>30
   then raise exception 'Preview profile creation incomplete'; end if;
end;
$mig$;
