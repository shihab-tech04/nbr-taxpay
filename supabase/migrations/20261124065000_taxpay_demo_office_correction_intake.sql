begin;
alter table taxpay_guest_private.story_correction_requests add column office_initiation jsonb;
alter table taxpay_guest_private.story_correction_requests add constraint correction_office_initiation_shape
 check(office_initiation is null or (payment_id is not null and jsonb_typeof(office_initiation)='object'));
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
 'reviewUpdatedAt',(p_row).review_updated_at,'reviewReason',(p_row).review_reason,
 'initiatedBy',case when (p_row).office_initiation is null then 'TAXPAYER' else 'OFFICE' end,
 'requestedOutcome',(p_row).office_initiation->>'requestedOutcome','evidenceNote',(p_row).office_initiation->>'evidenceNote')
$$;
revoke all on function taxpay_guest_private.story_correction_json(taxpay_guest_private.story_correction_requests) from public,anon,authenticated;

create or replace function taxpay_guest_private.story_correction_event(r taxpay_guest_private.story_correction_requests)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object(
 'schemaVersion','1.0.0','eventType','CORRECTION_SUBMITTED','origin','TAXPAY_SQL','sourceProject','v2',
 'simulationOnly',true,'eventId',(r).id,'requestId',(r).id,'revision',1,
 'occurredAt',to_char((r).created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'payload',jsonb_build_object('originalReference',(r).original_reference,
 'caseKind','CORRECTION_REVIEW','reason',(r).reason,
 'requestedOutcome',coalesce((r).office_initiation->>'requestedOutcome',left(concat('Review simulated payment allocation; proposed assessment year: ',(r).proposed_year,
 '; proposed circle: ',coalesce(nullif((r).proposed_circle,''),'Not recorded'),
 '; proposed payment head: ',coalesce(nullif((r).proposed_head,''),'Not recorded')),600)),
 'evidenceNote',(r).office_initiation->>'evidenceNote',
 'initiatedBy',case when (r).office_initiation is null then 'TAXPAYER' else 'OFFICE' end,
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

-- Signed Office command: use existing source payment ownership and the
-- same fictional profile TIN contract as received-payment notices.
-- A missing source is explicit; a mismatched existing source fails closed.
create function public.taxpay_demo_correction_office_initiation(p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_payment_id uuid; v_actor uuid; v_role text; v_reference text; v_tin text;
 v_reason text; v_outcome text; v_evidence text; v_p demo_payment.story_payments%rowtype;
 v_demo text; v_matches integer; v_details jsonb; v_snapshot jsonb; v_alloc jsonb; v_alloc_index integer;
 v_alloc_id text; v_count integer; v_year text; v_circle text; v_head text;
 v_row taxpay_guest_private.story_correction_requests%rowtype;
begin
 if p_command->>'schemaVersion' is distinct from '1.0.0' or p_command->>'origin' is distinct from 'OFFICE_SQL'
 or p_command->>'sourceProject' is distinct from 'v2' or p_command->>'simulationOnly' is distinct from 'true'
 or p_command->>'commandType' is distinct from 'OFFICE_CORRECTION_INITIATED' then raise exception 'INVALID_OFFICE_INITIATION'; end if;
 v_id:=(p_command->>'requestId')::uuid; v_payment_id:=(p_command->>'sourcePaymentId')::uuid;
 v_actor:=(p_command->>'officerUid')::uuid; v_role:=p_command->>'officerRole';
 v_reference:=p_command->>'originalReference'; v_tin:=p_command->>'taxpayerTin';
 v_reason:=btrim(p_command->>'reason');v_outcome:=btrim(p_command->>'requestedOutcome');v_evidence:=p_command->>'evidenceNote';
 if v_id is null or v_id::text is distinct from p_command->>'messageId' or v_payment_id is null or v_actor is null
 or v_role is null or v_role not in ('MAKER','APPROVER') or v_reference is null or length(v_reference) not between 6 and 80
 or v_tin is null or v_tin !~ '^[0-9]{12,13}$' or v_reason is null or length(v_reason) not between 10 and 1000
 or v_outcome is null or length(v_outcome) not between 10 and 600 or v_evidence is null
 or length(btrim(v_evidence)) not between 10 and 2000 or octet_length(v_evidence)>8000 then raise exception 'INVALID_OFFICE_INITIATION'; end if;
 select * into v_p from demo_payment.story_payments where id=v_payment_id;
 if not found then return jsonb_build_object('messageId',v_id,'stored',false,'sourceAbsent',true); end if;
 if v_p.status is distinct from 'SIMULATED_SUCCESS' or v_p.data->>'origin' is distinct from 'TAXPAY_UI'
 or not exists(select 1 from taxpay_guest_private.demo_profiles payer
 where payer.demo_id=v_p.data#>>'{details,payerId}' and (payer.payment_session_id=v_p.session_id or exists(
 select 1 from taxpay_guest_private.demo_story_session_links link where link.demo_id=payer.demo_id and link.legacy_session_id=v_p.session_id
 and not exists(select 1 from demo_payment.story_payments unverified where unverified.session_id=link.legacy_session_id
 and (unverified.data->>'origin' is distinct from 'TAXPAY_UI' or unverified.data#>>'{details,payerId}' is distinct from payer.demo_id)))))
 then raise exception 'OFFICE_INITIATION_SOURCE_UNVERIFIED'; end if;
 v_details:=v_p.data->'details';v_snapshot:=coalesce(v_details->'receiptSnapshot','{}'::jsonb);
 if v_reference is distinct from v_payment_id::text and v_reference is distinct from v_details->>'receiptReference'
 and v_reference is distinct from v_snapshot->>'challanNo' then raise exception 'OFFICE_INITIATION_REFERENCE_MISMATCH'; end if;
 select count(*),min(p.demo_id) into v_matches,v_demo from taxpay_guest_private.demo_profiles p
 cross join lateral (select substring(p.demo_id from 5)::integer as n) u
 left join public.taxpay_taxpayer_registration_profiles reg on reg.account_id=p.demo_id
 where v_tin in (reg.tin,
 case when u.n between 1 and 9 then repeat(u.n::text,12) when u.n=10 then repeat('0',12) else '9090000000'||lpad(u.n::text,2,'0') end,
 case when u.n between 1 and 9 then repeat(u.n::text,13) when u.n=10 then '1010101010101' else '90000000000'||lpad(u.n::text,2,'0') end);
 if v_matches<>1 then raise exception 'OFFICE_INITIATION_RECIPIENT_UNBOUND'; end if;
 select count(*) into v_count from jsonb_array_elements(case when jsonb_typeof(v_details->'allocations')='array' then v_details->'allocations' else '[]'::jsonb end) a where a->>'taxpayerTin'=v_tin;
 if v_count=1 then
 select a.value,(a.ordinality-1)::integer into v_alloc,v_alloc_index
 from jsonb_array_elements(v_details->'allocations') with ordinality a(value,ordinality) where a.value->>'taxpayerTin'=v_tin;
 v_alloc_id:=nullif(v_alloc->>'allocationId','');
 elsif v_count=0 and (jsonb_typeof(v_details->'allocations')='array' or v_details->>'taxpayerTin' is distinct from v_tin) then
 raise exception 'OFFICE_INITIATION_RECIPIENT_MISMATCH'; end if;
 -- A multiple-allocation case is explicitly payment-level, not an invented allocation.
 v_year:=coalesce(v_alloc->>'assessmentYear',v_snapshot->>'assessmentYear',v_details->>'assessmentYear','');
 v_circle:=coalesce(v_snapshot->>'taxCircle',v_details->>'taxCircle','');
 v_head:=coalesce(v_alloc->>'economicCode',case when v_count=0 then v_snapshot#>>'{items,0,economicCode}' end,'');
 insert into taxpay_guest_private.story_correction_requests(id,demo_id,payment_id,request_key,allocation_index,allocation_id,
 original_reference,current_year,proposed_year,current_circle,proposed_circle,current_head,proposed_head,reason,office_initiation)
 values(v_id,v_demo,v_payment_id,v_id,v_alloc_index,v_alloc_id,v_reference,v_year,v_year,v_circle,v_circle,v_head,v_head,v_reason,p_command)
 on conflict do nothing;
 select * into v_row from taxpay_guest_private.story_correction_requests where id=v_id;
 if not found or v_row.demo_id is distinct from v_demo or v_row.office_initiation is distinct from p_command
 then raise exception 'OFFICE_INITIATION_CONFLICT'; end if;
 return jsonb_build_object('messageId',v_id,'stored',true,'ownerLinked',true);
end;
$$;
revoke all on function public.taxpay_demo_correction_office_initiation(jsonb) from public,anon,authenticated;
grant execute on function public.taxpay_demo_correction_office_initiation(jsonb) to service_role;
create or replace view taxpay_guest_private.story_correction_notice_events with (security_invoker=true) as
 select r.demo_id,r.id as request_id,'submitted:'||r.id::text as event_id,case when r.office_initiation is null then 'SUBMITTED'::text else 'OFFICE_INITIATED'::text end as code,
 r.original_reference,r.created_at as occurred_at,r.reason as detail
 from taxpay_guest_private.story_correction_requests r
 union all
 select r.demo_id,r.id,'office:'||r.id::text,'OFFICE_RECEIVED',r.original_reference,r.office_ack_at,null::text
 from taxpay_guest_private.story_correction_requests r where r.office_ack_at is not null
 union all
 select r.demo_id,r.id,'decision:'||d.message_id::text,d.resulting_state,r.original_reference,d.recorded_at,d.command->>'reason'
 from taxpay_guest_private.story_correction_decisions d join taxpay_guest_private.story_correction_requests r on r.id=d.request_id;
revoke all on taxpay_guest_private.story_correction_notice_events from public,anon,authenticated;

commit;
