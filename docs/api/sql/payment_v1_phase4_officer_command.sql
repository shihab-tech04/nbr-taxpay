-- API-only Phase 4: Office-originated reviews of TaxPay-owned request intents.
-- The signed command is advisory/review only: it cannot settle, credit, or issue a challan.
-- This migration is symmetric; origin-specific functions reject calls on the wrong DB.

alter table payment_sync.requests
  add column if not exists review_state text not null default 'PENDING_OFFICER';
alter table payment_sync.mirrored_requests
  add column if not exists review_state text not null default 'PENDING_OFFICER';
alter table payment_sync.requests
  add constraint requests_review_state_v1_check
  check (review_state in ('PENDING_OFFICER','MAKER_ACKNOWLEDGED',
    'REVIEWER_VERIFIED','APPROVER_CLOSED','REJECTED'));
alter table payment_sync.mirrored_requests
  add constraint mirrored_requests_review_state_v1_check
  check (review_state in ('PENDING_OFFICER','MAKER_ACKNOWLEDGED',
    'REVIEWER_VERIFIED','APPROVER_CLOSED','REJECTED'));

create table if not exists payment_sync.control_outbox (
  message_id uuid primary key,
  request_id uuid not null,
  payload jsonb not null check (pg_catalog.jsonb_typeof(payload)='object'),
  target_origin text not null check (target_origin in ('TAXPAY_SQL','OFFICE_SQL')),
  delivery_state text not null default 'PENDING'
    check (delivery_state in ('PENDING','IN_FLIGHT','ACKNOWLEDGED','FAILED')),
  attempts integer not null default 0 check (attempts>=0),
  next_attempt_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  claim_token uuid,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists control_outbox_pending_idx
  on payment_sync.control_outbox(next_attempt_at,created_at)
  where delivery_state<>'ACKNOWLEDGED';

create table if not exists payment_sync.control_inbox (
  message_id uuid primary key,
  request_id uuid not null,
  source_origin text not null check (source_origin='OFFICE_SQL'),
  payload_fingerprint text not null,
  action_code text not null,
  officer_uid uuid not null,
  resulting_revision integer not null check (resulting_revision>1),
  received_at timestamptz not null default now()
);

create table if not exists payment_sync.officer_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  officer_uid uuid not null references auth.users(id),
  officer_role text not null check (officer_role in ('MAKER','REVIEWER','APPROVER')),
  action_code text not null check (action_code in
    ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY','APPROVER_CLOSE','REJECT')),
  reason text,
  idempotency_key uuid not null,
  message_id uuid not null unique references payment_sync.control_outbox(message_id),
  created_at timestamptz not null default now(),
  unique (request_id,officer_uid,idempotency_key)
);
create index if not exists officer_decisions_request_action_idx
  on payment_sync.officer_decisions(request_id,action_code,created_at);

alter table payment_sync.control_outbox enable row level security;
alter table payment_sync.control_inbox enable row level security;
alter table payment_sync.officer_decisions enable row level security;
revoke all on payment_sync.control_outbox from public,anon,authenticated;
revoke all on payment_sync.control_inbox from public,anon,authenticated;
revoke all on payment_sync.officer_decisions from public,anon,authenticated;

create or replace function public.payment_v1_officer_action(
  p_request_id uuid,p_action text,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_actor uuid := auth.uid(); v_origin text; v_role text;
  v_mirror payment_sync.mirrored_requests%rowtype;
  v_prior payment_sync.officer_decisions%rowtype;
  v_message uuid := gen_random_uuid(); v_reason text := nullif(pg_catalog.btrim(p_reason),'');
  v_expected text;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  if p_request_id is null or p_idempotency_key is null then
    raise exception 'Request and idempotency identifiers required'; end if;
  select origin into v_origin from payment_sync.settings where singleton;
  if v_origin<>'OFFICE_SQL' then raise exception 'Office-only review API'; end if;
  if p_action not in ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY','APPROVER_CLOSE','REJECT')
    or p_action is null then raise exception 'Unsupported officer action'; end if;
  select r.role into v_role from payment_sync.officer_roles r
    where r.user_uid=v_actor and r.active and (
      (p_action='MAKER_ACKNOWLEDGE' and r.role='MAKER') or
      (p_action='REVIEWER_VERIFY' and r.role='REVIEWER') or
      (p_action='APPROVER_CLOSE' and r.role='APPROVER') or
      (p_action='REJECT' and r.role in ('REVIEWER','APPROVER')))
    order by case r.role when 'REVIEWER' then 1 else 2 end limit 1;
  if v_role is null then raise exception 'Officer role cannot perform this action'; end if;
  if length(coalesce(v_reason,'')) > 1000 or
     (p_action='REJECT' and length(coalesce(v_reason,''))<5) then
    raise exception 'A valid review reason is required'; end if;
  select * into v_mirror from payment_sync.mirrored_requests
    where request_id=p_request_id and source_origin='TAXPAY_SQL' for update;
  if not found then raise exception 'Synchronized taxpayer request not found'; end if;
  select * into v_prior from payment_sync.officer_decisions d
    where d.request_id=p_request_id and d.officer_uid=v_actor
      and d.idempotency_key=p_idempotency_key;
  if found then
    if v_prior.action_code<>p_action or v_prior.reason is distinct from v_reason then
      raise exception 'Idempotency key used for a different officer action'; end if;
    return pg_catalog.jsonb_build_object('messageId',v_prior.message_id,
      'requestId',p_request_id,'replayed',true);
  end if;
  if v_mirror.request_state in ('CANCELLED','EXPIRED') or
     v_mirror.review_state in ('APPROVER_CLOSED','REJECTED') then
    raise exception 'Request cannot receive additional review actions'; end if;
  v_expected := case p_action when 'MAKER_ACKNOWLEDGE' then 'PENDING_OFFICER'
    when 'REVIEWER_VERIFY' then 'MAKER_ACKNOWLEDGED'
    when 'APPROVER_CLOSE' then 'REVIEWER_VERIFIED' else v_mirror.review_state end;
  if v_mirror.review_state<>v_expected then raise exception 'Review sequence mismatch'; end if;
  if p_action='REVIEWER_VERIFY' and exists(
    select 1 from payment_sync.officer_decisions d
    where d.request_id=p_request_id and d.action_code='MAKER_ACKNOWLEDGE'
      and d.officer_uid=v_actor) then
    raise exception 'Maker and reviewer must be different officers'; end if;
  if p_action='APPROVER_CLOSE' and exists(
    select 1 from payment_sync.officer_decisions d
    where d.request_id=p_request_id and d.action_code in ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY')
      and d.officer_uid=v_actor) then
    raise exception 'Approver must be a separate officer'; end if;
  insert into payment_sync.control_outbox(message_id,request_id,target_origin,payload)
    values(v_message,p_request_id,'TAXPAY_SQL',pg_catalog.jsonb_build_object(
      'schemaVersion','1.0.0','messageId',v_message,'requestId',p_request_id,
      'origin','OFFICE_SQL','action',p_action,'officerUid',v_actor,
      'officerRole',v_role,'reason',v_reason,'expectedReviewState',v_expected,
      'occurredAt',now()));
  insert into payment_sync.officer_decisions(request_id,officer_uid,officer_role,
    action_code,reason,idempotency_key,message_id)
    values(p_request_id,v_actor,v_role,p_action,v_reason,p_idempotency_key,v_message);
  return pg_catalog.jsonb_build_object('messageId',v_message,
    'requestId',p_request_id,'queued',true,'replayed',false);
end;
$function$;

-- Authenticated TaxPay request owners cannot call this service-role-only function.
-- The HMAC-verified command bridge alone may submit an Office review assertion.
create or replace function public.payment_v1_internal_ingest_command(p_command jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_local text; v_message uuid; v_request uuid; v_actor uuid;
  v_action text; v_role text; v_reason text; v_expected text;
  v_fingerprint text; v_previous payment_sync.control_inbox%rowtype;
  v_request_row payment_sync.requests%rowtype;
  v_new_state text; v_event uuid;
begin
  select origin into v_local from payment_sync.settings where singleton;
  if v_local<>'TAXPAY_SQL' then raise exception 'TaxPay-only command ingestion'; end if;
  if p_command is null or pg_catalog.jsonb_typeof(p_command) is distinct from 'object'
     or length(p_command::text)>20000 or p_command->>'schemaVersion'<>'1.0.0'
     or p_command->>'origin'<>'OFFICE_SQL' then
    raise exception 'Invalid signed Office command'; end if;
  if coalesce(p_command->>'messageId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(p_command->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or coalesce(p_command->>'officerUid','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Invalid signed Office identifiers'; end if;
  v_message := (p_command->>'messageId')::uuid;
  v_request := (p_command->>'requestId')::uuid;
  v_actor := (p_command->>'officerUid')::uuid;
  v_action := p_command->>'action';
  v_role := p_command->>'officerRole';
  v_reason := p_command->>'reason';
  v_expected := p_command->>'expectedReviewState';
  v_fingerprint := pg_catalog.md5(p_command::text);
  if v_action not in ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY','APPROVER_CLOSE','REJECT')
     or v_action is null or
     not ((v_action='MAKER_ACKNOWLEDGE' and v_role='MAKER') or
       (v_action='REVIEWER_VERIFY' and v_role='REVIEWER') or
       (v_action='APPROVER_CLOSE' and v_role='APPROVER') or
       (v_action='REJECT' and v_role in ('REVIEWER','APPROVER'))) or
     length(coalesce(v_reason,''))>1000 or
     (v_action='REJECT' and length(coalesce(v_reason,''))<5) then
    raise exception 'Invalid signed Office action'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_message::text,9199));
  select * into v_previous from payment_sync.control_inbox where message_id=v_message;
  if found then
    if v_previous.payload_fingerprint<>v_fingerprint then
      raise exception 'Conflicting signed command replay'; end if;
    return pg_catalog.jsonb_build_object('messageId',v_message,'stored',true,
      'duplicate',true,'revision',v_previous.resulting_revision);
  end if;
  select * into v_request_row from payment_sync.requests where id=v_request
    and origin='TAXPAY_SQL' for update;
  if not found or v_request_row.request_state in ('CANCELLED','EXPIRED')
     or v_request_row.review_state in ('APPROVER_CLOSED','REJECTED') then
    raise exception 'Request cannot receive Office review command'; end if;
  if v_expected is distinct from v_request_row.review_state or
     (v_action='MAKER_ACKNOWLEDGE' and v_expected<>'PENDING_OFFICER') or
     (v_action='REVIEWER_VERIFY' and v_expected<>'MAKER_ACKNOWLEDGED') or
     (v_action='APPROVER_CLOSE' and v_expected<>'REVIEWER_VERIFIED') then
    raise exception 'Signed Office command has stale review state'; end if;
  if v_action='REVIEWER_VERIFY' and exists(
    select 1 from payment_sync.control_inbox c where c.request_id=v_request
      and c.action_code='MAKER_ACKNOWLEDGE' and c.officer_uid=v_actor) then
    raise exception 'Review must be performed by a different officer'; end if;
  if v_action='APPROVER_CLOSE' and exists(
    select 1 from payment_sync.control_inbox c where c.request_id=v_request
      and c.action_code in ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY')
      and c.officer_uid=v_actor) then
    raise exception 'Approver must be a separate officer'; end if;
  v_new_state := case v_action when 'MAKER_ACKNOWLEDGE' then 'MAKER_ACKNOWLEDGED'
    when 'REVIEWER_VERIFY' then 'REVIEWER_VERIFIED'
    when 'APPROVER_CLOSE' then 'APPROVER_CLOSED' else 'REJECTED' end;
  update payment_sync.requests set review_state=v_new_state,revision=revision+1
    where id=v_request returning * into v_request_row;
  insert into payment_sync.events(request_id,source_revision,origin,event_type,
    actor_uid,event_payload)
  values(v_request,v_request_row.revision,'TAXPAY_SQL','OFFICER_ACTION',null,
    pg_catalog.jsonb_build_object('officerAction',v_action,'officerUid',v_actor,
      'officerRole',v_role,'reason',v_reason,'commandMessageId',v_message,
      'snapshot',pg_catalog.jsonb_build_object(
        'requestId',v_request,'revision',v_request_row.revision,
        'initiatorKind',v_request_row.initiator_kind,'input',v_request_row.input,
        'totalMinor',v_request_row.total_minor,'simulationOnly',v_request_row.simulation_only,
        'requestState',v_request_row.request_state,
        'settlementState',v_request_row.settlement_state,
        'creditState',v_request_row.credit_state,'reviewState',v_request_row.review_state)))
  returning event_id into v_event;
  insert into payment_sync.outbox(event_id,target) values(v_event,'OFFICE_SQL');
  insert into payment_sync.notifications(recipient_uid,request_id,event_id,message_code)
    values(v_request_row.created_by,v_request,v_event,'OFFICER_ACTION');
  insert into payment_sync.control_inbox(message_id,request_id,source_origin,
    payload_fingerprint,action_code,officer_uid,resulting_revision)
    values(v_message,v_request,'OFFICE_SQL',v_fingerprint,v_action,v_actor,v_request_row.revision);
  return pg_catalog.jsonb_build_object('messageId',v_message,'stored',true,
    'duplicate',false,'revision',v_request_row.revision,'reviewState',v_new_state);
end;
$function$;

create or replace function payment_sync.wake_command_bridge()
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_config payment_sync.bridge_config%rowtype; v_job bigint;
begin
  select * into v_config from payment_sync.bridge_config where singleton and enabled;
  if not found or not exists(select 1 from payment_sync.control_outbox
      where delivery_state<>'ACKNOWLEDGED' and next_attempt_at<=now()) then
    return null; end if;
  select net.http_post(
    url:=pg_catalog.replace(v_config.self_url,'/payment-sync-bridge','/payment-command-bridge'),
    body:=pg_catalog.jsonb_build_object('mode','dispatch','token',v_config.dispatch_token),
    headers:='{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds:=15000) into v_job;
  return v_job;
end;
$function$;

create or replace function payment_sync.wake_on_command_insert()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  perform payment_sync.wake_command_bridge();
  return new;
end;
$function$;
create trigger payment_command_wake_insert
  after insert on payment_sync.control_outbox for each statement
  execute function payment_sync.wake_on_command_insert();
select cron.schedule('payment-command-v1-dispatch','* * * * *',
  'select payment_sync.wake_command_bridge()');

create or replace function public.payment_v1_my_officer_decisions(
  p_request_id uuid default null,p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_actor uuid := auth.uid(); v_origin text; v_result jsonb;
begin
  select origin into v_origin from payment_sync.settings where singleton;
  if v_actor is null or v_origin<>'OFFICE_SQL' or not exists(
    select 1 from payment_sync.officer_roles r where r.user_uid=v_actor and r.active
      and r.role in ('MAKER','REVIEWER','APPROVER')) then
    raise exception 'Authorized Office officer required'; end if;
  if p_limit is null or p_limit not between 1 and 200 then raise exception 'Invalid page size'; end if;
  select coalesce(pg_catalog.jsonb_agg(x.obj order by x.created_at desc),'[]'::jsonb)
    into v_result from (select d.created_at,pg_catalog.jsonb_build_object(
      'decisionId',d.decision_id,'requestId',d.request_id,'officerUid',d.officer_uid,
      'role',d.officer_role,'action',d.action_code,'reason',d.reason,
      'createdAt',d.created_at,'messageId',d.message_id,
      'deliveryState',o.delivery_state,'attempts',o.attempts,
      'lastError',o.last_error) obj
    from payment_sync.officer_decisions d join payment_sync.control_outbox o
      on o.message_id=d.message_id
    where p_request_id is null or d.request_id=p_request_id
    order by d.created_at desc limit p_limit) x;
  return v_result;
end;
$function$;

create or replace function public.payment_v1_internal_claim_commands(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid batch size'; end if;
  with ready as (
    select o.message_id from payment_sync.control_outbox o
    where o.delivery_state<>'ACKNOWLEDGED' and o.next_attempt_at<=now()
    order by o.created_at,o.message_id limit p_limit for update skip locked
  ), claimed as (
    update payment_sync.control_outbox o set delivery_state='IN_FLIGHT',
      attempts=o.attempts+1,next_attempt_at=now()+interval '2 minutes',
      claim_token=gen_random_uuid()
    from ready where o.message_id=ready.message_id
    returning o.message_id,o.claim_token,o.payload
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'claimToken',c.claim_token,'command',c.payload)),'[]'::jsonb) into v_result
  from claimed c;
  return v_result;
end;
$function$;

create or replace function public.payment_v1_internal_ack_command(
  p_message_id uuid,p_claim_token uuid,p_success boolean,p_error text default null
) returns boolean language plpgsql security definer set search_path to '' as $function$
declare v_id uuid;
begin
  if p_success is null then raise exception 'Delivery result required'; end if;
  update payment_sync.control_outbox set
    delivery_state=case when p_success then 'ACKNOWLEDGED' else 'FAILED' end,
    acknowledged_at=case when p_success then now() else null end,
    last_error=case when p_success then null else left(coalesce(p_error,'Delivery failed'),500) end,
    next_attempt_at=case when p_success then next_attempt_at
      else now()+pg_catalog.make_interval(secs=>least(3600,5*(2^least(attempts,9))::integer)) end,
    claim_token=null
  where message_id=p_message_id and claim_token=p_claim_token and delivery_state='IN_FLIGHT'
  returning message_id into v_id;
  if v_id is null then raise exception 'Unknown or stale command claim'; end if;
  return true;
end;
$function$;

revoke all on function public.payment_v1_officer_action(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.payment_v1_my_officer_decisions(uuid,integer) from public,anon,authenticated;
grant execute on function public.payment_v1_officer_action(uuid,text,text,uuid) to authenticated;
grant execute on function public.payment_v1_my_officer_decisions(uuid,integer) to authenticated;
revoke all on function public.payment_v1_internal_claim_commands(integer) from public,anon,authenticated;
revoke all on function public.payment_v1_internal_ack_command(uuid,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.payment_v1_internal_ingest_command(jsonb) from public,anon,authenticated;
grant execute on function public.payment_v1_internal_claim_commands(integer) to service_role;
grant execute on function public.payment_v1_internal_ack_command(uuid,uuid,boolean,text) to service_role;
grant execute on function public.payment_v1_internal_ingest_command(jsonb) to service_role;
revoke all on function payment_sync.wake_command_bridge() from public,anon,authenticated;
revoke all on function payment_sync.wake_on_command_insert() from public,anon,authenticated;
