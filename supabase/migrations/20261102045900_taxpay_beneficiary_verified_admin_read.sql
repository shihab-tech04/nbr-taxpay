-- One canonical address book: taxpayer UI and verified Office read the same
-- owner-scoped private tables. Admin may inspect but NEVER insert/update/delete.
-- Guest capability records remain distinct and cannot be assigned to user1.
begin;

create policy beneficiary_lists_select_verified_portal_admin
  on public.taxpay_beneficiary_lists for select to authenticated
  using (exists (
    select 1 from public.taxpay_portal_admins administrator
    where administrator.user_uid = (select auth.uid())
      and administrator.active = true
      and administrator.verified_at <= now()
  ));

create policy beneficiaries_select_verified_portal_admin
  on public.taxpay_beneficiaries for select to authenticated
  using (exists (
    select 1 from public.taxpay_portal_admins administrator
    where administrator.user_uid = (select auth.uid())
      and administrator.active = true
      and administrator.verified_at <= now()
  ));

comment on table public.taxpay_beneficiaries is
  'Owner-scoped saved TIN/name for payment prefill; verified portal admins have READ ONLY access under RLS; no delegation, taxpayer verification or financial entitlement.';
commit;
