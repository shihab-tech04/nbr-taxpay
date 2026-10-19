-- NBR TaxPay v11: isolated end-to-end simulated transaction API for handoff.
-- This schema never charges money, creates challans, or posts tax credit.
-- Existing authenticated sim_* and payment_v1_* contracts remain untouched.

create schema if not exists taxpay_handoff;
revoke all on schema taxpay_handoff from public,anon,authenticated;

create table if not exists taxpay_handoff.requests (
 id uuid primary key default gen_random_uuid(),
 public_reference text not null unique,
 idempotency_key uuid not null unique,
 request_fingerprint text not null,
 session_id uuid not null,
 service_code text not null check (service_code in (
   'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
   'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX')),
 amount_minor bigint not null check (amount_minor between 1 and 1000000000000),
 assessment_year text,
 tin_provided boolean not null default false,
 reference_provided boolean not null default false,
 lifecycle_state text not null default 'PENDING'
   check (lifecycle_state in ('PENDING','SIMULATED','FAILED','REVERSED')),
 review_state text not null default 'PENDING_OFFICER'
   check (review_state in ('PENDING_OFFICER','MAKER_ACKNOWLEDGED',
      'REVIEWER_VERIFIED','APPROVER_CLOSED')),
 simulation_only boolean not null default true check (simulation_only),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((service_code='TRAVEL_TAX' and assessment_year is null)
        or (service_code<>'TRAVEL_TAX' and assessment_year ~ '^20[0-9]{2}-[0-9]{2}$'))
);
create index if not exists taxpay_handoff_session_idx
 on taxpay_handoff.requests(session_id,created_at desc);
create index if not exists taxpay_handoff_inbox_idx
 on taxpay_handoff.requests(created_at desc,id);

create table if not exists taxpay_handoff.events (
 event_id bigint generated always as identity primary key,
 request_id uuid not null references taxpay_handoff.requests(id),
 event_type text not null,
 actor_code text,
 detail text not null,
 created_at timestamptz not null default now()
);
create index if not exists taxpay_handoff_event_request_idx
 on taxpay_handoff.events(request_id,event_id);

create table if not exists taxpay_handoff.decisions (
 id bigint generated always as identity primary key,
 request_id uuid not null references taxpay_handoff.requests(id),
 role_code text not null check (role_code in ('MAKER','REVIEWER','APPROVER')),
 actor_code text not null,
 action_code text not null,
 reason text not null,
 idempotency_key uuid not null unique,
 previous_state text not null,
 next_state text not null,
 created_at timestamptz not null default now(),
 unique(request_id,role_code),
 unique(request_id,actor_code)
);
create index if not exists taxpay_handoff_decision_request_idx
 on taxpay_handoff.decisions(request_id,created_at);

create table if not exists taxpay_handoff.lifecycle_decisions (
 id bigint generated always as identity primary key,
 request_id uuid not null references taxpay_handoff.requests(id),
 action_code text not null,
 actor_code text not null,
 idempotency_key uuid not null unique,
 previous_state text not null,
 next_state text not null,
 created_at timestamptz not null default now()
);
create index if not exists taxpay_handoff_state_request_idx
 on taxpay_handoff.lifecycle_decisions(request_id,created_at);

