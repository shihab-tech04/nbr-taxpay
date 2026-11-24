-- Scope the correction lane to fictional V2 receipts. The general
-- payment_v1 bridge remains disabled; do not touch its settings or key.
begin;
create table payment_sync.demo_correction_bridge_key(
 singleton boolean primary key default true check(singleton),
 signing_key text not null check(signing_key ~ '^[0-9a-f]{64}$')
);
alter table payment_sync.demo_correction_bridge_key enable row level security;
revoke all on payment_sync.demo_correction_bridge_key from public,anon,authenticated;
create function public.payment_v1_demo_correction_key()
returns text language sql stable security definer set search_path='' as $$
 select signing_key from payment_sync.demo_correction_bridge_key where singleton
$$;
revoke all on function public.payment_v1_demo_correction_key() from public,anon,authenticated;
grant execute on function public.payment_v1_demo_correction_key() to service_role;

alter table taxpay_guest_private.story_correction_requests alter column payment_id drop not null;
alter table taxpay_guest_private.story_correction_requests add constraint story_correction_source_check check(
 payment_id is not null or (demo_id='user1' and allocation_index is null and allocation_id is null and original_reference ~ '^DEMO-[A-Z0-9-]+$'));
alter table taxpay_guest_private.story_correction_requests
 add column office_sync_state text not null default 'PENDING' check(office_sync_state in ('PENDING','ACKNOWLEDGED')),
 add column review_state text not null default 'PENDING_OFFICER' check(review_state in ('PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED','APPROVER_CLOSED','REJECTED')),
 add column review_updated_at timestamptz,
 add column review_reason text,
 add column office_ack_at timestamptz,
 add column sync_attempts integer not null default 0,
 add column sync_next_at timestamptz not null default now(),
 add column sync_claim_token uuid;
create index story_correction_sync_pending on taxpay_guest_private.story_correction_requests(sync_next_at,id)
 where office_sync_state='PENDING';
create table taxpay_guest_private.story_correction_decisions(
 message_id uuid primary key,
 request_id uuid not null references taxpay_guest_private.story_correction_requests(id),
 officer_uid uuid not null,
 officer_role text not null check(officer_role in ('MAKER','REVIEWER','APPROVER')),
 action text not null,
 command jsonb not null,
 resulting_state text not null,
 recorded_at timestamptz not null default now()
);
alter table taxpay_guest_private.story_correction_decisions enable row level security;
revoke all on taxpay_guest_private.story_correction_decisions from public,anon,authenticated;

create or replace function taxpay_guest_private.story_correction_json(p_row taxpay_guest_private.story_correction_requests)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'id',(p_row).id,'paymentId',(p_row).payment_id,'originalReference',(p_row).original_reference,
 'allocationIndex',(p_row).allocation_index,'allocationId',(p_row).allocation_id,
 'currentAY',(p_row).current_year,'proposedAY',(p_row).proposed_year,
 'currentCircle',(p_row).current_circle,'proposedCircle',(p_row).proposed_circle,
 'currentHeadCode',(p_row).current_head,'proposedHeadCode',(p_row).proposed_head,
 'reason',(p_row).reason,'createdAt',(p_row).created_at,'status','RECORDED',
 'officeSyncState',(p_row).office_sync_state,'reviewState',(p_row).review_state,
 'reviewUpdatedAt',(p_row).review_updated_at,'reviewReason',(p_row).review_reason)
$$;
revoke all on function taxpay_guest_private.story_correction_json(taxpay_guest_private.story_correction_requests) from public,anon,authenticated;

