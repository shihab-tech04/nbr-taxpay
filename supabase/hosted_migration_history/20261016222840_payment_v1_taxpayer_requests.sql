-- Payment API v1: taxpayer-side REQUESTS, not settlement or tax credit.
-- Dedicated private schema; the existing taxpay_* and sim_* tables are untouched.
-- This migration is a source artifact until applied and tested in an approved DB.

create schema if not exists payment_sync;
revoke all on schema payment_sync from public, anon, authenticated;

create table payment_sync.settings (
  singleton boolean primary key default true check (singleton),
  origin text not null check (origin in ('TAXPAY_SQL','OFFICE_SQL'))
);
insert into payment_sync.settings(singleton,origin) values(true,'TAXPAY_SQL');

-- Provisioned by a privileged operator only. An Office demo login is never authorization.
create table payment_sync.officer_roles (
  user_uid uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('MAKER','REVIEWER','APPROVER')),
  active boolean not null default true,
  granted_at timestamptz not null default now()
);

create table payment_sync.requests (
  id uuid primary key default gen_random_uuid(),
  origin text not null check (origin in ('TAXPAY_SQL','OFFICE_SQL')),
  created_by uuid not null references auth.users(id),
  initiator_kind text not null check (initiator_kind in ('TAXPAYER','OFFICER')),
  idempotency_key uuid not null,
  payload_fingerprint text not null,
  input jsonb not null,
  service_code text not null check (service_code in (
    'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
    'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX')),
  total_minor bigint not null check(total_minor between 1 and 1000000000000),
  request_state text not null default 'REQUESTED' check (request_state in ('REQUESTED','AWAITING_PAYMENT','CANCELLED','EXPIRED')),
  settlement_state text not null default 'NOT_STARTED' check (settlement_state in (
    'NOT_STARTED','PROVIDER_PENDING','PROVIDER_FAILED','PROVIDER_CONFIRMED',
    'GOVERNMENT_RECEIVED','RECONCILED','REVERSED')),
  credit_state text not null default 'NOT_CREDITED' check(credit_state in (
    'NOT_APPLICABLE','NOT_CREDITED','CREDITED','CREDIT_REVERSED')),
  simulation_only boolean not null default true check (simulation_only),
  revision int not null default 1 check(revision > 0),
  created_at timestamptz not null default now(),
  unique(created_by,idempotency_key)
);
create index payment_v1_requests_creator_recent on payment_sync.requests(created_by,created_at desc);

create table payment_sync.events (
  event_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references payment_sync.requests(id),
  source_revision int not null check(source_revision > 0),
  schema_version text not null default '1.0.0' check(schema_version='1.0.0'),
  origin text not null check(origin in ('TAXPAY_SQL','OFFICE_SQL')),
  event_type text not null check(event_type in (
    'REQUEST_CREATED','REQUEST_UPDATED','REQUEST_CANCELLED','PROVIDER_UPDATE',
    'TREASURY_VERIFIED','CREDIT_POSTED','REVERSAL_RECORDED',
    'OFFICER_ACTION','NOTIFICATION_CREATED')),
  actor_uid uuid references auth.users(id),
  event_payload jsonb not null,
  occurred_at timestamptz not null default now(),
  unique(request_id,source_revision)
);

