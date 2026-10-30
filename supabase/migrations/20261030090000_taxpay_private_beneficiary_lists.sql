-- Beneficiaries are private saved payment shortcuts, not authorization grants.
-- Additive migration. Does not alter receipts, ledger, approval or tax-credit records.
begin;
create table public.taxpay_beneficiary_lists (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80 and name=btrim(name)),
  created_at timestamptz not null default now(),
  unique(id,owner_uid)
);
create unique index taxpay_beneficiary_list_owner_name_idx
  on public.taxpay_beneficiary_lists(owner_uid, lower(name));

create table public.taxpay_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null,
  tin text not null check (tin ~ '^[0-9]{12}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 160 and display_name=btrim(display_name)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(list_id,tin),
  foreign key (list_id,owner_uid) references public.taxpay_beneficiary_lists(id,owner_uid) on delete cascade
);
create index taxpay_beneficiaries_owner_list_idx on public.taxpay_beneficiaries(owner_uid,list_id,created_at);

comment on table public.taxpay_beneficiary_lists is
  'Private user-defined address-book groups only; do not confer taxpayer access or authorization.';
comment on table public.taxpay_beneficiaries is
  'Owner-scoped saved TIN and display name for Pay Tax For Others prefill only; not verified taxpayer identity or authorization.';

alter table public.taxpay_beneficiary_lists enable row level security;
alter table public.taxpay_beneficiary_lists force row level security;
alter table public.taxpay_beneficiaries enable row level security;
alter table public.taxpay_beneficiaries force row level security;

revoke all on public.taxpay_beneficiary_lists, public.taxpay_beneficiaries from public,anon,authenticated;
grant select,insert,update,delete on public.taxpay_beneficiary_lists, public.taxpay_beneficiaries to authenticated;
create policy beneficiary_lists_select_own on public.taxpay_beneficiary_lists for select to authenticated using (owner_uid=(select auth.uid()));
create policy beneficiary_lists_insert_own on public.taxpay_beneficiary_lists for insert to authenticated with check (owner_uid=(select auth.uid()));
create policy beneficiary_lists_update_own on public.taxpay_beneficiary_lists for update to authenticated using (owner_uid=(select auth.uid())) with check (owner_uid=(select auth.uid()));
create policy beneficiary_lists_delete_own on public.taxpay_beneficiary_lists for delete to authenticated using (owner_uid=(select auth.uid()));

create policy beneficiaries_select_own on public.taxpay_beneficiaries for select to authenticated using (owner_uid=(select auth.uid()));
create policy beneficiaries_insert_own on public.taxpay_beneficiaries for insert to authenticated with check (owner_uid=(select auth.uid()));
create policy beneficiaries_update_own on public.taxpay_beneficiaries for update to authenticated using (owner_uid=(select auth.uid())) with check (owner_uid=(select auth.uid()));
create policy beneficiaries_delete_own on public.taxpay_beneficiaries for delete to authenticated using (owner_uid=(select auth.uid()));
commit;
