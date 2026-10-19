-- NBR TaxPay ↔ Office Management: additive API-only checkpoint.
-- Apply identically to both selected payment databases. No UI changes.
-- All requests remain simulation_only; no settlement/credit authority is granted.

create table if not exists payment_sync.request_mutations (
  mutation_id uuid primary key default gen_random_uuid(),
  request_id uuid not null references payment_sync.requests(id),
  actor_uid uuid not null references auth.users(id),
  idempotency_key uuid not null,
  action_code text not null check (action_code in ('CANCEL_REQUEST')),
  event_id uuid not null references payment_sync.events(event_id),
  reason text,
  created_at timestamptz not null default now(),
  unique (request_id,actor_uid,idempotency_key),
  unique (event_id)
);
create index if not exists payment_request_mutations_by_actor
  on payment_sync.request_mutations(actor_uid,created_at desc);
alter table payment_sync.request_mutations enable row level security;
revoke all on payment_sync.request_mutations from public,anon,authenticated;

create or replace function public.payment_v1_cancel_request(
  p_request_id uuid,p_idempotency_key uuid,p_reason text default null
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_actor uuid := auth.uid();
  v_row payment_sync.requests%rowtype;
  v_existing payment_sync.request_mutations%rowtype;
  v_event_id uuid;
  v_target text;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  if p_request_id is null or p_idempotency_key is null then
    raise exception 'Request and idempotency identifiers required';
  end if;
  if p_reason is not null and length(pg_catalog.btrim(p_reason)) > 500 then
    raise exception 'Reason too long';
  end if;
  select * into v_row from payment_sync.requests where id=p_request_id for update;
  if not found or v_row.created_by<>v_actor then
    raise exception 'Payment request not found';
  end if;
  select * into v_existing from payment_sync.request_mutations
    where request_id=p_request_id and actor_uid=v_actor and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.action_code<>'CANCEL_REQUEST' or
       v_existing.reason is distinct from nullif(pg_catalog.btrim(p_reason),'') then
      raise exception 'Idempotency key used for a different mutation';
    end if;
    return pg_catalog.jsonb_build_object('requestId',p_request_id,'eventId',v_existing.event_id,
      'requestState','CANCELLED','replayed',true);
  end if;
  if v_row.request_state<>'REQUESTED' or v_row.settlement_state<>'NOT_STARTED' or
     v_row.credit_state not in ('NOT_CREDITED','NOT_APPLICABLE') then
    raise exception 'Payment request cannot be cancelled in its current state';
  end if;
  update payment_sync.requests set request_state='CANCELLED',revision=revision+1
    where id=p_request_id returning * into v_row;
  insert into payment_sync.events(request_id,source_revision,origin,event_type,actor_uid,event_payload)
    values(p_request_id,v_row.revision,v_row.origin,'REQUEST_CANCELLED',v_actor,
      pg_catalog.jsonb_build_object('snapshot',pg_catalog.jsonb_build_object(
        'requestId',v_row.id,'revision',v_row.revision,'initiatorKind',v_row.initiator_kind,
        'input',v_row.input,'totalMinor',v_row.total_minor,'simulationOnly',v_row.simulation_only,
        'requestState',v_row.request_state,'settlementState',v_row.settlement_state,
        'creditState',v_row.credit_state),'reason',nullif(pg_catalog.btrim(p_reason),'')))
    returning event_id into v_event_id;
  insert into payment_sync.request_mutations(request_id,actor_uid,idempotency_key,
    action_code,event_id,reason) values(p_request_id,v_actor,p_idempotency_key,
      'CANCEL_REQUEST',v_event_id,nullif(pg_catalog.btrim(p_reason),''));
  v_target := case when v_row.origin='TAXPAY_SQL' then 'OFFICE_SQL' else 'TAXPAY_SQL' end;
  insert into payment_sync.outbox(event_id,target) values(v_event_id,v_target);
  insert into payment_sync.notifications(recipient_uid,request_id,event_id,message_code)
    values(v_actor,p_request_id,v_event_id,'REQUEST_CANCELLED');
  return pg_catalog.jsonb_build_object('requestId',p_request_id,'eventId',v_event_id,
    'requestState','CANCELLED','replayed',false);
end;
$function$;

create or replace function public.payment_v1_request_activity(
  p_request_id uuid,p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  v_actor uuid := auth.uid(); v_origin text; v_is_officer boolean;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'Authenticated session required'; end if;
  if p_limit is null or p_limit not between 1 and 200 then raise exception 'Invalid page size'; end if;
  select origin into v_origin from payment_sync.settings where singleton;
  select exists(select 1 from payment_sync.officer_roles a
    where a.user_uid=v_actor and a.active and a.role in ('MAKER','REVIEWER','APPROVER'))
    into v_is_officer;
  if exists(select 1 from payment_sync.requests r where r.id=p_request_id
    and (r.created_by=v_actor or (v_origin='OFFICE_SQL' and v_is_officer))) then
    select coalesce(pg_catalog.jsonb_agg(x.obj order by x.occurred_at,x.revision),'[]'::jsonb)
    into v_result from (
      select e.occurred_at,e.source_revision as revision,
        pg_catalog.jsonb_build_object('eventId',e.event_id,'eventType',e.event_type,
          'revision',e.source_revision,'occurredAt',e.occurred_at,
          'sourceOrigin',e.origin,'payload',e.event_payload) obj
      from payment_sync.events e where e.request_id=p_request_id
      order by e.source_revision desc limit p_limit
    ) x;
    return v_result;
  end if;
  if v_origin='OFFICE_SQL' and v_is_officer and
    exists(select 1 from payment_sync.mirrored_requests m
      where m.request_id=p_request_id and m.source_origin='TAXPAY_SQL') then
    select coalesce(pg_catalog.jsonb_agg(x.obj order by x.occurred_at,x.revision),'[]'::jsonb)
    into v_result from (
      select e.occurred_at,e.source_revision as revision,
        pg_catalog.jsonb_build_object('eventId',e.event_id,'eventType',e.event_type,
          'revision',e.source_revision,'occurredAt',e.occurred_at,
          'sourceOrigin',e.source_origin,'payload',e.event_payload) obj
      from payment_sync.inbox_events e where e.request_id=p_request_id
        and e.source_origin='TAXPAY_SQL' and e.applied_at is not null
      order by e.source_revision desc limit p_limit
    ) x;
    return v_result;
  end if;
  raise exception 'Payment request not found';
end;
$function$;

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
        'creditState',m.credit_state,'revision',m.revision,
        'updatedAt',m.updated_at) obj
    from payment_sync.mirrored_requests m where m.source_origin='TAXPAY_SQL'
    order by m.updated_at desc,m.request_id limit p_limit
  ) x;
  return v_result;
end;
$function$;

revoke all on function public.payment_v1_cancel_request(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.payment_v1_request_activity(uuid,integer) from public,anon,authenticated;
revoke all on function public.payment_v1_office_inbox(integer) from public,anon,authenticated;
grant execute on function public.payment_v1_cancel_request(uuid,uuid,text) to authenticated;
grant execute on function public.payment_v1_request_activity(uuid,integer) to authenticated;
grant execute on function public.payment_v1_office_inbox(integer) to authenticated;
