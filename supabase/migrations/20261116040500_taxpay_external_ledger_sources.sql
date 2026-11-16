-- Phase 5. Controlled external payment evidence, separate from official tax-credit postings.
-- No external data is invented or imported by this migration.
-- WS3/WS5 must review and apply this to the authorized Taxpayer database in release order.
begin;

create table public.taxpay_external_payment_records (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete restrict,
  source_system text not null check (source_system in (
    'BRTA','E_TDS','IBAS_PLUS_PLUS','NSD','SUB_REGISTRAR_OFFICE','BANK','SA_CODER'
  )),
  source_transaction_id text not null check (length(btrim(source_transaction_id)) between 1 and 160),
  source_allocation_id text not null check (length(btrim(source_allocation_id)) between 1 and 160),
  taxpayer_tin text not null check (taxpayer_tin ~ '^[0-9]{12,13}$'),
  payer_tin text check (payer_tin is null or payer_tin ~ '^[0-9]{12,13}$'),
  identity_binding_evidence_ref text not null check (length(btrim(identity_binding_evidence_ref)) between 1 and 240),
  source_reference text check (source_reference is null or length(btrim(source_reference)) between 1 and 160),
  challan_no text check (challan_no is null or length(btrim(challan_no)) between 1 and 160),
  dhara text check (dhara is null or length(btrim(dhara)) between 1 and 120),
  assessment_year text not null check (assessment_year ~ '^20[0-9]{2}-([0-9]{2}|20[0-9]{2})$'),
  tax_head text not null check (length(btrim(tax_head)) between 1 and 160),
  amount_minor bigint not null check (amount_minor > 0),
  source_status text not null check (length(btrim(source_status)) between 1 and 80),
  occurred_at timestamptz not null,
  source_evidence_ref text not null check (length(btrim(source_evidence_ref)) between 1 and 240),
  ingested_at timestamptz not null default now(),
  unique (owner_uid,source_system,source_transaction_id,source_allocation_id)
);
comment on table public.taxpay_external_payment_records is
  'Owner-bound externally sourced transaction evidence; a recorded payment is never proof of tax credit. Trusted server import only; identity matching must be independently verified.';
create index taxpay_external_records_owner_time
  on public.taxpay_external_payment_records(owner_uid,occurred_at desc,id desc);

create table public.taxpay_external_credit_postings (
  id uuid primary key default gen_random_uuid(),
  payment_record_id uuid not null references public.taxpay_external_payment_records(id) on delete restrict,
  owner_uid uuid not null references auth.users(id) on delete restrict,
  official_credit_reference text not null check (length(btrim(official_credit_reference)) between 1 and 160),
  official_credit_source text not null check (length(btrim(official_credit_source)) between 1 and 160),
  credited_amount_minor bigint not null check (credited_amount_minor > 0),
  credited_at timestamptz not null,
  verification_evidence_ref text not null check (length(btrim(verification_evidence_ref)) between 1 and 240),
  ingested_at timestamptz not null default now(),
  unique (official_credit_source,official_credit_reference)
);
comment on table public.taxpay_external_credit_postings is
  'Separate official tax-credit postings, requiring independent source and evidence. A payment status, challan or receipt cannot create a posting.';
create index taxpay_external_credits_owner_payment
  on public.taxpay_external_credit_postings(owner_uid,payment_record_id,credited_at desc);

-- Serialize concurrent credit posting imports and prevent owner mismatch or overcredit.
create function public.taxpay_external_credit_validate() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare original_owner uuid;
declare original_minor bigint;
declare existing_minor numeric;
begin
  select owner_uid,amount_minor into original_owner,original_minor
    from public.taxpay_external_payment_records
    where id=new.payment_record_id for update;
  if original_owner is null or original_owner is distinct from new.owner_uid then
    raise exception 'External credit owner/payment mismatch';
  end if;
  select coalesce(sum(credited_amount_minor),0) into existing_minor
    from public.taxpay_external_credit_postings
    where payment_record_id=new.payment_record_id;
  if existing_minor+new.credited_amount_minor>original_minor then
    raise exception 'External credit exceeds recorded source amount';
  end if;
  return new;
end;
$$;
create trigger taxpay_external_credit_insert_guard
  before insert on public.taxpay_external_credit_postings
  for each row execute function public.taxpay_external_credit_validate();

alter table public.taxpay_external_payment_records enable row level security;
alter table public.taxpay_external_payment_records force row level security;
alter table public.taxpay_external_credit_postings enable row level security;
alter table public.taxpay_external_credit_postings force row level security;

revoke all on public.taxpay_external_payment_records from public,anon,authenticated,service_role;
revoke all on public.taxpay_external_credit_postings from public,anon,authenticated,service_role;
grant select on public.taxpay_external_payment_records to authenticated;
grant select on public.taxpay_external_credit_postings to authenticated;
-- Authorized server-side importer only; the browser cannot insert, alter, or delete.
grant select,insert on public.taxpay_external_payment_records to service_role;
grant select,insert on public.taxpay_external_credit_postings to service_role;

create policy taxpay_external_payment_owner_read on public.taxpay_external_payment_records
  for select to authenticated using (owner_uid=(select auth.uid()));
create policy taxpay_external_credit_owner_read on public.taxpay_external_credit_postings
  for select to authenticated using (owner_uid=(select auth.uid()));

revoke all on function public.taxpay_external_credit_validate() from public,anon,authenticated;
commit;
