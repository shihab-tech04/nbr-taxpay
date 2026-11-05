-- 2026-11-05: Taxpayer-owned Beneficiaries are private address-book records.
-- Office/Admin sees only real payer/beneficiary relationships from payment events,
-- NEVER the taxpayer's list names, free-form tags, or saved contact records.
-- Historical migration 20261102045900 granted portal admins a read policy;
-- this forward-only migration revokes that exception without touching owner CRUD.
begin;
drop policy if exists beneficiary_lists_select_verified_portal_admin
  on public.taxpay_beneficiary_lists;
drop policy if exists beneficiaries_select_verified_portal_admin
  on public.taxpay_beneficiaries;

-- Preserve RLS and existing owner-scoped policies for the citizen account.
alter table public.taxpay_beneficiary_lists enable row level security;
alter table public.taxpay_beneficiaries enable row level security;

comment on table public.taxpay_beneficiary_lists is
  'Taxpayer-owned private saved beneficiary lists. Only the owner may read or manage; not an Office management feature, authorization, or financial identity.';
comment on table public.taxpay_beneficiaries is
  'Taxpayer-owned private saved TIN/name/tag address-book entries. Only the owner may read/manage; Officers/Admin must use linked payment records, not this private directory.';
commit;