create table if not exists taxpay_handoff.notifications (
 notice_id bigint generated always as identity primary key,
 request_id uuid not null references taxpay_handoff.requests(id),
 session_id uuid not null,
 event_code text not null,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists taxpay_handoff_notice_session_idx
 on taxpay_handoff.notifications(session_id,created_at desc);

alter table taxpay_handoff.requests enable row level security;
alter table taxpay_handoff.events enable row level security;
alter table taxpay_handoff.decisions enable row level security;
alter table taxpay_handoff.lifecycle_decisions enable row level security;
alter table taxpay_handoff.notifications enable row level security;
revoke all on all tables in schema taxpay_handoff from public,anon,authenticated;
revoke all on all sequences in schema taxpay_handoff from public,anon,authenticated;

-- A random session UUID scopes fictional guest history; not a taxpayer identity.
-- Raw TIN and external reference inputs are validated but NEVER persisted.
create or replace function public.taxpay_v11_handoff_submit(p_input jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_key uuid;v_session uuid;v_service text;v_year text;
 v_minor bigint;v_tin text;v_reference text;v_fp text;
 v_existing taxpay_handoff.requests%rowtype;v_new taxpay_handoff.requests%rowtype;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or
    length(p_input::text)>2048 or
    exists(select 1 from jsonb_object_keys(p_input) k(key)
      where k.key not in ('service','amountMinor','assessmentYear',
        'tin','reference','sessionId','idempotencyKey')) then
   raise exception 'INVALID_HANDOFF_REQUEST';
 end if;
 if coalesce(p_input->>'sessionId','') !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or coalesce(p_input->>'idempotencyKey','') !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then raise exception 'INVALID_HANDOFF_KEY'; end if;
 v_key:=(p_input->>'idempotencyKey')::uuid;
 v_session:=(p_input->>'sessionId')::uuid;
 v_service:=p_input->>'service';
 v_year:=nullif(p_input->>'assessmentYear','');
 v_tin:=coalesce(p_input->>'tin','');
 v_reference:=coalesce(p_input->>'reference','');
 if v_service is null or v_service not in ('TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND',
   'PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL',
   'OTHER_TAX_PAYMENT','TRAVEL_TAX') or
   coalesce(p_input->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$'
 then raise exception 'INVALID_HANDOFF_SERVICE_OR_AMOUNT'; end if;
 v_minor:=(p_input->>'amountMinor')::bigint;
 if v_minor>1000000000000 then raise exception 'INVALID_HANDOFF_AMOUNT'; end if;
 if v_service='TRAVEL_TAX' then
   if v_year is not null then raise exception 'TRAVEL_TAX_HAS_NO_ASSESSMENT_YEAR'; end if;
 elsif v_year is null or v_year !~ '^20[0-9]{2}-[0-9]{2}$' or
   v_tin !~ '^(DEMO-TIN-[0-9]{3}|[0-9]{12})$' then
   raise exception 'INVALID_HANDOFF_TAX_YEAR_OR_TIN';
 end if;
 if v_service='OTHER_TAX_PAYMENT' and
   length(btrim(v_reference)) not between 1 and 80 then
   raise exception 'REFERENCE_REQUIRED'; end if;
 if length(v_tin)>20 or length(v_reference)>80 then
   raise exception 'INVALID_HANDOFF_FIELD_SIZE'; end if;
 v_fp:=md5(p_input::text);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key::text,0));
 select * into v_existing from taxpay_handoff.requests where idempotency_key=v_key;
 if found then
   if v_existing.request_fingerprint<>v_fp then
     raise exception 'IDEMPOTENCY_COLLISION'; end if;
   return jsonb_build_object('requestId',v_existing.id,
      'reference',v_existing.public_reference,'state',v_existing.lifecycle_state,
      'reviewState',v_existing.review_state,'totalMinor',v_existing.amount_minor,
      'simulationOnly',true,'replayed',true);
 end if;
 insert into taxpay_handoff.requests
   (public_reference,idempotency_key,request_fingerprint,session_id,service_code,
    amount_minor,assessment_year,tin_provided,reference_provided)
 values('HND-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  v_key,v_fp,v_session,v_service,v_minor,v_year,v_tin<>'',v_reference<>'')
 returning * into v_new;
 insert into taxpay_handoff.events(request_id,event_type,detail)
 values(v_new.id,'REQUEST_CREATED','Synthetic payment request recorded');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(v_new.id,v_session,'REQUEST_CREATED');
 return jsonb_build_object('requestId',v_new.id,
   'reference',v_new.public_reference,'state','PENDING','reviewState','PENDING_OFFICER',
   'totalMinor',v_minor,'simulationOnly',true,'replayed',false);
end;
$function$;

create or replace function public.taxpay_v11_handoff_get(p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v taxpay_handoff.requests%rowtype;
begin
 select * into v from taxpay_handoff.requests where id=p_request_id;
 if not found then raise exception 'UNKNOWN_HANDOFF_REQUEST'; end if;
 return jsonb_build_object('requestId',v.id,'reference',v.public_reference,
   'service',v.service_code,'assessmentYear',v.assessment_year,
   'totalMinor',v.amount_minor,'state',v.lifecycle_state,
   'reviewState',v.review_state,'simulationOnly',true,
   'createdAt',v.created_at,'updatedAt',v.updated_at,
   'events',coalesce((select jsonb_agg(jsonb_build_object('type',e.event_type,
      'actor',e.actor_code,'detail',e.detail,'at',e.created_at) order by e.event_id)
      from taxpay_handoff.events e where e.request_id=v.id),'[]'::jsonb));
end;
$function$;

create or replace function public.taxpay_v11_handoff_history(
 p_session_id uuid,p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_result jsonb;
begin
 if p_session_id is null or p_limit not between 1 and 100 then
    raise exception 'INVALID_HISTORY_QUERY'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'requestId',r.id,'reference',r.public_reference,'service',r.service_code,
   'totalMinor',r.amount_minor,'state',r.lifecycle_state,
   'reviewState',r.review_state,'simulationOnly',true,'createdAt',r.created_at)
   order by r.created_at desc,r.id),'[]'::jsonb) into v_result
 from (select * from taxpay_handoff.requests where session_id=p_session_id
   order by created_at desc,id limit p_limit) r;
 return v_result;
end;
$function$;

-- Office handoff inbox contains ONLY fictional requests and masked capability
-- data; no raw TIN, bank account, gateway token or taxpayer PII is stored.
create or replace function public.taxpay_v11_handoff_office_inbox(
 p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_result jsonb;
begin
 if p_limit not between 1 and 100 then raise exception 'INVALID_INBOX_QUERY'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'requestId',r.id,'reference',r.public_reference,'service',r.service_code,
   'totalMinor',r.amount_minor,'state',r.lifecycle_state,
   'reviewState',r.review_state,'assessmentYear',r.assessment_year,
   'simulationOnly',true,'createdAt',r.created_at)
   order by r.created_at desc,r.id),'[]'::jsonb) into v_result
 from (select * from taxpay_handoff.requests
   order by created_at desc,id limit p_limit) r;
 return v_result;
