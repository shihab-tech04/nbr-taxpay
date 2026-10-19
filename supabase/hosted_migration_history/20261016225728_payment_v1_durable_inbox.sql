-- Payment API v1: durable cross-project mirroring. No public table access.
-- A server-side bridge alone may claim, deliver and acknowledge outbox events.
create table payment_sync.inbox_events (
  event_id uuid primary key,
  source_origin text not null check(source_origin in ('TAXPAY_SQL','OFFICE_SQL')),
  request_id uuid not null,
  source_revision integer not null check(source_revision > 0),
  event_type text not null check(event_type in (
    'REQUEST_CREATED','REQUEST_UPDATED','REQUEST_CANCELLED','PROVIDER_UPDATE',
    'TREASURY_VERIFIED','CREDIT_POSTED','REVERSAL_RECORDED',
    'OFFICER_ACTION','NOTIFICATION_CREATED')),
  event_fingerprint text not null,
  event_payload jsonb not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  applied_at timestamptz,
  unique(source_origin,request_id,source_revision)
);
create index payment_v1_inbox_pending on payment_sync.inbox_events(source_origin,request_id,source_revision) where applied_at is null;

create table payment_sync.mirrored_requests (
  request_id uuid primary key,
  source_origin text not null check(source_origin in ('TAXPAY_SQL','OFFICE_SQL')),
  external_creator_uid uuid not null,
  initiator_kind text not null check(initiator_kind in ('TAXPAYER','OFFICER')),
  input jsonb not null,
  service_code text not null,
  total_minor bigint not null check(total_minor between 1 and 1000000000000),
  request_state text not null check(request_state in ('REQUESTED','AWAITING_PAYMENT','CANCELLED','EXPIRED')),
  settlement_state text not null check(settlement_state in (
    'NOT_STARTED','PROVIDER_PENDING','PROVIDER_FAILED','PROVIDER_CONFIRMED',
    'GOVERNMENT_RECEIVED','RECONCILED','REVERSED')),
  credit_state text not null check(credit_state in ('NOT_APPLICABLE','NOT_CREDITED','CREDITED','CREDIT_REVERSED')),
  revision integer not null check(revision > 0),
  last_event_id uuid not null references payment_sync.inbox_events(event_id),
  occurred_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index payment_v1_mirror_service on payment_sync.mirrored_requests(service_code,updated_at desc);

-- Separate recipients: a TaxPay auth UID is not an Office auth UID.
-- Phase 5 will resolve user delivery through a scoped identity crosswalk.
create table payment_sync.cross_project_notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references payment_sync.inbox_events(event_id),
  request_id uuid not null references payment_sync.mirrored_requests(request_id),
  source_origin text not null,
  external_creator_uid uuid not null,
  message_code text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index payment_v1_cross_notices_recent on payment_sync.cross_project_notifications(created_at desc);

alter table payment_sync.outbox add column claim_token uuid;
create index payment_v1_outbox_retry on payment_sync.outbox(next_attempt_at,created_at)
  where delivery_state <> 'ACKNOWLEDGED';

-- Private ordered reducer: a later revision can be stored before its predecessor,
-- but may not mutate the mirror until all earlier revisions have arrived.
create function payment_sync.apply_pending(p_origin text,p_request_id uuid) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_m payment_sync.mirrored_requests%rowtype;
  v_e payment_sync.inbox_events%rowtype;
  v_snapshot jsonb;
  v_input jsonb;
  v_total bigint;
  v_kind text;
  v_creator uuid;
  v_count integer := 0;
  v_request_state text;
  v_settlement_state text;
  v_credit_state text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_origin||':'||p_request_id::text,2718));
  loop
    select * into v_m from payment_sync.mirrored_requests where request_id=p_request_id;
    select * into v_e from payment_sync.inbox_events
      where request_id=p_request_id and source_origin=p_origin and applied_at is null
        and source_revision=case when v_m.request_id is null then 1 else v_m.revision+1 end
      order by source_revision limit 1;
    exit when not found;
    if v_m.request_id is null then
      if v_e.event_type <> 'REQUEST_CREATED' or v_e.source_revision <> 1 then
        raise exception 'First mirror event must create a request';
      end if;
      v_input := v_e.event_payload->'input';
      v_total := payment_sync.validate_request(v_input);
      if pg_catalog.jsonb_typeof(v_e.event_payload->'totalMinor') is distinct from 'number'
         or v_e.event_payload->>'totalMinor' <> v_total::text then
        raise exception 'Inbound amount does not match validated input';
      end if;
      v_kind := v_e.event_payload->>'initiatorKind';
      if v_kind <> (case when p_origin='OFFICE_SQL' then 'OFFICER' else 'TAXPAYER' end) then
        raise exception 'Inbound initiator and source origin disagree';
      end if;
      v_creator := (v_e.event_payload->>'createdBy')::uuid;
      if v_creator is null then raise exception 'Inbound event missing verified source creator'; end if;
      if v_e.event_payload->>'requestId' <> p_request_id::text then
        raise exception 'Inbound request ID mismatch';
      end if;
      insert into payment_sync.mirrored_requests
        (request_id,source_origin,external_creator_uid,initiator_kind,input,service_code,
         total_minor,request_state,settlement_state,credit_state,revision,last_event_id,occurred_at)
      values(p_request_id,p_origin,v_creator,v_kind,v_input,v_input->>'serviceCode',v_total,
         'REQUESTED','NOT_STARTED',case when v_input->>'serviceCode' in ('TRAVEL_TAX','SOURCE_TAX_DEPOSIT')
           then 'NOT_APPLICABLE' else 'NOT_CREDITED' end,1,v_e.event_id,v_e.occurred_at);
    else
      if v_e.event_type='REQUEST_CREATED' then raise exception 'Creation event cannot follow a revision'; end if;
      v_snapshot := v_e.event_payload->'snapshot';
      if pg_catalog.jsonb_typeof(v_snapshot) is distinct from 'object'
        or v_snapshot->>'requestId' <> p_request_id::text
        or v_snapshot->>'revision' <> v_e.source_revision::text
        or v_snapshot->>'initiatorKind' <> v_m.initiator_kind
        or v_snapshot->'input' is distinct from v_m.input
        or v_snapshot->>'totalMinor' <> v_m.total_minor::text
        or v_snapshot->>'simulationOnly' <> 'true' then
        raise exception 'Inbound revision violates immutable request fields';
      end if;
      v_request_state := v_snapshot->>'requestState';
      v_settlement_state := v_snapshot->>'settlementState';
      v_credit_state := v_snapshot->>'creditState';
      if v_request_state not in ('REQUESTED','AWAITING_PAYMENT','CANCELLED','EXPIRED')
         or v_settlement_state not in ('NOT_STARTED','PROVIDER_PENDING','PROVIDER_FAILED','PROVIDER_CONFIRMED','GOVERNMENT_RECEIVED','RECONCILED','REVERSED')
         or v_credit_state not in ('NOT_APPLICABLE','NOT_CREDITED','CREDITED','CREDIT_REVERSED') then
        raise exception 'Inbound revision has invalid payment state';
      end if;
      if v_m.request_state in ('CANCELLED','EXPIRED') and v_m.request_state<>v_request_state then
        raise exception 'Terminal request status cannot be reopened';
      end if;
      if v_m.settlement_state<>v_settlement_state and v_e.event_type not in
        ('PROVIDER_UPDATE','TREASURY_VERIFIED','REVERSAL_RECORDED') then
        raise exception 'Settlement change needs a trusted evidence event';
      end if;
      if v_m.credit_state<>v_credit_state and v_e.event_type not in ('CREDIT_POSTED','REVERSAL_RECORDED') then
        raise exception 'Credit change needs a trusted ledger event';
      end if;
      update payment_sync.mirrored_requests set request_state=v_request_state,
        settlement_state=v_settlement_state,credit_state=v_credit_state,
        revision=v_e.source_revision,last_event_id=v_e.event_id,
        occurred_at=v_e.occurred_at,updated_at=now()
      where request_id=p_request_id;
    end if;
    update payment_sync.inbox_events set applied_at=now() where event_id=v_e.event_id;
    insert into payment_sync.cross_project_notifications
      (event_id,request_id,source_origin,external_creator_uid,message_code)
    select v_e.event_id,p_request_id,p_origin,m.external_creator_uid,v_e.event_type
      from payment_sync.mirrored_requests m where m.request_id=p_request_id
    on conflict(event_id) do nothing;
    v_count := v_count+1;
  end loop;
  return v_count;
