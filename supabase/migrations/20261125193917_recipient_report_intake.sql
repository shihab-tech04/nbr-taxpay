-- Candidate for disposable SQL validation before migration promotion. Existing grants and correction event shape are preserved.
begin;
alter table taxpay_guest_private.story_correction_requests add column case_kind text not null default 'CORRECTION_REVIEW' check(case_kind in ('CORRECTION_REVIEW','UNSOLICITED_PAYMENT_REPORT'));
alter table taxpay_guest_private.story_correction_requests add column recipient_event_id text;
alter table taxpay_guest_private.story_correction_requests add column recipient_initiation_id uuid references demo_payment.story_payment_initiations(id) on delete restrict;
-- The original FK to completed payments remains intact. Only an exact report
-- may instead reference the validated initiation; historical correction rules stay unchanged.
alter table taxpay_guest_private.story_correction_requests drop constraint story_correction_source_check;
alter table taxpay_guest_private.story_correction_requests add constraint story_correction_source_check check(
 payment_id is not null or (demo_id='user1' and allocation_index is null and allocation_id is null and original_reference ~ '^DEMO-[A-Z0-9-]+$')
 or (case_kind='UNSOLICITED_PAYMENT_REPORT' and recipient_initiation_id is not null));
alter table taxpay_guest_private.story_correction_requests add constraint recipient_report_shape check (
 (case_kind='CORRECTION_REVIEW' and recipient_event_id is null and recipient_initiation_id is null)
 or (case_kind='UNSOLICITED_PAYMENT_REPORT' and ((payment_id is not null and recipient_initiation_id is null) or (payment_id is null and recipient_initiation_id is not null)) and recipient_event_id is not null and recipient_event_id like coalesce(payment_id,recipient_initiation_id)::text||':%' and office_initiation is null and current_year=proposed_year and current_circle=proposed_circle and current_head=proposed_head));
create unique index story_recipient_report_once on taxpay_guest_private.story_correction_requests(demo_id,recipient_event_id) where case_kind='UNSOLICITED_PAYMENT_REPORT';
create or replace function taxpay_guest_private.story_correction_json(p_row taxpay_guest_private.story_correction_requests)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'caseKind',(p_row).case_kind,'recipientEventId',(p_row).recipient_event_id,'id',(p_row).id,'paymentId',coalesce((p_row).payment_id,(p_row).recipient_initiation_id),'originalReference',(p_row).original_reference,
 'allocationIndex',(p_row).allocation_index,'allocationId',(p_row).allocation_id,
 'currentAY',(p_row).current_year,'proposedAY',(p_row).proposed_year,
 'currentCircle',(p_row).current_circle,'proposedCircle',(p_row).proposed_circle,
 'currentHeadCode',(p_row).current_head,'proposedHeadCode',(p_row).proposed_head,
 'reason',(p_row).reason,'createdAt',(p_row).created_at,'status','RECORDED',
 'officeSyncState',(p_row).office_sync_state,'reviewState',(p_row).review_state,
 'reviewUpdatedAt',(p_row).review_updated_at,'reviewReason',(p_row).review_reason,
 'initiatedBy',case when (p_row).office_initiation is null then 'TAXPAYER' else 'OFFICE' end,
 'requestedOutcome',(p_row).office_initiation->>'requestedOutcome','evidenceNote',(p_row).office_initiation->>'evidenceNote') || case when (p_row).case_kind='UNSOLICITED_PAYMENT_REPORT' then jsonb_build_object('paymentCompleted',exists(select 1 from demo_payment.story_payments p where p.id=coalesce((p_row).payment_id,(p_row).recipient_initiation_id))) else '{}'::jsonb end
$$;
revoke all on function taxpay_guest_private.story_correction_json(taxpay_guest_private.story_correction_requests) from public,anon,authenticated;

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
revoke all on function taxpay_guest_private.story_correction_event(taxpay_guest_private.story_correction_requests) from public,anon,authenticated;