end;
$function$;

create or replace function public.taxpay_v11_handoff_office_action(
 p_request_id uuid,p_role text,p_actor_code text,
 p_action text,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v taxpay_handoff.requests%rowtype;
 v_old taxpay_handoff.decisions%rowtype;v_next text;v_expected text;
begin
 if p_request_id is null or p_idempotency_key is null or
   p_role is null or p_action is null or p_actor_code is null or
   p_actor_code !~ '^[A-Za-z0-9_-]{3,30}$' or
   length(btrim(coalesce(p_reason,''))) not between 5 and 500 or
   not ((p_role='MAKER' and p_action='MAKER_ACKNOWLEDGE')
     or (p_role='REVIEWER' and p_action='REVIEWER_VERIFY')
     or (p_role='APPROVER' and p_action='APPROVER_CLOSE'))
 then raise exception 'INVALID_HANDOFF_OFFICER_ACTION'; end if;
 select * into v from taxpay_handoff.requests where id=p_request_id for update;
 if not found then raise exception 'UNKNOWN_HANDOFF_REQUEST'; end if;
 select * into v_old from taxpay_handoff.decisions where idempotency_key=p_idempotency_key;
 if found then
   if v_old.request_id=p_request_id and v_old.actor_code=p_actor_code and
     v_old.action_code=p_action and v_old.reason=p_reason then
     return jsonb_build_object('reviewState',v_old.next_state,'replayed',true); end if;
   raise exception 'IDEMPOTENCY_COLLISION';
 end if;
 if exists(select 1 from taxpay_handoff.decisions
     where request_id=p_request_id and actor_code=p_actor_code) then
     raise exception 'OFFICER_SEPARATION_REQUIRED'; end if;
 if v.lifecycle_state<>'PENDING' then raise exception 'REQUEST_ALREADY_RESOLVED'; end if;
 if p_role='MAKER' then v_expected:='PENDING_OFFICER';v_next:='MAKER_ACKNOWLEDGED';
 elsif p_role='REVIEWER' then v_expected:='MAKER_ACKNOWLEDGED';v_next:='REVIEWER_VERIFIED';
 else v_expected:='REVIEWER_VERIFIED';v_next:='APPROVER_CLOSED';end if;
 if v.review_state<>v_expected then raise exception 'REVIEW_OUT_OF_SEQUENCE'; end if;
 update taxpay_handoff.requests set review_state=v_next,updated_at=now()
   where id=p_request_id;
 insert into taxpay_handoff.decisions
  (request_id,role_code,actor_code,action_code,reason,idempotency_key,
   previous_state,next_state)
 values(p_request_id,p_role,p_actor_code,p_action,p_reason,p_idempotency_key,
   v.review_state,v_next);
 insert into taxpay_handoff.events(request_id,event_type,actor_code,detail)
 values(p_request_id,p_action,p_actor_code,p_reason);
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(p_request_id,v.session_id,p_action);
 return jsonb_build_object('reviewState',v_next,'replayed',false,'simulationOnly',true);
end;
$function$;

create or replace function public.taxpay_v11_handoff_finish(
 p_request_id uuid,p_actor_code text,p_action text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v taxpay_handoff.requests%rowtype;
 v_old taxpay_handoff.lifecycle_decisions%rowtype;v_next text;
begin
 if p_request_id is null or p_idempotency_key is null or
    p_action is null or p_actor_code is null or
    p_actor_code !~ '^[A-Za-z0-9_-]{3,30}$' or
    p_action not in ('COMPLETE_SIMULATION','FAIL_SIMULATION','REVERSE_SIMULATION')
 then raise exception 'INVALID_HANDOFF_LIFECYCLE_ACTION'; end if;
 select * into v from taxpay_handoff.requests where id=p_request_id for update;
 if not found then raise exception 'UNKNOWN_HANDOFF_REQUEST'; end if;
 select * into v_old from taxpay_handoff.lifecycle_decisions
   where idempotency_key=p_idempotency_key;
 if found then
   if v_old.request_id=p_request_id and v_old.actor_code=p_actor_code and
      v_old.action_code=p_action then
     return jsonb_build_object('state',v_old.next_state,'replayed',true); end if;
   raise exception 'IDEMPOTENCY_COLLISION';
 end if;
 if v.review_state<>'APPROVER_CLOSED' or
   not exists(select 1 from taxpay_handoff.decisions
      where request_id=p_request_id and role_code='APPROVER'
        and actor_code=p_actor_code) then
     raise exception 'APPROVER_REVIEW_REQUIRED';end if;
 if v.lifecycle_state='PENDING' and p_action='COMPLETE_SIMULATION'
   then v_next:='SIMULATED';
 elsif v.lifecycle_state='PENDING' and p_action='FAIL_SIMULATION'
   then v_next:='FAILED';
 elsif v.lifecycle_state='SIMULATED' and p_action='REVERSE_SIMULATION'
   then v_next:='REVERSED';
 else raise exception 'INVALID_HANDOFF_STATE_TRANSITION'; end if;
 update taxpay_handoff.requests set lifecycle_state=v_next,updated_at=now()
   where id=p_request_id;
 insert into taxpay_handoff.lifecycle_decisions
   (request_id,action_code,actor_code,idempotency_key,previous_state,next_state)
 values(p_request_id,p_action,p_actor_code,p_idempotency_key,v.lifecycle_state,v_next);
 insert into taxpay_handoff.events(request_id,event_type,actor_code,detail)
 values(p_request_id,p_action,p_actor_code,'Fictional internal transaction lifecycle');
 insert into taxpay_handoff.notifications(request_id,session_id,event_code)
 values(p_request_id,v.session_id,p_action);
 return jsonb_build_object('state',v_next,'replayed',false,'simulationOnly',true);
end;
$function$;

create or replace function public.taxpay_v11_handoff_notifications(
 p_session_id uuid,p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_result jsonb;
begin
 if p_session_id is null or p_limit not between 1 and 100 then
   raise exception 'INVALID_NOTIFICATION_QUERY'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',n.notice_id,'requestId',n.request_id,
   'eventCode',n.event_code,'createdAt',n.created_at,
   'isRead',n.read_at is not null) order by n.created_at desc,n.notice_id desc),
   '[]'::jsonb) into v_result
 from (select * from taxpay_handoff.notifications
   where session_id=p_session_id order by created_at desc,notice_id desc limit p_limit) n;
 return v_result;
