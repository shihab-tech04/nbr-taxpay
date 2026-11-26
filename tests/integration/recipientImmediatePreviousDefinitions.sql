create or replace function taxpay_guest_private.story_correction_event(r taxpay_guest_private.story_correction_requests)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'schemaVersion','1.0.0','eventType','CORRECTION_SUBMITTED','origin','TAXPAY_SQL','sourceProject','v2',
 'simulationOnly',true,'eventId',(r).id,'requestId',(r).id,'revision',1,
 'occurredAt',to_char((r).created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'payload',jsonb_build_object('originalReference',(r).original_reference,
 'caseKind',(r).case_kind,'reason',(r).reason,
 'requestedOutcome',case when (r).case_kind='UNSOLICITED_PAYMENT_REPORT' then 'Review the reported simulated payment without modifying the original payment record.' else coalesce((r).office_initiation->>'requestedOutcome',left(concat('Review simulated payment allocation; proposed assessment year: ',(r).proposed_year,
 '; proposed circle: ',coalesce(nullif((r).proposed_circle,''),'Not recorded'),
 '; proposed payment head: ',coalesce(nullif((r).proposed_head,''),'Not recorded')),600)) end,
 'evidenceNote',(r).office_initiation->>'evidenceNote',
 'initiatedBy',case when (r).office_initiation is null then 'TAXPAYER' else 'OFFICE' end,
 'evidenceState','PENDING_EVIDENCE','claimantVerified',false,'originalReceiptVerified',false,
 'mayChangeFinancialRecords',false,'changeKind',null,'oldValue',null,'newValue',null,
 'correctionChanges',case when (r).case_kind='UNSOLICITED_PAYMENT_REPORT' then null else jsonb_build_object('currentAY',(r).current_year,'proposedAY',(r).proposed_year,
 'currentCircle',(r).current_circle,'proposedCircle',(r).proposed_circle,
 'currentHeadCode',(r).current_head,'proposedHeadCode',(r).proposed_head,'allocationIndex',(r).allocation_index) end,
 'createdAt',to_char((r).created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))||
 case when coalesce((r).payment_id,(r).recipient_initiation_id) is null then jsonb_build_object('historicalScenario','USER1_REFERENCE_ONLY')
 else jsonb_build_object('originalPaymentId',coalesce((r).payment_id,(r).recipient_initiation_id),'originalPaymentKind','TAXPAY_STORY_PAYMENT','targetAllocationId',(r).allocation_id) end || case when (r).case_kind='UNSOLICITED_PAYMENT_REPORT' then jsonb_build_object('recipientEventId',(r).recipient_event_id) else '{}'::jsonb end)
$$;

create or replace function public.taxpay_demo_correction_claim(p_limit integer default 20,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 20 then raise exception 'INVALID_CLAIM_LIMIT'; end if;
 with picked as (
   select id from taxpay_guest_private.story_correction_requests
   where office_sync_state='PENDING' and sync_next_at<=now()
     and (recipient_initiation_id is null or exists(select 1 from demo_payment.story_payments p where p.id=recipient_initiation_id)) and (p_id is null or id=p_id)
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

create or replace function public.taxpay_demo_correction_office_decision(p_command jsonb)
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
