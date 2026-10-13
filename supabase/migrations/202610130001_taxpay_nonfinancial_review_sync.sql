-- NBR TaxPay: non-financial shared intake and officer review, v1.
-- No gateway/ACS/Treasury/eLedger posting. All records are NON_FINANCIAL_REVIEW.
-- Run ONLY in an approved isolated project, with synthetic identities first.
-- Do not infer officer roles from email or user_metadata.

create table if not exists public.taxpay_officer_roles (
  user_uid uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('MAKER','REVIEWER','APPROVER')),
  active boolean not null default true,
  assigned_at timestamptz not null default now()
);

create table if not exists public.taxpay_payment_requests (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id),
  source_draft_id uuid references public.taxpay_payment_drafts(id),
  purpose text not null check (purpose in ('TAX_LIABILITY_PAYMENT','WITHHOLDING_TAX_DEPOSIT')),
  category text not null check (category in ('TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT')),
  assessment_year text not null check (assessment_year ~ '^20[0-9]{2}-[0-9]{2}$'),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 99999999999999),
  memo text check (char_length(memo) <= 300),
  request_status text not null default 'SUBMITTED_FOR_REVIEW' check (request_status in ('SUBMITTED_FOR_REVIEW','ACKNOWLEDGED','INFO_REQUESTED','REVIEW_CLOSED')),
  financial_receipt_status text not null default 'NOT_VERIFIED' check (financial_receipt_status = 'NOT_VERIFIED'),
  tax_credit_status text not null default 'NOT_VERIFIED' check (tax_credit_status = 'NOT_VERIFIED'),
  processing_mode text not null default 'NON_FINANCIAL_REVIEW' check (processing_mode = 'NON_FINANCIAL_REVIEW'),
  submitted_at timestamptz not null default now(),
  unique (owner_uid,source_draft_id),
  constraint taxpay_request_purpose_category check ((purpose = 'WITHHOLDING_TAX_DEPOSIT') = (category = 'SOURCE_TAX_DEPOSIT'))
);
create index if not exists taxpay_payment_requests_owner_recent on public.taxpay_payment_requests (owner_uid,submitted_at desc);

create table if not exists public.taxpay_review_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.taxpay_payment_requests(id),
  officer_uid uuid not null references auth.users(id),
  action text not null check (action in ('ACKNOWLEDGE','REQUEST_INFORMATION','CLOSE_REVIEW')),
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  idempotency_key uuid not null,
  previous_status text not null,
  next_status text not null,
  decided_at timestamptz not null default now(),
  unique (request_id, idempotency_key)
);
create index if not exists taxpay_review_decisions_request_recent on public.taxpay_review_decisions(request_id,decided_at desc);

create table if not exists public.taxpay_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.taxpay_payment_requests(id),
  actor_uid uuid references auth.users(id),
  event_type text not null check (event_type in ('REQUEST_SUBMITTED','OFFICER_ACKNOWLEDGED','OFFICER_INFO_REQUESTED','OFFICER_REVIEW_CLOSED')),
  status_after text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists taxpay_request_events_request_seq on public.taxpay_request_events(request_id,id);

create table if not exists public.taxpay_in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_uid uuid not null references auth.users(id),
  request_id uuid not null references public.taxpay_payment_requests(id),
  event_id bigint not null references public.taxpay_request_events(id),
  message_code text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique(recipient_uid,event_id)
);
create index if not exists taxpay_in_app_notifications_user_recent on public.taxpay_in_app_notifications(recipient_uid,created_at desc);

create or replace function public.taxpay_is_officer() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (select 1 from public.taxpay_officer_roles r where r.user_uid = (select auth.uid()) and r.active);
$$;

create or replace function public.taxpay_create_review_events() returns trigger language plpgsql security definer
set search_path = '' as $$
declare v_event bigint;
begin
  insert into public.taxpay_request_events(request_id,actor_uid,event_type,status_after)
  values(new.id,new.owner_uid,'REQUEST_SUBMITTED',new.request_status) returning id into v_event;
  insert into public.taxpay_in_app_notifications(recipient_uid,request_id,event_id,message_code)
  values (new.owner_uid,new.id,v_event,'REQUEST_SUBMITTED');
  insert into public.taxpay_in_app_notifications(recipient_uid,request_id,event_id,message_code)
    select r.user_uid,new.id,v_event,'OFFICER_NEW_REQUEST' from public.taxpay_officer_roles r where r.active
    on conflict (recipient_uid,event_id) do nothing;
  return new;
end; $$;
create trigger taxpay_payment_request_intake_after_insert
  after insert on public.taxpay_payment_requests for each row
  execute function public.taxpay_create_review_events();