end;
$function$;

create or replace function public.taxpay_v11_handoff_notice_read(
 p_session_id uuid,p_notice_id bigint,p_is_read boolean default true
) returns boolean language plpgsql security definer set search_path to '' as $function$
declare v_changed int;
begin
 if p_session_id is null or p_notice_id is null or p_is_read is null then
   raise exception 'INVALID_NOTICE_ACTION';end if;
 update taxpay_handoff.notifications set read_at=
  case when p_is_read then now() else null end
 where session_id=p_session_id and notice_id=p_notice_id;
 get diagnostics v_changed=row_count;
 return v_changed=1;
end;
$function$;

create or replace function public.taxpay_v11_handoff_summary(
 p_request_id uuid
) returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v taxpay_handoff.requests%rowtype;
begin
 select * into v from taxpay_handoff.requests where id=p_request_id;
 if not found then raise exception 'UNKNOWN_HANDOFF_REQUEST'; end if;
 if v.lifecycle_state<>'SIMULATED' then
   raise exception 'HANDOFF_SUMMARY_NOT_AVAILABLE';end if;
 return jsonb_build_object('documentType','INTERNAL_TRANSACTION_SUMMARY',
  'reference',v.public_reference,'service',v.service_code,
  'amountMinor',v.amount_minor,'assessmentYear',v.assessment_year,
  'status',v.lifecycle_state,'recordedAt',v.updated_at,
  'simulationOnly',true);
