-- Office-owned requests have their authoritative review decisions in Office SQL.
-- TaxPay-owned requests use the separate HMAC command channel in Phase 4.
-- Both paths emit OFFICER_ACTION revisions through payment-sync-bridge.

create table if not exists payment_sync.local_officer_decisions (
  decision_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references payment_sync.requests(id),
  officer_uid uuid not null references auth.users(id),
  officer_role text not null check (officer_role in ('MAKER','REVIEWER','APPROVER')),
  action_code text not null check (action_code in
    ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY','APPROVER_CLOSE','REJECT')),
  reason text,
  idempotency_key uuid not null,
  event_id uuid not null unique references payment_sync.events(event_id),
  created_at timestamptz not null default now(),
  unique (request_id,officer_uid,idempotency_key)
);
create index if not exists payment_v1_local_decisions_request_idx
  on payment_sync.local_officer_decisions(request_id,action_code,created_at);
create index if not exists payment_v1_local_decisions_actor_idx
  on payment_sync.local_officer_decisions(officer_uid,created_at);
alter table payment_sync.local_officer_decisions enable row level security;
revoke all on payment_sync.local_officer_decisions from public,anon,authenticated;

create or replace function public.payment_v1_office_local_action(
  p_request_id uuid,p_action text,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_actor uuid := auth.uid(); v_origin text; v_role text;
  v_req payment_sync.requests%rowtype;
  v_previous payment_sync.local_officer_decisions%rowtype;
  v_reason text := nullif(pg_catalog.btrim(p_reason),'');
  v_expected text; v_new_state text; v_event uuid;
begin
  select origin into v_origin from payment_sync.settings where singleton;
  if v_actor is null or v_origin<>'OFFICE_SQL' then
    raise exception 'Authenticated Office officer required'; end if;
  if p_request_id is null or p_idempotency_key is null then
    raise exception 'Request and idempotency identifiers required'; end if;
  if p_action is null or p_action not in
    ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY','APPROVER_CLOSE','REJECT') then
    raise exception 'Unsupported officer action'; end if;
  select r.role into v_role from payment_sync.officer_roles r
    where r.user_uid=v_actor and r.active and (
      (p_action='MAKER_ACKNOWLEDGE' and r.role='MAKER') or
      (p_action='REVIEWER_VERIFY' and r.role='REVIEWER') or
      (p_action='APPROVER_CLOSE' and r.role='APPROVER') or
      (p_action='REJECT' and r.role in ('REVIEWER','APPROVER')))
    order by case r.role when 'REVIEWER' then 1 else 2 end limit 1;
  if v_role is null then raise exception 'Officer role cannot perform this action'; end if;
  if length(coalesce(v_reason,''))>1000 or
     (p_action='REJECT' and length(coalesce(v_reason,''))<5) then
    raise exception 'Valid review reason required'; end if;
  select * into v_req from payment_sync.requests r where r.id=p_request_id
    and r.origin='OFFICE_SQL' and r.initiator_kind='OFFICER' for update;
  if not found then raise exception 'Office-owned request not found'; end if;
  select * into v_previous from payment_sync.local_officer_decisions d
    where d.request_id=p_request_id and d.officer_uid=v_actor
      and d.idempotency_key=p_idempotency_key;
  if found then
    if v_previous.action_code<>p_action or v_previous.reason is distinct from v_reason then
      raise exception 'Idempotency key used for a different action'; end if;
    return pg_catalog.jsonb_build_object('requestId',p_request_id,
      'eventId',v_previous.event_id,'replayed',true);
  end if;
  if v_req.request_state in ('CANCELLED','EXPIRED') or
     v_req.review_state in ('APPROVER_CLOSED','REJECTED') then
    raise exception 'Request cannot receive review actions'; end if;
  v_expected := case p_action when 'MAKER_ACKNOWLEDGE' then 'PENDING_OFFICER'
    when 'REVIEWER_VERIFY' then 'MAKER_ACKNOWLEDGED'
    when 'APPROVER_CLOSE' then 'REVIEWER_VERIFIED' else v_req.review_state end;
  if v_expected<>v_req.review_state then raise exception 'Review sequence mismatch'; end if;
  if p_action='REVIEWER_VERIFY' and exists(
    select 1 from payment_sync.local_officer_decisions d where d.request_id=p_request_id
      and d.action_code='MAKER_ACKNOWLEDGE' and d.officer_uid=v_actor) then
    raise exception 'Maker and reviewer must be different officers'; end if;
  if p_action='APPROVER_CLOSE' and exists(
    select 1 from payment_sync.local_officer_decisions d where d.request_id=p_request_id
      and d.action_code in ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY')
      and d.officer_uid=v_actor) then
    raise exception 'Approver must be a separate officer'; end if;
  v_new_state := case p_action when 'MAKER_ACKNOWLEDGE' then 'MAKER_ACKNOWLEDGED'
    when 'REVIEWER_VERIFY' then 'REVIEWER_VERIFIED'
    when 'APPROVER_CLOSE' then 'APPROVER_CLOSED' else 'REJECTED' end;
  update payment_sync.requests set review_state=v_new_state,revision=revision+1
    where id=p_request_id returning * into v_req;
  insert into payment_sync.events(request_id,source_revision,origin,event_type,
    actor_uid,event_payload)
  values(p_request_id,v_req.revision,'OFFICE_SQL','OFFICER_ACTION',v_actor,
    pg_catalog.jsonb_build_object('officerAction',p_action,'officerUid',v_actor,
      'officerRole',v_role,'reason',v_reason,
      'snapshot',pg_catalog.jsonb_build_object(
        'requestId',v_req.id,'revision',v_req.revision,
        'initiatorKind',v_req.initiator_kind,'input',v_req.input,
        'totalMinor',v_req.total_minor,'simulationOnly',v_req.simulation_only,
        'requestState',v_req.request_state,'settlementState',v_req.settlement_state,
        'creditState',v_req.credit_state,'reviewState',v_req.review_state)))
  returning event_id into v_event;
  insert into payment_sync.local_officer_decisions(request_id,officer_uid,officer_role,
    action_code,reason,idempotency_key,event_id)
    values(p_request_id,v_actor,v_role,p_action,v_reason,p_idempotency_key,v_event);
  insert into payment_sync.outbox(event_id,target) values(v_event,'TAXPAY_SQL');
  insert into payment_sync.notifications(recipient_uid,request_id,event_id,message_code)
    values(v_req.created_by,p_request_id,v_event,'OFFICER_ACTION');
  return pg_catalog.jsonb_build_object('requestId',p_request_id,'eventId',v_event,
    'reviewState',v_new_state,'replayed',false);
end;
$function$;

create or replace function public.payment_v1_my_local_officer_decisions(
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
    into v_result from (
      select d.created_at,pg_catalog.jsonb_build_object(
        'decisionId',d.decision_id,'requestId',d.request_id,'officerUid',d.officer_uid,
        'role',d.officer_role,'action',d.action_code,'reason',d.reason,
        'eventId',d.event_id,'createdAt',d.created_at,'deliveryState',o.delivery_state) obj
      from payment_sync.local_officer_decisions d
      join payment_sync.outbox o on o.event_id=d.event_id
      where p_request_id is null or d.request_id=p_request_id
      order by d.created_at desc limit p_limit
    ) x;
  return v_result;
end;
$function$;

revoke all on function public.payment_v1_office_local_action(uuid,text,text,uuid)
  from public,anon,authenticated;
revoke all on function public.payment_v1_my_local_officer_decisions(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.payment_v1_office_local_action(uuid,text,text,uuid)
  to authenticated;
grant execute on function public.payment_v1_my_local_officer_decisions(uuid,integer)
  to authenticated;
