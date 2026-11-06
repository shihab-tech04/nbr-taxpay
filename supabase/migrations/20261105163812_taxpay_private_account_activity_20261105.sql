-- Canonical source for the already-applied owner-scoped activity table.
-- Entries are nonfinancial UI activity, never payment proof or an audit ledger.
begin;
create table if not exists public.taxpay_account_activity (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'PAGE_OPENED','LANGUAGE_CHANGED','BENEFICIARY_LIST_SELECTED',
    'PAYMENT_STARTED','PROFILE_SAVED'
  )),
  route text check (route is null or (length(route) between 1 and 64 and route ~ '^[a-z_]+$')),
  occurred_at timestamptz not null default now()
);
create index if not exists taxpay_account_activity_owner_recent
  on public.taxpay_account_activity(owner_uid,occurred_at desc,id desc);
comment on table public.taxpay_account_activity is
  'Nonfinancial navigation and preference activity written by the owning account. Not a certified transaction or immutable security audit.';
alter table public.taxpay_account_activity enable row level security;
alter table public.taxpay_account_activity force row level security;
revoke all on public.taxpay_account_activity from public,anon,authenticated;
grant select,insert on public.taxpay_account_activity to authenticated;
create policy taxpay_account_activity_select_own
  on public.taxpay_account_activity for select to authenticated
  using (owner_uid=(select auth.uid()));
create policy taxpay_account_activity_insert_own
  on public.taxpay_account_activity for insert to authenticated
  with check (owner_uid=(select auth.uid()));
commit;