end;
$function$;

revoke all on function public.taxpay_v11_handoff_submit(jsonb) from public,anon,authenticated;
revoke all on function public.taxpay_v11_handoff_get(uuid) from public,anon,authenticated;
revoke all on function public.taxpay_v11_handoff_history(uuid,integer) from public,anon,authenticated;
revoke all on function public.taxpay_v11_handoff_office_inbox(integer) from public,anon,authenticated;
revoke all on function public.taxpay_v11_handoff_office_action(uuid,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.taxpay_v11_handoff_finish(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.taxpay_v11_handoff_notifications(uuid,integer) from public,anon,authenticated;
revoke all on function public.taxpay_v11_handoff_notice_read(uuid,bigint,boolean) from public,anon,authenticated;
revoke all on function public.taxpay_v11_handoff_summary(uuid) from public,anon,authenticated;
grant execute on function public.taxpay_v11_handoff_submit(jsonb),
 public.taxpay_v11_handoff_get(uuid),
 public.taxpay_v11_handoff_history(uuid,integer),
 public.taxpay_v11_handoff_office_inbox(integer),
 public.taxpay_v11_handoff_office_action(uuid,text,text,text,text,uuid),
 public.taxpay_v11_handoff_finish(uuid,text,text,uuid),
 public.taxpay_v11_handoff_notifications(uuid,integer),
 public.taxpay_v11_handoff_notice_read(uuid,bigint,boolean),
 public.taxpay_v11_handoff_summary(uuid) to anon,authenticated;