create or replace function public.taxpay_record_officer_review(
  p_request_id uuid, p_action text, p_reason text, p_idempotency_key uuid
) returns text language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_role text; v_request public.taxpay_payment_requests%rowtype; v_next text; v_event bigint; v_existing public.taxpay_review_decisions%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.taxpay_officer_roles where user_uid=v_actor and active for share;
  if v_role is null then raise exception 'Officer authorization required'; end if;
  if p_action not in ('ACKNOWLEDGE','REQUEST_INFORMATION','CLOSE_REVIEW') or length(btrim(coalesce(p_reason,''))) not between 10 and 1000 or p_idempotency_key is null then
    raise exception 'Invalid action, reason or idempotency key';
  end if;
  -- Exactly one request row lock governs all transitions and retry checks.
  select * into v_request from public.taxpay_payment_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  select * into v_existing from public.taxpay_review_decisions where request_id=p_request_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.officer_uid=v_actor and v_existing.action=p_action and v_existing.reason=p_reason then return v_existing.next_status; end if;
    raise exception 'Idempotency key reused with different action';
  end if;
  if v_request.request_status='REVIEW_CLOSED' then raise exception 'Review already closed'; end if;
  if p_action='ACKNOWLEDGE' and v_request.request_status='SUBMITTED_FOR_REVIEW' then v_next:='ACKNOWLEDGED';
  elsif p_action='REQUEST_INFORMATION' and v_request.request_status in ('SUBMITTED_FOR_REVIEW','ACKNOWLEDGED') then v_next:='INFO_REQUESTED';
  elsif p_action='CLOSE_REVIEW' and v_request.request_status in ('ACKNOWLEDGED','INFO_REQUESTED') and v_role in ('REVIEWER','APPROVER') then v_next:='REVIEW_CLOSED';
  else raise exception 'Role or state transition not permitted'; end if;
  update public.taxpay_payment_requests set request_status=v_next where id=p_request_id;
  insert into public.taxpay_review_decisions(request_id,officer_uid,action,reason,idempotency_key,previous_status,next_status)
    values(p_request_id,v_actor,p_action,p_reason,p_idempotency_key,v_request.request_status,v_next);
  insert into public.taxpay_request_events(request_id,actor_uid,event_type,status_after)
    values(p_request_id,v_actor,case p_action when 'ACKNOWLEDGE' then 'OFFICER_ACKNOWLEDGED' when 'REQUEST_INFORMATION' then 'OFFICER_INFO_REQUESTED' else 'OFFICER_REVIEW_CLOSED' end,v_next)
    returning id into v_event;
  insert into public.taxpay_in_app_notifications(recipient_uid,request_id,event_id,message_code)
    values(v_request.owner_uid,p_request_id,v_event,'REQUEST_'||v_next)
    on conflict(recipient_uid,event_id) do nothing;
  return v_next;
end; $$;

alter table public.taxpay_officer_roles enable row level security;
alter table public.taxpay_payment_requests enable row level security;
alter table public.taxpay_review_decisions enable row level security;
alter table public.taxpay_request_events enable row level security;
alter table public.taxpay_in_app_notifications enable row level security;

revoke all on public.taxpay_officer_roles,public.taxpay_payment_requests,public.taxpay_review_decisions,public.taxpay_request_events,public.taxpay_in_app_notifications from public,anon,authenticated;
grant select on public.taxpay_officer_roles to authenticated;
grant select on public.taxpay_payment_requests,public.taxpay_review_decisions,public.taxpay_request_events,public.taxpay_in_app_notifications to authenticated;
grant insert(owner_uid,source_draft_id,purpose,category,assessment_year,amount_minor,memo) on public.taxpay_payment_requests to authenticated;
grant update(is_read) on public.taxpay_in_app_notifications to authenticated;

create policy taxpay_officer_roles_self on public.taxpay_officer_roles for select to authenticated using(user_uid=(select auth.uid()));
create policy taxpay_requests_read_owner_officer on public.taxpay_payment_requests for select to authenticated
  using(owner_uid=(select auth.uid()) or (select public.taxpay_is_officer()));
create policy taxpay_requests_insert_owner on public.taxpay_payment_requests for insert to authenticated
  with check(owner_uid=(select auth.uid()) and (source_draft_id is null or exists(select 1 from public.taxpay_payment_drafts d where d.id=source_draft_id and d.owner_uid=(select auth.uid()))));
create policy taxpay_decisions_read_owner_officer on public.taxpay_review_decisions for select to authenticated
  using((select public.taxpay_is_officer()) or exists(select 1 from public.taxpay_payment_requests p where p.id=request_id and p.owner_uid=(select auth.uid())));
create policy taxpay_events_read_owner_officer on public.taxpay_request_events for select to authenticated
  using((select public.taxpay_is_officer()) or exists(select 1 from public.taxpay_payment_requests p where p.id=request_id and p.owner_uid=(select auth.uid())));
create policy taxpay_notifications_read_own on public.taxpay_in_app_notifications for select to authenticated using(recipient_uid=(select auth.uid()));
create policy taxpay_notifications_mark_own on public.taxpay_in_app_notifications for update to authenticated
  using(recipient_uid=(select auth.uid())) with check(recipient_uid=(select auth.uid()));

revoke all on function public.taxpay_is_officer() from public,anon;
grant execute on function public.taxpay_is_officer() to authenticated;
revoke all on function public.taxpay_record_officer_review(uuid,text,text,uuid) from public,anon;
grant execute on function public.taxpay_record_officer_review(uuid,text,text,uuid) to authenticated;
revoke all on function public.taxpay_create_review_events() from public,anon,authenticated;

comment on table public.taxpay_payment_requests is 'Non-financial taxpayer intake shared with authorized officers. Never payment evidence or tax credit.';
comment on table public.taxpay_review_decisions is 'Officer review dispositions only, not approvals of financial receipt, statutory credit or refund.';