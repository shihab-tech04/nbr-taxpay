-- API-only Phase 4 read projections for the additive review state.
-- Replaces the existing mirrored inbox projection with strict review event validation.

CREATE OR REPLACE FUNCTION payment_sync.apply_pending(p_origin text, p_request_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_review_state text;
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
      v_review_state := coalesce(v_snapshot->>'reviewState',v_m.review_state);
      if v_request_state not in ('REQUESTED','AWAITING_PAYMENT','CANCELLED','EXPIRED')
         or v_settlement_state not in ('NOT_STARTED','PROVIDER_PENDING','PROVIDER_FAILED','PROVIDER_CONFIRMED','GOVERNMENT_RECEIVED','RECONCILED','REVERSED')
         or v_credit_state not in ('NOT_APPLICABLE','NOT_CREDITED','CREDITED','CREDIT_REVERSED')
         or v_review_state not in ('PENDING_OFFICER','MAKER_ACKNOWLEDGED',
           'REVIEWER_VERIFIED','APPROVER_CLOSED','REJECTED') then
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
      if v_m.review_state<>v_review_state and v_e.event_type<>'OFFICER_ACTION' then
        raise exception 'Review change needs an officer action event';
      end if;
      update payment_sync.mirrored_requests set request_state=v_request_state,
        settlement_state=v_settlement_state,credit_state=v_credit_state,
        review_state=v_review_state,
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
$function$
;

CREATE OR REPLACE FUNCTION public.payment_v1_get_request(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'creditState',r.credit_state,'reviewState',r.review_state,'totalMinor',r.total_minor,'revision',r.revision,
    'createdAt',r.created_at,'simulationOnly',r.simulation_only
  ) into v_result
  from payment_sync.requests r
  where r.id=p_id and (r.created_by=v_actor or (v_origin='OFFICE_SQL' and v_is_officer));
  if v_result is null then raise exception 'Payment request not found'; end if;
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.payment_v1_my_requests(p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      'creditState',r.credit_state,'reviewState',r.review_state,'totalMinor',r.total_minor,'revision',r.revision,
      'createdAt',r.created_at,'simulationOnly',r.simulation_only
    ) as obj
    from payment_sync.requests r
    where r.created_by=v_actor or (v_origin='OFFICE_SQL' and v_is_officer)
    order by r.created_at desc,r.id desc limit p_limit
  ) x;
  return v_result;
end;
$function$
;

create or replace function public.payment_v1_office_inbox(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_actor uuid := auth.uid(); v_origin text; v_result jsonb;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  if p_limit is null or p_limit not between 1 and 200 then raise exception 'Invalid page size'; end if;
  select origin into v_origin from payment_sync.settings where singleton;
  if v_origin<>'OFFICE_SQL' or not exists(select 1 from payment_sync.officer_roles r
    where r.user_uid=v_actor and r.active and r.role in ('MAKER','REVIEWER','APPROVER')) then
    raise exception 'Authorized Office officer required';
  end if;
  select coalesce(pg_catalog.jsonb_agg(x.obj order by x.updated_at desc,x.request_id),'[]'::jsonb)
  into v_result from (
    select m.request_id,m.updated_at,
      pg_catalog.jsonb_build_object('requestId',m.request_id,
        'sourceOrigin',m.source_origin,'initiatorKind',m.initiator_kind,
        'serviceCode',m.service_code,'input',m.input,'totalMinor',m.total_minor,
        'requestState',m.request_state,'settlementState',m.settlement_state,
        'creditState',m.credit_state,'reviewState',m.review_state,'revision',m.revision,
        'updatedAt',m.updated_at) obj
    from payment_sync.mirrored_requests m where m.source_origin='TAXPAY_SQL'
    order by m.updated_at desc,m.request_id limit p_limit
  ) x;
  return v_result;
end;
$function$;