end;
$$;

-- Invocable ONLY with a server-side service_role key (never a browser key).
create function public.payment_v1_internal_ingest(p_event jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_origin text;
  v_local text;
  v_id uuid;
  v_request_id uuid;
  v_revision integer;
  v_type text;
  v_fingerprint text;
  v_previous text;
  v_inserted integer;
  v_applied integer;
begin
  if p_event is null or pg_catalog.jsonb_typeof(p_event) is distinct from 'object'
     or length(p_event::text)>300000 or p_event->>'schemaVersion'<>'1.0.0' then
    raise exception 'Unsupported sync event';
  end if;
  v_origin := p_event->>'origin';
  select origin into v_local from payment_sync.settings where singleton;
  if v_origin is null or v_origin not in ('TAXPAY_SQL','OFFICE_SQL') or v_origin=v_local then
    raise exception 'Cross-project event origin invalid';
  end if;
  if coalesce(p_event->>'eventId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(p_event->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Sync event IDs invalid';
  end if;
  if pg_catalog.jsonb_typeof(p_event->'revision') is distinct from 'number'
     or coalesce(p_event->>'revision','') !~ '^[1-9][0-9]{0,8}$' then
    raise exception 'Sync revision invalid';
  end if;
  if pg_catalog.jsonb_typeof(p_event->'payload') is distinct from 'object'
     or length(coalesce(p_event->>'occurredAt',''))<20 then
    raise exception 'Sync payload or timestamp invalid';
  end if;
  v_type := p_event->>'eventType';
  if v_type is null or v_type not in ('REQUEST_CREATED','REQUEST_UPDATED','REQUEST_CANCELLED',
    'PROVIDER_UPDATE','TREASURY_VERIFIED','CREDIT_POSTED','REVERSAL_RECORDED','OFFICER_ACTION','NOTIFICATION_CREATED') then
    raise exception 'Sync event type invalid';
  end if;
  v_id := (p_event->>'eventId')::uuid;
  v_request_id := (p_event->>'requestId')::uuid;
  v_revision := (p_event->>'revision')::integer;
  v_fingerprint := pg_catalog.md5(p_event::text);
  insert into payment_sync.inbox_events
    (event_id,source_origin,request_id,source_revision,event_type,event_fingerprint,event_payload,occurred_at)
  values(v_id,v_origin,v_request_id,v_revision,v_type,v_fingerprint,
    p_event->'payload',(p_event->>'occurredAt')::timestamptz)
  on conflict(event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then
    select event_fingerprint into v_previous from payment_sync.inbox_events where event_id=v_id;
    if v_previous<>v_fingerprint then raise exception 'Conflicting event ID replay'; end if;
  end if;
  v_applied := payment_sync.apply_pending(v_origin,v_request_id);
  return pg_catalog.jsonb_build_object('eventId',v_id,'stored',true,
    'duplicate',v_inserted=0,'appliedInBatch',v_applied);
end;
$$;

create function public.payment_v1_internal_claim(p_limit integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid batch size'; end if;
  with ready as (
    select o.event_id from payment_sync.outbox o
    where o.delivery_state<>'ACKNOWLEDGED' and o.next_attempt_at<=now()
    order by o.created_at,o.event_id limit p_limit for update skip locked
  ), claimed as (
    update payment_sync.outbox o set delivery_state='IN_FLIGHT',
      attempts=o.attempts+1,next_attempt_at=now()+interval '2 minutes',
      claim_token=gen_random_uuid()
    from ready where o.event_id=ready.event_id
    returning o.event_id,o.claim_token,o.attempts
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'claimToken',c.claim_token,'attempts',c.attempts,
      'event',pg_catalog.jsonb_build_object(
        'schemaVersion',e.schema_version,'eventId',e.event_id,'requestId',e.request_id,
        'origin',e.origin,'eventType',e.event_type,'revision',e.source_revision,
        'occurredAt',e.occurred_at,
        'payload',e.event_payload || pg_catalog.jsonb_build_object('createdBy',r.created_by))
    )),'[]'::jsonb) into v_result
  from claimed c join payment_sync.events e on e.event_id=c.event_id
    join payment_sync.requests r on r.id=e.request_id;
  return v_result;
end;
$$;

create function public.payment_v1_internal_ack(
  p_event_id uuid,p_claim_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_updated uuid;
begin
  if p_success is null then raise exception 'Delivery result required'; end if;
  update payment_sync.outbox set
    delivery_state=case when p_success then 'ACKNOWLEDGED' else 'FAILED' end,
    acknowledged_at=case when p_success then now() else null end,
    last_error=case when p_success then null else left(coalesce(p_error,'Delivery failed'),500) end,
    next_attempt_at=case when p_success then next_attempt_at
      else now()+pg_catalog.make_interval(secs=>least(3600,5*(2^least(attempts,9))::integer)) end,
    claim_token=null
  where event_id=p_event_id and claim_token=p_claim_token and delivery_state='IN_FLIGHT'
  returning event_id into v_updated;
  if v_updated is null then raise exception 'Unknown or stale delivery claim'; end if;
  return true;
end;
$$;

create function public.payment_v1_internal_health() returns jsonb
language sql stable security definer set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'origin',(select origin from payment_sync.settings where singleton),
    'pendingOutbox',(select count(*) from payment_sync.outbox where delivery_state<>'ACKNOWLEDGED'),
    'failedOutbox',(select count(*) from payment_sync.outbox where delivery_state='FAILED'),
    'pendingInbox',(select count(*) from payment_sync.inbox_events where applied_at is null),
    'mirroredRequests',(select count(*) from payment_sync.mirrored_requests),
    'crossProjectNotices',(select count(*) from payment_sync.cross_project_notifications)
  );
$$;

alter table payment_sync.inbox_events enable row level security;
alter table payment_sync.mirrored_requests enable row level security;
alter table payment_sync.cross_project_notifications enable row level security;
revoke all on all tables in schema payment_sync from public,anon,authenticated;
revoke all on function payment_sync.apply_pending(text,uuid) from public,anon,authenticated;
revoke all on function public.payment_v1_internal_ingest(jsonb) from public,anon,authenticated;
revoke all on function public.payment_v1_internal_claim(integer) from public,anon,authenticated;
revoke all on function public.payment_v1_internal_ack(uuid,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.payment_v1_internal_health() from public,anon,authenticated;
grant execute on function public.payment_v1_internal_ingest(jsonb) to service_role;
grant execute on function public.payment_v1_internal_claim(integer) to service_role;
grant execute on function public.payment_v1_internal_ack(uuid,uuid,boolean,text) to service_role;
grant execute on function public.payment_v1_internal_health() to service_role;