create table payment_sync.outbox (
  event_id uuid primary key references payment_sync.events(event_id),
  target text not null check(target in ('TAXPAY_SQL','OFFICE_SQL')),
  delivery_state text not null default 'PENDING' check(delivery_state in ('PENDING','IN_FLIGHT','ACKNOWLEDGED','FAILED')),
  attempts int not null default 0 check(attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index payment_v1_outbox_ready on payment_sync.outbox(delivery_state,next_attempt_at);

create table payment_sync.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_uid uuid not null references auth.users(id),
  request_id uuid not null references payment_sync.requests(id),
  event_id uuid not null references payment_sync.events(event_id),
  message_code text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique(recipient_uid,event_id)
);
create index payment_v1_notice_user_recent on payment_sync.notifications(recipient_uid,created_at desc);

-- Pure server-side boundary checks. Head applicability, rate, identity ownership and
-- statutory rules still require trusted registries before operational payments.
create function payment_sync.validate_request(p jsonb) returns bigint
language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_service text; v_details jsonb; v_amounts jsonb; v_total bigint := 0;
  v_field text; v_value text; v_line jsonb; v_deductee_total bigint := 0;
begin
  if p is null or pg_catalog.jsonb_typeof(p) <> 'object' then raise exception 'Request object required'; end if;
  if length(p::text) > 250000 then raise exception 'Request too large'; end if;
  if coalesce(p->>'idempotencyKey','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Valid idempotency key required';
  end if;
  if coalesce(p->>'payFor','') not in ('SELF','OTHER') then raise exception 'Invalid payFor'; end if;
  if p ? 'initiatorKind' or p ? 'requestState' or p ? 'settlementState' or p ? 'creditState'
     or p ? 'simulationOnly' or p ? 'verifiedActorId' then
    raise exception 'Client cannot supply authority or financial status';
  end if;
  if length(pg_catalog.btrim(coalesce(p->>'payerName',''))) not between 1 and 160 then raise exception 'Payer name required'; end if;
  if p ? 'payerTin' and p->>'payerTin' is not null and p->>'payerTin' !~ '^[0-9]{12}$' then raise exception 'Invalid payer TIN'; end if;
  v_service := p->>'serviceCode';
  if v_service not in (
    'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
    'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX'
  ) or v_service is null then raise exception 'Unsupported payment service'; end if;

  if v_service='TRAVEL_TAX' then
    if (p->>'taxpayerTin') is not null or (p->>'assessmentYear') is not null or (p->>'headId') is not null then
      raise exception 'Travel Tax must not use income-tax TIN, year or head';
    end if;
  else
    if coalesce(p->>'taxpayerTin','') !~ '^[0-9]{12}$' then raise exception 'Invalid taxpayer TIN'; end if;
    if coalesce(p->>'assessmentYear','') !~ '^20[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid assessment year'; end if;
    if pg_catalog.jsonb_typeof(p->'headId') is distinct from 'number'
       or coalesce(p->>'headId','') !~ '^[1-9][0-9]{0,5}$' then raise exception 'Payment head required'; end if;
    if p->>'payFor'='SELF' and p->>'payerTin' is not null and p->>'payerTin' <> p->>'taxpayerTin' then
      raise exception 'SELF payer TIN does not match taxpayer TIN';
    end if;
  end if;

  v_amounts := p->'amounts';
  if pg_catalog.jsonb_typeof(v_amounts) <> 'object' then raise exception 'Amount breakdown required'; end if;
  foreach v_field in array array['taxMinor','penaltyMinor','surchargeMinor','interestMinor'] loop
    v_value := v_amounts->>v_field;
    if pg_catalog.jsonb_typeof(v_amounts->v_field) is distinct from 'number'
       or v_value is null or v_value !~ '^(0|[1-9][0-9]{0,12})$' then raise exception 'Invalid amount field: %',v_field; end if;
    v_total := v_total + v_value::bigint;
    if v_total > 1000000000000 then raise exception 'Amount exceeds allowed request range'; end if;
  end loop;
  if v_total < 1 then raise exception 'Payment amount must be positive'; end if;

  v_details := p->'details';
  if pg_catalog.jsonb_typeof(v_details) is distinct from 'object' then raise exception 'Service details required'; end if;
  if v_service='TRAVEL_TAX' then
    if (v_details->>'kind') is distinct from 'TRAVEL_TAX' or length(pg_catalog.btrim(coalesce(v_details->>'routeCode','')))=0
       or coalesce(v_details->>'journeyType','') not in ('AIR','SEA','LAND')
       or length(pg_catalog.btrim(coalesce(v_details->>'destination','')))=0
       or length(pg_catalog.btrim(coalesce(v_details->>'departurePort','')))=0
       or coalesce(v_details->>'departureDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then raise exception 'Invalid Travel Tax details'; end if;
    if pg_catalog.jsonb_typeof(v_details->'passengers') is distinct from 'array' then
      raise exception 'Travel passengers required';
    end if;
    if pg_catalog.jsonb_array_length(v_details->'passengers') not between 1 and 20 then
      raise exception 'Travel passengers required';
    end if;
    for v_line in select value from pg_catalog.jsonb_array_elements(v_details->'passengers') loop
      if length(pg_catalog.btrim(coalesce(v_line->>'name','')))=0 or coalesce(v_line->>'ageBand','') not in ('ADULT','CHILD','UNDER5') then
        raise exception 'Invalid travel passenger';
      end if;
    end loop;
  elsif v_service='SOURCE_TAX_DEPOSIT' then
    if (v_details->>'kind') is distinct from 'SOURCE_TAX' or coalesce(v_details->>'withholdingAgentTin','') !~ '^[0-9]{12}$'
       or length(pg_catalog.btrim(coalesce(v_details->>'periodReference','')))=0 then raise exception 'Invalid source-tax details'; end if;
    if pg_catalog.jsonb_typeof(v_details->'deductees') is distinct from 'array' then
      raise exception 'Deductee allocation required';
    end if;
    if pg_catalog.jsonb_array_length(v_details->'deductees') not between 1 and 200 then
      raise exception 'Deductee allocation required';
    end if;
    for v_line in select value from pg_catalog.jsonb_array_elements(v_details->'deductees') loop
      if coalesce(v_line->>'tin','') !~ '^[0-9]{12}$'
         or pg_catalog.jsonb_typeof(v_line->'amountMinor') is distinct from 'number'
         or coalesce(v_line->>'amountMinor','') !~ '^[1-9][0-9]{0,12}$' then
        raise exception 'Invalid deductee allocation';
      end if;
      v_deductee_total := v_deductee_total + (v_line->>'amountMinor')::bigint;
      if v_deductee_total > 1000000000000 then raise exception 'Deductee total exceeds limit'; end if;
    end loop;
    if v_deductee_total <> (v_amounts->>'taxMinor')::bigint then raise exception 'Deductee amounts must equal taxMinor'; end if;
  else
    if (v_details->>'kind') is distinct from 'INCOME_TAX' or coalesce(v_details->>'incomeTaxType','') not in ('COMPANY','NON_COMPANY') then
      raise exception 'Invalid income-tax details';
    end if;
    if v_service in ('ASSESSED_DEMAND','PENALTY','OTHER_TAX_PAYMENT') and length(pg_catalog.btrim(coalesce(v_details->>'noticeReference','')))=0 then
      raise exception 'Payment reference required';
    end if;
    if v_service='APPELLATE_TRIBUNAL' and length(pg_catalog.btrim(coalesce(v_details->>'caseReference','')))=0 then
      raise exception 'Tribunal case reference required';
    end if;
  end if;
  return v_total;
end;
$$;

-- PostgREST exposes only these narrow RPCs. The creation RPC can never claim paid.
create function public.payment_v1_create_request(p_input jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_origin text; v_key uuid; v_total bigint;
  v_fingerprint text; v_existing payment_sync.requests%rowtype;
  v_id uuid; v_event uuid; v_kind text;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  select origin into v_origin from payment_sync.settings where singleton;
  if v_origin is null then raise exception 'Payment API origin is not configured'; end if;
  if v_origin='OFFICE_SQL' and not exists(
    select 1 from payment_sync.officer_roles r where r.user_uid=v_actor and r.active and r.role in ('MAKER','REVIEWER','APPROVER')
  ) then raise exception 'Authorized officer required'; end if;
  v_total := payment_sync.validate_request(p_input);
  v_key := (p_input->>'idempotencyKey')::uuid;
  v_fingerprint := pg_catalog.md5(p_input::text);
  v_kind := case when v_origin='OFFICE_SQL' then 'OFFICER' else 'TAXPAYER' end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||v_key::text,0));
  select * into v_existing from payment_sync.requests where created_by=v_actor and idempotency_key=v_key;
  if found then
    if v_existing.payload_fingerprint<>v_fingerprint then raise exception 'Idempotency key used for a different request'; end if;
    return pg_catalog.jsonb_build_object('requestId',v_existing.id,'totalMinor',v_existing.total_minor,'replayed',true);
  end if;
  insert into payment_sync.requests(origin,created_by,initiator_kind,idempotency_key,payload_fingerprint,input,service_code,total_minor,credit_state)
  values(v_origin,v_actor,v_kind,v_key,v_fingerprint,p_input,p_input->>'serviceCode',v_total,
    case when p_input->>'serviceCode' in ('TRAVEL_TAX','SOURCE_TAX_DEPOSIT') then 'NOT_APPLICABLE' else 'NOT_CREDITED' end)
  returning id into v_id;
  insert into payment_sync.events(request_id,source_revision,origin,event_type,actor_uid,event_payload)
  values(v_id,1,v_origin,'REQUEST_CREATED',v_actor,
    pg_catalog.jsonb_build_object('requestId',v_id,'input',p_input,'totalMinor',v_total,'initiatorKind',v_kind))
  returning event_id into v_event;
  insert into payment_sync.outbox(event_id,target)
  values(v_event,case when v_origin='TAXPAY_SQL' then 'OFFICE_SQL' else 'TAXPAY_SQL' end);
  insert into payment_sync.notifications(recipient_uid,request_id,event_id,message_code)
  values(v_actor,v_id,v_event,'REQUEST_CREATED');
  return pg_catalog.jsonb_build_object('requestId',v_id,'totalMinor',v_total,'replayed',false);
end;
$$;

create function public.payment_v1_my_requests(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_origin text; v_is_officer boolean := false; v_result jsonb;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size'; end if;
  select origin into v_origin from payment_sync.settings where singleton;
  if v_origin is null then raise exception 'Payment API origin is not configured'; end if;
  select exists(select 1 from payment_sync.officer_roles a where a.user_uid=v_actor and a.active)
    into v_is_officer;
  if v_origin='OFFICE_SQL' and not v_is_officer then raise exception 'Authorized officer required'; end if;
  select coalesce(pg_catalog.jsonb_agg(x.obj order by x.created_at desc,x.id desc),'[]'::jsonb)
  into v_result from (
    select r.id,r.created_at,pg_catalog.jsonb_build_object(
      'requestId',r.id,'input',r.input,'initiatorKind',r.initiator_kind,
      'requestState',r.request_state,'settlementState',r.settlement_state,
      'creditState',r.credit_state,'totalMinor',r.total_minor,'revision',r.revision,
      'createdAt',r.created_at,'simulationOnly',r.simulation_only
    ) as obj
    from payment_sync.requests r
    where r.created_by=v_actor or (v_origin='OFFICE_SQL' and v_is_officer)
    order by r.created_at desc,r.id desc limit p_limit
  ) x;
  return v_result;
end;
$$;

create function public.payment_v1_my_notifications(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_result jsonb;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size'; end if;
  select coalesce(pg_catalog.jsonb_agg(x.obj order by x.created_at desc,x.id desc),'[]'::jsonb)
  into v_result from (
    select n.id,n.created_at,pg_catalog.jsonb_build_object(
      'id',n.id,'requestId',n.request_id,'eventId',n.event_id,'recipientId',n.recipient_uid,
      'messageCode',n.message_code,'isRead',n.is_read,'createdAt',n.created_at
    ) as obj
    from payment_sync.notifications n where n.recipient_uid=v_actor
    order by n.created_at desc,n.id desc limit p_limit
  ) x;
  return v_result;
end;
$$;

create function public.payment_v1_get_request(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_origin text; v_is_officer boolean := false; v_result jsonb;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  select origin into v_origin from payment_sync.settings where singleton;
  if v_origin is null then raise exception 'Payment API origin is not configured'; end if;
  if v_origin='OFFICE_SQL' then
    select exists(select 1 from payment_sync.officer_roles a where a.user_uid=v_actor and a.active)
      into v_is_officer;
    if not v_is_officer then raise exception 'Authorized officer required'; end if;
  end if;
  select pg_catalog.jsonb_build_object(
    'requestId',r.id,'input',r.input,'initiatorKind',r.initiator_kind,
    'requestState',r.request_state,'settlementState',r.settlement_state,
    'creditState',r.credit_state,'totalMinor',r.total_minor,'revision',r.revision,
    'createdAt',r.created_at,'simulationOnly',r.simulation_only
  ) into v_result
  from payment_sync.requests r
  where r.id=p_id and (r.created_by=v_actor or (v_origin='OFFICE_SQL' and v_is_officer));
  if v_result is null then raise exception 'Payment request not found'; end if;
  return v_result;
end;
$$;

create function public.payment_v1_set_notice_read(p_id uuid,p_is_read boolean default true) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_updated uuid;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  update payment_sync.notifications set is_read=p_is_read
    where id=p_id and recipient_uid=v_actor returning id into v_updated;
  if v_updated is null then raise exception 'Notification not found'; end if;
  return true;
end;
$$;

-- Explicit RLS and revocations prevent direct mutation of financial-looking state.
alter table payment_sync.settings enable row level security;
alter table payment_sync.officer_roles enable row level security;
alter table payment_sync.requests enable row level security;
alter table payment_sync.events enable row level security;
alter table payment_sync.outbox enable row level security;
alter table payment_sync.notifications enable row level security;
revoke all on all tables in schema payment_sync from public, anon, authenticated;
revoke all on function payment_sync.validate_request(jsonb) from public, anon, authenticated;
revoke all on function public.payment_v1_create_request(jsonb) from public, anon;
revoke all on function public.payment_v1_my_requests(integer) from public, anon;
revoke all on function public.payment_v1_get_request(uuid) from public, anon;
revoke all on function public.payment_v1_my_notifications(integer) from public, anon;
revoke all on function public.payment_v1_set_notice_read(uuid,boolean) from public, anon;
grant execute on function public.payment_v1_create_request(jsonb) to authenticated;
grant execute on function public.payment_v1_my_requests(integer) to authenticated;
grant execute on function public.payment_v1_get_request(uuid) to authenticated;
grant execute on function public.payment_v1_my_notifications(integer) to authenticated;
grant execute on function public.payment_v1_set_notice_read(uuid,boolean) to authenticated;

comment on table payment_sync.requests is 'Unsettled request intents only. Cannot issue official receipt, payment credit or challan.';
comment on table payment_sync.outbox is 'Durable pending cross-project synchronization; delivery worker is Phase 3.';