-- Existing User1 scenario references are not payment rows.
create function public.taxpay_demo_historical_correction_save(p_capability_hash text,p_reference text,p_request_key uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_demo text; v_year text; v_new_year text; v_circle text; v_head text; v_reason text;
 v_row taxpay_guest_private.story_correction_requests%rowtype;
begin
 if p_capability_hash is null or p_capability_hash !~ '^[0-9a-f]{64}$'
    or p_request_key is null or jsonb_typeof(p_input) is distinct from 'object'
    or p_input->>'allocationIndex' is not null or nullif(p_input->>'allocationId','') is not null
    or p_input->>'paymentId' is not null then raise exception 'INVALID_CORRECTION_REQUEST'; end if;
 perform taxpay_guest_private.touch_session(p_capability_hash);
 select demo_id into v_demo from taxpay_guest_private.demo_profiles
   where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
 if v_demo is distinct from 'user1' then raise exception 'INVALID_DEMO_PROFILE'; end if;
 select c.ay into v_year from (values ('DEMO-ETDS-SAL-01','2025-2026'),
       ('DEMO-AIT-01','2025-2026'),
       ('DEMO-ETDS-BANK-02','2025-2026'),
       ('DEMO-AIT-02','2025-2026'),
       ('DEMO-ETDS-PRO-03','2025-2026'),
       ('DEMO-TRAVEL-01','2025-2026'),
       ('DEMO-PAY-01','2025-2026'),
       ('DEMO-PAY-02','2025-2026'),
       ('DEMO-ETDS-24-01','2024-2025'),
       ('DEMO-AIT-24-01','2024-2025'),
       ('DEMO-PAY-24-01','2024-2025'),
       ('DEMO-PAY-24-02','2024-2025'),
       ('DEMO-ETDS-23-01','2023-2024'),
       ('DEMO-AIT-23-01','2023-2024'),
       ('DEMO-PAY-23-01','2023-2024')) c(ref,ay) where c.ref=p_reference;
 if v_year is null then raise exception 'CORRECTION_PAYMENT_UNAVAILABLE'; end if;
 v_new_year:=coalesce(nullif(btrim(p_input->>'proposedAY'),''),v_year);
 v_circle:=btrim(coalesce(p_input->>'proposedCircle',''));
 v_head:=btrim(coalesce(p_input->>'proposedHeadCode',''));
 v_reason:=btrim(coalesce(p_input->>'reason',''));
 if char_length(v_reason) not between 10 and 1000 or char_length(v_circle)>120 or char_length(v_head)>120
    or v_new_year !~ '^[0-9]{4}-[0-9]{4}$' then raise exception 'INVALID_CORRECTION_REQUEST'; end if;
 if v_new_year=v_year and v_circle='' and v_head='' then raise exception 'CORRECTION_NO_CHANGE'; end if;
 insert into taxpay_guest_private.story_correction_requests
   (demo_id,payment_id,request_key,allocation_index,allocation_id,original_reference,current_year,proposed_year,
    current_circle,proposed_circle,current_head,proposed_head,reason)
 values(v_demo,null,p_request_key,null,null,p_reference,v_year,v_new_year,'',v_circle,'',v_head,v_reason)
 on conflict(demo_id,request_key) do nothing;
 select * into v_row from taxpay_guest_private.story_correction_requests where demo_id=v_demo and request_key=p_request_key;
 if v_row.payment_id is not null or v_row.original_reference is distinct from p_reference
    or v_row.proposed_year is distinct from v_new_year or v_row.proposed_circle is distinct from v_circle
    or v_row.proposed_head is distinct from v_head or v_row.reason is distinct from v_reason then
    raise exception 'CORRECTION_REQUEST_CONFLICT'; end if;
 return taxpay_guest_private.story_correction_json(v_row);
end;
$$;
revoke all on function public.taxpay_demo_historical_correction_save(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.taxpay_demo_historical_correction_save(text,text,uuid,jsonb) to service_role;

create function public.taxpay_demo_correction_get(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select taxpay_guest_private.story_correction_json(r)
 from taxpay_guest_private.story_correction_requests r where r.id=p_id
$$;
revoke all on function public.taxpay_demo_correction_get(uuid) from public,anon,authenticated;
grant execute on function public.taxpay_demo_correction_get(uuid) to service_role;

create function taxpay_guest_private.story_correction_event(r taxpay_guest_private.story_correction_requests)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'schemaVersion','1.0.0','eventType','CORRECTION_SUBMITTED','origin','TAXPAY_SQL','sourceProject','v2',
 'simulationOnly',true,'eventId',(r).id,'requestId',(r).id,'revision',1,
 'occurredAt',to_char((r).created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'payload',jsonb_build_object('originalReference',(r).original_reference,
 'caseKind','CORRECTION_REVIEW','reason',(r).reason,
 'requestedOutcome',left(concat('Review simulated payment allocation; proposed assessment year: ',(r).proposed_year,
 '; proposed circle: ',coalesce(nullif((r).proposed_circle,''),'Not recorded'),
 '; proposed payment head: ',coalesce(nullif((r).proposed_head,''),'Not recorded')),600),
 'evidenceState','PENDING_EVIDENCE','claimantVerified',false,'originalReceiptVerified',false,
 'mayChangeFinancialRecords',false,'changeKind',null,'oldValue',null,'newValue',null,
 'correctionChanges',jsonb_build_object('currentAY',(r).current_year,'proposedAY',(r).proposed_year,
 'currentCircle',(r).current_circle,'proposedCircle',(r).proposed_circle,
 'currentHeadCode',(r).current_head,'proposedHeadCode',(r).proposed_head,'allocationIndex',(r).allocation_index),
 'createdAt',to_char((r).created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))||
 case when (r).payment_id is null then jsonb_build_object('historicalScenario','USER1_REFERENCE_ONLY')
 else jsonb_build_object('originalPaymentId',(r).payment_id,'originalPaymentKind','TAXPAY_STORY_PAYMENT','targetAllocationId',(r).allocation_id) end)
$$;
revoke all on function taxpay_guest_private.story_correction_event(taxpay_guest_private.story_correction_requests) from public,anon,authenticated;

create function public.taxpay_demo_correction_claim(p_limit integer default 20,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 20 then raise exception 'INVALID_CLAIM_LIMIT'; end if;
 with picked as (
   select id from taxpay_guest_private.story_correction_requests
   where office_sync_state='PENDING' and sync_next_at<=now() and (p_id is null or id=p_id)
   order by sync_next_at,id limit p_limit for update skip locked
 ), claimed as (
   update taxpay_guest_private.story_correction_requests r
   set sync_claim_token=gen_random_uuid(),sync_attempts=r.sync_attempts+1,sync_next_at=now()+interval '90 seconds'
   from picked where r.id=picked.id returning r.*
 )
 select coalesce(jsonb_agg(jsonb_build_object('claimToken',c.sync_claim_token,
 'event',taxpay_guest_private.story_correction_event(r))),'[]'::jsonb)
 into result from claimed c join taxpay_guest_private.story_correction_requests r on r.id=c.id;
 return result;
end;
$$;
revoke all on function public.taxpay_demo_correction_claim(integer,uuid) from public,anon,authenticated;
grant execute on function public.taxpay_demo_correction_claim(integer,uuid) to service_role;

create function public.taxpay_demo_correction_ack(p_id uuid,p_claim_token uuid,p_success boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_success is null then raise exception 'INVALID_ACK'; end if;
 update taxpay_guest_private.story_correction_requests
 set office_sync_state=case when p_success then 'ACKNOWLEDGED' else office_sync_state end,
 office_ack_at=case when p_success then coalesce(office_ack_at,now()) else office_ack_at end,
 sync_claim_token=null,
 sync_next_at=now()+make_interval(secs=>least(3600,5*(2^least(sync_attempts,9))::integer))
 where id=p_id and sync_claim_token=p_claim_token;
 return found;
end;
$$;
revoke all on function public.taxpay_demo_correction_ack(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.taxpay_demo_correction_ack(uuid,uuid,boolean) to service_role;

create function public.taxpay_demo_correction_office_decision(p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_request uuid; v_message uuid; v_actor uuid; v_action text; v_role text; v_reason text;
 v_expected text; v_next text; v_row taxpay_guest_private.story_correction_requests%rowtype;
 v_prior taxpay_guest_private.story_correction_decisions%rowtype;
begin
 if p_command->>'schemaVersion' is distinct from '1.0.0' or p_command->>'origin' is distinct from 'OFFICE_SQL'
    or p_command->>'sourceProject' is distinct from 'v2' or p_command->>'simulationOnly' is distinct from 'true'
    or p_command->>'commandType' is distinct from 'CORRECTION_REVIEW' then
   raise exception 'INVALID_OFFICE_CORRECTION_COMMAND';
 end if;
 v_request:=(p_command->>'requestId')::uuid;v_message:=(p_command->>'messageId')::uuid;
 v_actor:=(p_command->>'officerUid')::uuid;v_action:=p_command->>'action';v_role:=p_command->>'officerRole';
 v_reason:=btrim(p_command->>'reason');v_expected:=p_command->>'expectedReviewState';
 if v_request is null or v_message is null or v_actor is null or v_reason is null or length(v_reason) not between 5 and 1000
    or not coalesce((v_action='MAKER_ACKNOWLEDGE' and v_role='MAKER')
    or (v_action='REVIEWER_VERIFY' and v_role='REVIEWER')
    or (v_action='APPROVER_CLOSE' and v_role='APPROVER')
    or (v_action='REJECT' and v_role in ('REVIEWER','APPROVER')),false) then
   raise exception 'INVALID_OFFICE_CORRECTION_ACTION';
 end if;
 select * into v_row from taxpay_guest_private.story_correction_requests where id=v_request for update;
 if not found then raise exception 'DEMO_CORRECTION_NOT_FOUND'; end if;
 select * into v_prior from taxpay_guest_private.story_correction_decisions where message_id=v_message;
 if found then
   if v_prior.command is distinct from p_command then raise exception 'DEMO_CORRECTION_DECISION_CONFLICT'; end if;
   return jsonb_build_object('messageId',v_message,'stored',true,'reviewState',v_prior.resulting_state);
 end if;
 if v_expected is distinct from v_row.review_state or v_row.review_state in ('APPROVER_CLOSED','REJECTED') then
   raise exception 'DEMO_CORRECTION_REVIEW_SEQUENCE_MISMATCH';
 end if;
 v_next:=case
   when v_action='MAKER_ACKNOWLEDGE' and v_row.review_state='PENDING_OFFICER' then 'MAKER_ACKNOWLEDGED'
   when v_action='REVIEWER_VERIFY' and v_row.review_state='MAKER_ACKNOWLEDGED' then 'REVIEWER_VERIFIED'
   when v_action='APPROVER_CLOSE' and v_row.review_state='REVIEWER_VERIFIED' then 'APPROVER_CLOSED'
   when v_action='REJECT' then 'REJECTED' end;
 if v_next is null or exists(select 1 from taxpay_guest_private.story_correction_decisions
    where request_id=v_request and officer_uid=v_actor) then
   raise exception 'DEMO_CORRECTION_OFFICER_SEQUENCE_INVALID';
 end if;
 insert into taxpay_guest_private.story_correction_decisions(message_id,request_id,officer_uid,officer_role,action,command,resulting_state)
 values(v_message,v_request,v_actor,v_role,v_action,p_command,v_next);
 update taxpay_guest_private.story_correction_requests set office_sync_state='ACKNOWLEDGED',
   office_ack_at=coalesce(office_ack_at,now()),review_state=v_next,review_updated_at=now(),review_reason=v_reason
 where id=v_request;
 return jsonb_build_object('messageId',v_message,'stored',true,'reviewState',v_next);
end;
$$;
revoke all on function public.taxpay_demo_correction_office_decision(jsonb) from public,anon,authenticated;
grant execute on function public.taxpay_demo_correction_office_decision(jsonb) to service_role;
commit;
