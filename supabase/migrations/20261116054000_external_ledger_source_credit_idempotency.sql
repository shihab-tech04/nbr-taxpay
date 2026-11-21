-- Phase 5 simulation-safe source-credit idempotency reconciliation.
-- No historical payment, beneficiary, taxpayer, Auth, or Office row is altered.
-- Keep owner RLS, read-only client grants and official-credit evidence guards unchanged.
-- Preserve each original transaction allocation globally, regardless of owner claim.
create unique index if not exists taxpay_external_source_allocation_unique
  on public.taxpay_external_payment_records
  (source_system,source_transaction_id,source_allocation_id);

-- An issuer's credit reference may allocate across distinct original source lines,
-- but cannot be replayed against the *same* payment-record allocation.
create unique index if not exists taxpay_external_credit_allocation_ref_unique
  on public.taxpay_external_credit_postings
  (payment_record_id,official_credit_source,official_credit_reference);

-- Replace the earlier owner-dependent source and globally-scoped credit constraints
-- only after the stricter per-allocation indexes exist.
alter table public.taxpay_external_payment_records
  drop constraint if exists taxpay_external_payment_recor_owner_uid_source_system_sourc_key;
alter table public.taxpay_external_credit_postings
  drop constraint if exists taxpay_external_credit_postin_official_credit_source_offici_key;
