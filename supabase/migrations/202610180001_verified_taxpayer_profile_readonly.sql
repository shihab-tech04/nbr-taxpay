-- Verified taxpayer identity must be provisioned through a trusted server-side
-- verification process. A signed-in application account does NOT itself prove
-- ownership of an NBR e-TIN. No self-service INSERT/UPDATE/DELETE is permitted.
create table if not exists public.taxpay_verified_taxpayer_profiles (
  owner_uid uuid primary key references auth.users(id) on delete cascade,
  tin text not null check (tin ~ '^[0-9]{12}$'),
  name_en text not null check (length(trim(name_en)) > 0),
  name_bn text,
  receipt_mobile text check (receipt_mobile is null or receipt_mobile ~ '^01[0-9]{9}$'),
  tax_zone text,
  tax_circle text,
  verified_at timestamptz not null,
  verification_reference text not null check (length(trim(verification_reference)) > 0)
);

comment on table public.taxpay_verified_taxpayer_profiles is
  'Server-provisioned e-TIN identity after independent taxpayer-ownership verification; never derived from Auth metadata or public simulations.';

alter table public.taxpay_verified_taxpayer_profiles enable row level security;
revoke all on public.taxpay_verified_taxpayer_profiles from public, anon, authenticated;
-- Backend-only provisioning remains explicit even on projects with revoked
-- default table privileges; never expose this role key to the browser.
grant select, insert, update, delete on public.taxpay_verified_taxpayer_profiles to service_role;
grant select (owner_uid, tin, name_en, name_bn, receipt_mobile, tax_zone, tax_circle)
  on public.taxpay_verified_taxpayer_profiles to authenticated;
create policy taxpay_verified_taxpayer_profiles_owner_read
  on public.taxpay_verified_taxpayer_profiles for select to authenticated
  using (owner_uid = (select auth.uid()));
