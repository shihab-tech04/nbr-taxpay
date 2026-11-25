-- Canonical taxpayer registration record. Existing payment, beneficiary and Office databases untouched.
-- The same row is read by the taxpayer and through Office-authenticated read-only gateway.
begin;
create table if not exists public.taxpay_taxpayer_registration_profiles (
 account_id text primary key,
 tin text not null unique check (tin ~ '^[0-9]{12}$'),
 profile jsonb not null check (jsonb_typeof(profile) = 'object'),
 revision integer not null default 1 check (revision >= 1),
 updated_at timestamptz not null default now(),
 constraint taxpay_registration_account_check check (length(account_id) between 1 and 100),
 constraint taxpay_registration_tin_consistent check (profile ->> 'tin' = tin),
 constraint taxpay_registration_fields_present check (profile ?& array['source','sourceUpdatedAt','tin','taxpayerName','taxpayerStatus','tinType','tinSubtype','registeredOn','userType','localTaxpayer','previousTin','taxesCircle','taxesZone','taxesRange','district','country','registeredAddress','currentAddress','mobileNumber','emailAddress','certificateIssuedOn','certificateLastUpdatedOn','issuingOfficer','taxOfficeAddress','taxOfficePhone','lastLoginAt'])
);
alter table public.taxpay_taxpayer_registration_profiles enable row level security;
alter table public.taxpay_taxpayer_registration_profiles force row level security;
revoke all on public.taxpay_taxpayer_registration_profiles from public, anon, authenticated;
grant select on public.taxpay_taxpayer_registration_profiles to authenticated;
drop policy if exists taxpay_registration_owner_read on public.taxpay_taxpayer_registration_profiles;
create policy taxpay_registration_owner_read on public.taxpay_taxpayer_registration_profiles for select to authenticated
  using (exists (
   select 1 from public.sim_payment_account_bindings b
    where b.user_id = account_id and b.owner_uid = (select auth.uid())
  ) or exists (
   select 1 from public.taxpay_portal_admins a
    where a.user_uid=(select auth.uid()) and a.active=true and a.verified_at<=now()
  ));
-- Strict user1 reference seed only. Future users get the SAME required fields once
-- supplied and authorized: never synthesize names, TINs or owner mappings.
insert into public.taxpay_taxpayer_registration_profiles (account_id,tin,profile)
values ('user1','577935451798','{"source":"REVIEWED_CERTIFICATE","sourceUpdatedAt":"2026-06-04T17:06:20+06:00","tin":"577935451798","taxpayerName":"Md. Arif Rahman","taxpayerStatus":"Individual","tinType":"Individual","tinSubtype":"Bangladeshi → Minor/Dependent","registeredOn":"19 Jan 2026","userType":"Public","localTaxpayer":"Yes","previousTin":"Not Applicable","taxesCircle":"Circle-245 (Company)","taxesZone":"Taxes Zone-12, Dhaka","taxesRange":"Range-1","district":"Dhaka","country":"Bangladesh","registeredAddress":"Dhaka, 1122, Dhaka, Bangladesh","currentAddress":"Dhaka, 1122, Dhaka, Bangladesh","mobileNumber":"+8801857648765","emailAddress":"email@test.com","certificateIssuedOn":"19 Jan 2026","certificateLastUpdatedOn":"04 Jun 2026, 05:06:20 PM","issuingOfficer":"Deputy Commissioner of Taxes","taxOfficeAddress":"3/4 Purana Paltan, Modina Tower (6th Floor), Dhaka","taxOfficePhone":"02-9588253","lastLoginAt":"11 Nov 2026, 11:23:40 AM"}'::jsonb)
on conflict (account_id) do nothing;

-- The approved Edge service-role reader uses the existing demo-login capability check.
-- No additional SECURITY DEFINER entry point is introduced.
grant select on public.taxpay_taxpayer_registration_profiles to service_role;

commit;