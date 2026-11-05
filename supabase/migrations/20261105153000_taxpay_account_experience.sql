-- Account-scoped interaction history and view preferences.
-- These rows never establish payment settlement, tax credit, TIN ownership,
-- officer role, authorization or approval. Existing financial tables untouched.
begin;
create table public.taxpay_account_ui_state(
  owner_uid uuid not null references auth.users(id) on delete cascade,
  preference_key text not null check (preference_key in
    ('beneficiary_tag_filter','beneficiary_relationship_filter',
     'payment_service','payment_for_self','last_route')),
  value text not null check (length(value) between 1 and 160),
  updated_at timestamptz not null default now(),
  primary key(owner_uid,preference_key)
);
create table public.taxpay_account_interactions(
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  client_event_id uuid not null,
  event_type text not null check (event_type in
    ('NAVIGATE','PAYMENT_ENTRY','PAYMENT_STAGE','BENEFICIARY_LIST_SELECTED',
     'BENEFICIARY_ADDED','BENEFICIARY_EDITED','BENEFICIARY_REMOVED',
     'BENEFICIARY_LIST_CREATED','BENEFICIARY_LIST_RENAMED','BENEFICIARY_LIST_REMOVED',
     'NOTIFICATIONS_READ','SETTINGS_SAVED')),
  source text not null check (length(source) between 1 and 60),
  occurred_at timestamptz not null default now(),
  unique(owner_uid,client_event_id)
);
create index taxpay_account_interactions_owner_time
 on public.taxpay_account_interactions(owner_uid,occurred_at desc,id desc);
comment on table public.taxpay_account_ui_state is
 'Current owner-specific filter/navigation preferences. Not an identity claim or payment source.';
comment on table public.taxpay_account_interactions is
 'Owner-specific application interaction trail. Not a Treasury, payment or tax ledger event.';
alter table public.taxpay_account_ui_state enable row level security;
alter table public.taxpay_account_ui_state force row level security;
alter table public.taxpay_account_interactions enable row level security;
alter table public.taxpay_account_interactions force row level security;
revoke all on public.taxpay_account_ui_state, public.taxpay_account_interactions
 from public,anon,authenticated;
grant select,insert,update,delete on public.taxpay_account_ui_state to authenticated;
grant select,insert on public.taxpay_account_interactions to authenticated;
create policy taxpay_account_ui_read_own on public.taxpay_account_ui_state
 for select to authenticated using(owner_uid=(select auth.uid()));
create policy taxpay_account_ui_insert_own on public.taxpay_account_ui_state
 for insert to authenticated with check(owner_uid=(select auth.uid()));
create policy taxpay_account_ui_update_own on public.taxpay_account_ui_state
 for update to authenticated using(owner_uid=(select auth.uid()))
 with check(owner_uid=(select auth.uid()));
create policy taxpay_account_ui_delete_own on public.taxpay_account_ui_state
 for delete to authenticated using(owner_uid=(select auth.uid()));
create policy taxpay_account_interactions_read_own on public.taxpay_account_interactions
 for select to authenticated using(owner_uid=(select auth.uid()));
create policy taxpay_account_interactions_insert_own on public.taxpay_account_interactions
 for insert to authenticated with check(owner_uid=(select auth.uid()));
commit;