create function public.taxpay_demo_received_payment_report_save(p_capability_hash text,p_event_id text,p_request_key uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $recipient_report$
declare v_demo text; v_page jsonb; v_notice jsonb; v_offset integer:=0; v_reason text; v_payment uuid; v_initiation uuid; v_row taxpay_guest_private.story_correction_requests%rowtype;
begin
 if p_event_id is null or p_event_id !~ '^[0-9a-f-]{36}:(allocation|legacy):[1-9][0-9]{0,8}$' or p_request_key is null then raise exception 'INVALID_CORRECTION_REQUEST'; end if;
 v_reason:=btrim(coalesce(p_reason,''));
 if char_length(v_reason) not between 10 and 1000 then raise exception 'INVALID_CORRECTION_REQUEST'; end if;
 loop
  v_page:=public.taxpay_demo_received_payment_notices(p_capability_hash,'list',null,v_offset,100);
  select n into v_notice from jsonb_array_elements(v_page->'items') n where n->>'eventId'=p_event_id;
  exit when v_notice is not null or not coalesce((v_page->>'hasMore')::boolean,false) or v_offset>=100000;
  v_offset:=v_offset+100;
 end loop;
 if v_notice is null or not coalesce(v_notice->>'paymentStatus' in ('SIMULATED_SUCCESS','SIMULATED_INITIATED'),false) then raise exception 'CORRECTION_PAYMENT_UNAVAILABLE'; end if;
 select demo_id into v_demo from taxpay_guest_private.demo_profiles where encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')=p_capability_hash;
 if v_demo is null then raise exception 'INVALID_DEMO_PROFILE'; end if;
 -- A completed parent or its durable initiation is sufficient. Both retain
 -- the same ID if completion occurs during this transaction; neither is changed.
 select p.id into v_payment from demo_payment.story_payments p where p.id=(v_notice->>'paymentId')::uuid;
 if v_payment is null then
   select i.id into v_initiation from demo_payment.story_payment_initiations i where i.id=(v_notice->>'paymentId')::uuid;
   if v_initiation is null then raise exception 'CORRECTION_PAYMENT_UNAVAILABLE'; end if;
 end if;
 -- Exact recipient entitlement was established by the existing notice projection, never a client TIN.
 insert into taxpay_guest_private.story_correction_requests(demo_id,payment_id,recipient_initiation_id,request_key,allocation_index,allocation_id,original_reference,current_year,proposed_year,current_circle,proposed_circle,current_head,proposed_head,reason,case_kind,recipient_event_id)
 values(v_demo,v_payment,v_initiation,p_request_key,split_part(p_event_id,':',3)::integer-1,v_notice->>'allocationId',
 case when coalesce(v_notice->>'receiptReference','') ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{5,79}$' then v_notice->>'receiptReference' else v_notice->>'paymentId' end,
 coalesce(v_notice->>'assessmentYear',''),coalesce(v_notice->>'assessmentYear',''),'','',coalesce(v_notice->>'headId',''),coalesce(v_notice->>'headId',''),v_reason,'UNSOLICITED_PAYMENT_REPORT',p_event_id)
 on conflict do nothing;
 select * into v_row from taxpay_guest_private.story_correction_requests where demo_id=v_demo and recipient_event_id=p_event_id and case_kind='UNSOLICITED_PAYMENT_REPORT';
 if not found then raise exception 'CORRECTION_REQUEST_CONFLICT'; end if;
 return taxpay_guest_private.story_correction_json(v_row);
end; $recipient_report$;
revoke all on function public.taxpay_demo_received_payment_report_save(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.taxpay_demo_received_payment_report_save(text,text,uuid,text) to service_role;

create or replace view taxpay_guest_private.story_correction_notice_events with (security_invoker=true) as
 select r.demo_id,r.id as request_id,'submitted:'||r.id::text as event_id,
 case when r.case_kind='UNSOLICITED_PAYMENT_REPORT' then 'REPORT_RECORDED' when r.office_initiation is null then 'SUBMITTED' else 'OFFICE_INITIATED' end::text as code,
 r.original_reference,r.created_at as occurred_at,r.reason as detail
 from taxpay_guest_private.story_correction_requests r
 union all
 select r.demo_id,r.id,'office:'||r.id::text,case when r.case_kind='UNSOLICITED_PAYMENT_REPORT' then 'REPORT_OFFICE_RECEIVED' else 'OFFICE_RECEIVED' end,
 r.original_reference,r.office_ack_at,null::text
 from taxpay_guest_private.story_correction_requests r where r.office_ack_at is not null
 union all
 select r.demo_id,r.id,'decision:'||d.message_id::text,case when r.case_kind='UNSOLICITED_PAYMENT_REPORT' then 'REPORT_'||d.resulting_state else d.resulting_state end,
 r.original_reference,d.recorded_at,d.command->>'reason'
 from taxpay_guest_private.story_correction_decisions d join taxpay_guest_private.story_correction_requests r on r.id=d.request_id;
revoke all on taxpay_guest_private.story_correction_notice_events from public,anon,authenticated;
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
revoke all on function public.taxpay_demo_correction_claim(integer,uuid) from public,anon,authenticated;
grant execute on function public.taxpay_demo_correction_claim(integer,uuid) to service_role;


commit;
