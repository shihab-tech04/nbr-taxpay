-- DISPOSABLE RECEIVER CANDIDATE ONLY. Not an ordered migration.
-- Reuses the existing signed Office command transport and service-only RPCs.
-- New decisions are direct Super Admin; history and exact decision replay remain.
-- No financial data mutation. Typed applied-change projection and paired Edge
-- acceptance must be completed before promotion to a production migration.
BEGIN;
ALTER TABLE public.taxpay_correction_inquiries DROP CONSTRAINT taxpay_correction_inquiries_office_review_state_check;
ALTER TABLE public.taxpay_correction_inquiries ADD CONSTRAINT taxpay_correction_inquiries_office_review_state_check CHECK (office_review_state IN ('PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED','APPROVER_CLOSED','APPROVED','REJECTED'));
ALTER TABLE public.taxpay_correction_review_decisions DROP CONSTRAINT taxpay_correction_review_decisions_officer_role_check;
ALTER TABLE public.taxpay_correction_review_decisions ADD CONSTRAINT taxpay_correction_review_decisions_officer_role_check CHECK (officer_role IN ('MAKER','REVIEWER','APPROVER','SUPER_ADMIN'));
ALTER TABLE public.taxpay_correction_review_decisions DROP CONSTRAINT taxpay_correction_review_decisions_action_code_check;
ALTER TABLE public.taxpay_correction_review_decisions ADD CONSTRAINT taxpay_correction_review_decisions_action_code_check CHECK (action_code IN ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY','APPROVER_CLOSE','APPROVE','REJECT'));
ALTER TABLE public.taxpay_correction_review_decisions DROP CONSTRAINT taxpay_correction_review_decisions_next_state_check;
ALTER TABLE public.taxpay_correction_review_decisions ADD CONSTRAINT taxpay_correction_review_decisions_next_state_check CHECK (next_state IN ('MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED','APPROVER_CLOSED','APPROVED','REJECTED'));
ALTER TABLE payment_sync.office_initiated_correction_inbox DROP CONSTRAINT office_initiated_correction_inbox_officer_role_check;
ALTER TABLE payment_sync.office_initiated_correction_inbox ADD CONSTRAINT office_initiated_correction_inbox_officer_role_check CHECK (officer_role IN ('MAKER','APPROVER','SUPER_ADMIN'));
ALTER TABLE taxpay_guest_private.story_correction_requests DROP CONSTRAINT story_correction_requests_review_state_check;
ALTER TABLE taxpay_guest_private.story_correction_requests ADD CONSTRAINT story_correction_requests_review_state_check CHECK (review_state IN ('PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED','APPROVER_CLOSED','APPROVED','REJECTED'));
ALTER TABLE taxpay_guest_private.story_correction_decisions DROP CONSTRAINT story_correction_decisions_officer_role_check;
ALTER TABLE taxpay_guest_private.story_correction_decisions ADD CONSTRAINT story_correction_decisions_officer_role_check CHECK (officer_role IN ('MAKER','REVIEWER','APPROVER','SUPER_ADMIN'));
-- Persist a nonfinancial, source-owned projection only for approved ordinary
-- requests tied to a completed payment. Original payment and receipt are immutable.
ALTER TABLE taxpay_guest_private.story_correction_requests
 ADD COLUMN applied_correction jsonb,
 ADD CONSTRAINT story_applied_correction_shape CHECK (
  applied_correction IS NULL OR (
   case_kind='CORRECTION_REVIEW' AND payment_id IS NOT NULL
   AND (office_initiation IS NULL OR (office_initiation ? 'typedCorrection' AND office_initiation->>'messageId'=applied_correction->>'decisionMessageId'))
   AND review_state='APPROVED' AND office_sync_state='ACKNOWLEDGED'
   AND pg_catalog.jsonb_typeof(applied_correction)='object'
   AND (applied_correction->>'paymentId' = payment_id::text) IS TRUE
   AND applied_correction->'allocationIndex' IS NOT DISTINCT FROM coalesce(pg_catalog.to_jsonb(allocation_index),'null'::jsonb)
   AND applied_correction->'allocationId' IS NOT DISTINCT FROM coalesce(pg_catalog.to_jsonb(allocation_id),'null'::jsonb)
   AND (applied_correction->>'assessmentYear' = proposed_year) IS TRUE
   AND (applied_correction->>'circle' = proposed_circle) IS TRUE
   AND (applied_correction->>'headCode' = proposed_head) IS TRUE
   AND (applied_correction->>'sourceProject' IN ('original','v2')) IS TRUE
   AND (applied_correction->>'decisionMessageId' ~ '^[0-9a-f-]{36}$') IS TRUE
  ));
CREATE OR REPLACE FUNCTION public.taxpay_correction_record_office_decision(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_message uuid; v_inquiry uuid; v_actor uuid; v_idempotency uuid;
  v_role text; v_action text; v_reason text; v_expected text;
  v_fingerprint text; v_old_state text; v_new_state text; v_revision integer;
  v_previous public.taxpay_correction_review_decisions%ROWTYPE;
BEGIN
  IF p_command IS NULL OR pg_catalog.jsonb_typeof(p_command) IS DISTINCT FROM 'object'
     OR pg_catalog.octet_length(p_command::text) > 12000
     OR p_command->>'schemaVersion' IS DISTINCT FROM '1.0.0'
     OR p_command->>'commandType' IS DISTINCT FROM 'CORRECTION_REVIEW'
     OR p_command->>'origin' IS DISTINCT FROM 'OFFICE_SQL' THEN
    RAISE EXCEPTION 'Invalid correction review command';
  END IF;
  IF coalesce(p_command->>'messageId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR coalesce(p_command->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR coalesce(p_command->>'officerUid','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR coalesce(p_command->>'idempotencyKey','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid correction review identifiers';
  END IF;

  v_message := (p_command->>'messageId')::uuid;
  v_inquiry := (p_command->>'requestId')::uuid;
  v_actor := (p_command->>'officerUid')::uuid;
  v_idempotency := (p_command->>'idempotencyKey')::uuid;
  v_role := p_command->>'officerRole';
  v_action := p_command->>'action';
  v_reason := nullif(pg_catalog.btrim(p_command->>'reason'),'');
  v_expected := p_command->>'expectedReviewState';
  v_fingerprint := pg_catalog.md5(p_command::text);

  IF v_role IS NULL OR v_action IS NULL OR v_reason IS NULL OR length(v_reason) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'Invalid correction review action';
  END IF;

  SELECT * INTO v_previous FROM public.taxpay_correction_review_decisions
    WHERE message_id=v_message;
  IF FOUND THEN
    IF v_previous.payload_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Conflicting correction review replay';
    END IF;
    RETURN pg_catalog.jsonb_build_object('messageId',v_message,'stored',true,
      'duplicate',true,'reviewState',v_previous.next_state);
  END IF;

  IF v_role IS DISTINCT FROM 'SUPER_ADMIN' OR v_action NOT IN ('APPROVE','REJECT') THEN
    RAISE EXCEPTION 'Invalid correction review action';
  END IF;

  SELECT office_review_state,office_review_revision
    INTO v_old_state,v_revision FROM public.taxpay_correction_inquiries
    WHERE inquiry_id=v_inquiry FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Correction inquiry not found'; END IF;
  IF v_expected IS DISTINCT FROM v_old_state THEN
    RAISE EXCEPTION 'Correction review state changed';
  END IF;

  IF v_old_state NOT IN ('PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED') THEN
    RAISE EXCEPTION 'Correction review sequence mismatch';
  END IF;
  v_new_state := CASE v_action WHEN 'APPROVE' THEN 'APPROVED' ELSE 'REJECTED' END;

  INSERT INTO public.taxpay_correction_review_decisions(
    message_id,inquiry_id,idempotency_key,payload_fingerprint,officer_uid,
    officer_role,action_code,reason,previous_state,next_state)
  VALUES(v_message,v_inquiry,v_idempotency,v_fingerprint,v_actor,
    v_role,v_action,v_reason,v_old_state,v_new_state);
  UPDATE public.taxpay_correction_inquiries SET
    office_review_state=v_new_state,
    office_review_revision=v_revision+1,
    office_review_updated_at=now()
  WHERE inquiry_id=v_inquiry;

  RETURN pg_catalog.jsonb_build_object('messageId',v_message,'stored',true,
    'duplicate',false,'reviewState',v_new_state,'revision',v_revision+1);
END;
$function$;
create or replace function public.taxpay_demo_correction_office_decision(p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_request uuid; v_message uuid; v_actor uuid; v_action text; v_role text; v_reason text;
 v_expected text; v_next text; v_row taxpay_guest_private.story_correction_requests%rowtype;
 v_prior taxpay_guest_private.story_correction_decisions%rowtype;
begin
 if p_command->>'schemaVersion' is distinct from '1.0.0' or p_command->>'origin' is distinct from 'OFFICE_SQL'
    or coalesce(p_command->>'sourceProject','') not in ('v2','original') or p_command->>'simulationOnly' is distinct from 'true'
    or p_command->>'commandType' is distinct from 'CORRECTION_REVIEW' then
   raise exception 'INVALID_OFFICE_CORRECTION_COMMAND';
 end if;
 v_request:=(p_command->>'requestId')::uuid;v_message:=(p_command->>'messageId')::uuid;
 v_actor:=(p_command->>'officerUid')::uuid;v_action:=p_command->>'action';v_role:=p_command->>'officerRole';
 v_reason:=btrim(p_command->>'reason');v_expected:=p_command->>'expectedReviewState';
 if v_request is null or v_message is null or v_actor is null or v_reason is null or length(v_reason) not between 5 and 1000
    or v_role is null or v_action is null then
   raise exception 'INVALID_OFFICE_CORRECTION_ACTION';
 end if;
 select * into v_row from taxpay_guest_private.story_correction_requests where id=v_request for update;
 if not found then raise exception 'DEMO_CORRECTION_NOT_FOUND'; end if;
 if p_command->>'sourceProject'='original' and v_row.case_kind<>'UNSOLICITED_PAYMENT_REPORT' then raise exception 'INVALID_OFFICE_CORRECTION_COMMAND'; end if;
 select * into v_prior from taxpay_guest_private.story_correction_decisions where message_id=v_message;
 if found then
   if v_prior.command is distinct from p_command then raise exception 'DEMO_CORRECTION_DECISION_CONFLICT'; end if;
   return jsonb_build_object('messageId',v_message,'stored',true,'reviewState',v_prior.resulting_state);
 end if;
 if v_role is distinct from 'SUPER_ADMIN' or v_action not in ('APPROVE','REJECT') then
   raise exception 'INVALID_OFFICE_CORRECTION_ACTION';
 end if;
 if v_expected is distinct from v_row.review_state or v_row.review_state not in ('PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED') then
   raise exception 'DEMO_CORRECTION_REVIEW_SEQUENCE_MISMATCH';
 end if;
 v_next:=case when v_action='APPROVE' then 'APPROVED' else 'REJECTED' end;
 insert into taxpay_guest_private.story_correction_decisions(message_id,request_id,officer_uid,officer_role,action,command,resulting_state)
 values(v_message,v_request,v_actor,v_role,v_action,p_command,v_next);
 update taxpay_guest_private.story_correction_requests set office_sync_state='ACKNOWLEDGED',
   office_ack_at=coalesce(office_ack_at,now()),review_state=v_next,review_updated_at=now(),review_reason=v_reason,
   applied_correction=case when v_next='APPROVED' and v_row.case_kind='CORRECTION_REVIEW'
       and v_row.payment_id is not null and v_row.office_initiation is null
       and (v_row.current_year,v_row.current_circle,v_row.current_head)
           is distinct from (v_row.proposed_year,v_row.proposed_circle,v_row.proposed_head)
     then jsonb_build_object('paymentId',v_row.payment_id,'allocationIndex',v_row.allocation_index,
       'allocationId',v_row.allocation_id,'assessmentYear',v_row.proposed_year,
       'circle',v_row.proposed_circle,'headCode',v_row.proposed_head,
       'sourceProject',p_command->>'sourceProject','decisionMessageId',v_message)
     else null end
 where id=v_request;
 return jsonb_build_object('messageId',v_message,'stored',true,'reviewState',v_next);
end;
$$;
CREATE OR REPLACE FUNCTION public.taxpay_correction_receive_office_initiation(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER VOLATILE SET search_path TO ''
AS $receive$
DECLARE v_case uuid;v_payment uuid;v_officer uuid;v_occurred timestamptz;
 v_existing payment_sync.office_initiated_correction_inbox%ROWTYPE;
 v_reason text;v_outcome text;v_note text;v_ref text;v_tin text;v_role text;
BEGIN
 IF p_command IS NULL OR pg_catalog.jsonb_typeof(p_command)<>'object'
    OR pg_catalog.octet_length(p_command::text)>20000
    OR p_command->>'schemaVersion' IS DISTINCT FROM '1.0.0'
    OR p_command->>'commandType' IS DISTINCT FROM 'OFFICE_CORRECTION_INITIATED'
    OR p_command->>'origin' IS DISTINCT FROM 'OFFICE_SQL'
    OR coalesce(p_command->>'messageId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR p_command->>'messageId' IS DISTINCT FROM p_command->>'requestId'
    OR coalesce(p_command->>'sourcePaymentId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR coalesce(p_command->>'officerUid','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR p_command ? 'requesterUid' OR p_command ? 'claimedBy' THEN
  RAISE EXCEPTION 'INVALID_SIGNED_OFFICE_CORRECTION';
 END IF;
 -- The legacy authenticated inbox/claim contract cannot yet certify a typed
 -- applied correction. Never acknowledge a typed command as merely stored.
 IF p_command ? 'typedCorrection' THEN RAISE EXCEPTION 'TYPED_OFFICE_CORRECTION_REQUIRES_SOURCE_PROJECTION'; END IF;
 v_case:=(p_command->>'messageId')::uuid;
 v_payment:=(p_command->>'sourcePaymentId')::uuid;
 v_officer:=(p_command->>'officerUid')::uuid;
 v_ref:=p_command->>'originalReference';
 v_tin:=p_command->>'taxpayerTin';
 v_reason:=pg_catalog.btrim(p_command->>'reason');
 v_outcome:=pg_catalog.btrim(p_command->>'requestedOutcome');
 v_note:=p_command->>'evidenceNote';
 v_role:=p_command->>'officerRole';
 IF v_ref IS NULL OR v_ref !~ '^[A-Za-z0-9][A-Za-z0-9._/-]{5,79}$'
    OR v_tin IS NULL OR v_tin !~ '^[0-9]{12,13}$'
    OR v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 10 AND 1000
    OR v_outcome IS NULL OR char_length(v_outcome) NOT BETWEEN 10 AND 600
    OR v_note IS NULL OR char_length(btrim(v_note)) NOT BETWEEN 10 AND 2000
    OR octet_length(v_note)>8000 OR v_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
  RAISE EXCEPTION 'INVALID_SIGNED_OFFICE_CORRECTION_FIELDS';
 END IF;
 BEGIN
  v_occurred:=(p_command->>'occurredAt')::timestamptz;
 EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'INVALID_OFFICE_CORRECTION_TIMESTAMP';
 END;
 IF v_occurred IS NULL OR v_occurred>now()+interval '5 minutes' THEN
  RAISE EXCEPTION 'INVALID_OFFICE_CORRECTION_TIMESTAMP';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM demo_payment.story_payments p
   WHERE p.id=v_payment AND p.status='SIMULATED_SUCCESS'
     AND p.data->>'origin'='TAXPAY_UI'
     AND (p.id::text=v_ref OR p.data#>>'{details,receiptReference}'=v_ref
        OR p.data#>>'{details,receiptSnapshot,challanNo}'=v_ref)
     AND (p.data#>>'{details,taxpayerTin}'=v_tin OR EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_array_elements(
         CASE WHEN pg_catalog.jsonb_typeof(p.data#>'{details,allocations}')='array'
           THEN p.data#>'{details,allocations}' ELSE '[]'::jsonb END
       ) AS allocation(line)
       WHERE allocation.line->>'taxpayerTin'=v_tin))
 ) THEN RAISE EXCEPTION 'OFFICE_CORRECTION_SOURCE_PAYMENT_NOT_VERIFIED'; END IF;
 INSERT INTO payment_sync.office_initiated_correction_inbox(
  case_id,source_payment_id,original_reference,taxpayer_tin,reason,
  requested_outcome,evidence_note,officer_uid,officer_role,occurred_at)
 VALUES(v_case,v_payment,v_ref,v_tin,v_reason,v_outcome,v_note,v_officer,v_role,v_occurred)
 ON CONFLICT(case_id) DO NOTHING;
 SELECT * INTO v_existing FROM payment_sync.office_initiated_correction_inbox
  WHERE case_id=v_case;
 IF v_existing.case_id IS NULL OR v_existing.source_payment_id IS DISTINCT FROM v_payment
  OR v_existing.original_reference IS DISTINCT FROM v_ref
  OR v_existing.taxpayer_tin IS DISTINCT FROM v_tin
  OR v_existing.reason IS DISTINCT FROM v_reason
  OR v_existing.requested_outcome IS DISTINCT FROM v_outcome
  OR v_existing.evidence_note IS DISTINCT FROM v_note
  OR v_existing.officer_uid IS DISTINCT FROM v_officer
  OR v_existing.officer_role IS DISTINCT FROM v_role
  OR v_existing.occurred_at IS DISTINCT FROM v_occurred THEN
  RAISE EXCEPTION 'CONFLICTING_OFFICE_CORRECTION_REPLAY';
 END IF;
 RETURN pg_catalog.jsonb_build_object('messageId',v_case,'stored',true,
  'ownerLinked',v_existing.claimed_by IS NOT NULL);
END;
$receive$;
CREATE OR REPLACE FUNCTION public.taxpay_demo_correction_office_initiation(p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_payment_id uuid; v_actor uuid; v_role text; v_reference text; v_tin text;
 v_reason text; v_outcome text; v_evidence text; v_p demo_payment.story_payments%rowtype;
 v_demo text; v_matches integer; v_details jsonb; v_snapshot jsonb; v_alloc jsonb; v_alloc_index integer;
 v_alloc_id text; v_count integer; v_year text; v_circle text; v_head text;
 v_typed jsonb; v_allocs jsonb; v_items jsonb; v_lines jsonb; v_snap_alloc jsonb;
 v_new_year text; v_new_circle text; v_new_head text; v_year_normal text; v_new_year_normal text;
 v_applied jsonb;
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
 or v_role is distinct from 'SUPER_ADMIN' or v_reference is null or length(v_reference) not between 6 and 80
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
 -- Exact signed allocation and current values are checked against the
 -- originating immutable payment, not the Office copy or free-text outcome.
 v_typed:=p_command->'typedCorrection';
 IF p_command ? 'typedCorrection' THEN
  IF jsonb_typeof(v_typed) IS DISTINCT FROM 'object' OR
     NOT(v_typed ?& ARRAY['allocationIndex','allocationId','currentAY','currentCircle','currentHeadCode','proposedAY','proposedCircle','proposedHeadCode']) OR
     (SELECT count(*) FROM jsonb_object_keys(v_typed))<>8 OR
     EXISTS(SELECT 1 FROM jsonb_each(v_typed) e WHERE e.key NOT IN ('allocationIndex','allocationId') AND jsonb_typeof(e.value)<>'string') OR
     jsonb_typeof(v_typed->'allocationIndex') NOT IN ('number','null') OR
     jsonb_typeof(v_typed->'allocationId') NOT IN ('string','null') THEN
   RAISE EXCEPTION 'INVALID_OFFICE_TYPED_CORRECTION';
  END IF;
  v_allocs:=case when jsonb_typeof(v_details->'allocations')='array' then v_details->'allocations' else '[]'::jsonb end;
  v_items:=case when jsonb_typeof(v_snapshot->'allocationItems')='array' then v_snapshot->'allocationItems' else '[]'::jsonb end;
  v_lines:=case when jsonb_typeof(v_details->'lines')='array' then v_details->'lines' else '[]'::jsonb end;
  v_count:=greatest(jsonb_array_length(v_allocs),jsonb_array_length(v_items),jsonb_array_length(v_lines));
  IF v_typed->>'allocationIndex' IS NOT NULL THEN
   IF v_typed->>'allocationIndex' !~ ('^[0-9]{1,6}'||chr(36)) THEN RAISE EXCEPTION 'INVALID_OFFICE_CORRECTION_ALLOCATION'; END IF;
   v_alloc_index:=(v_typed->>'allocationIndex')::integer;
  END IF;
  IF (v_count=0 AND v_alloc_index IS NOT NULL) OR (v_count>0 AND (v_alloc_index IS NULL OR v_alloc_index>=v_count)) THEN
   RAISE EXCEPTION 'INVALID_OFFICE_CORRECTION_ALLOCATION';
  END IF;
  v_alloc:=v_allocs->v_alloc_index;v_snap_alloc:=v_items->v_alloc_index;
  v_alloc_id:=nullif(coalesce(v_alloc->>'allocationId',v_snap_alloc->>'allocationId'),'');
  IF v_typed->>'allocationId' IS DISTINCT FROM v_alloc_id OR
     (v_count>1 AND (v_alloc_id IS NULL OR (v_alloc IS NULL AND v_snap_alloc IS NULL))) THEN
   RAISE EXCEPTION 'INVALID_OFFICE_CORRECTION_ALLOCATION';
  END IF;
  IF coalesce(nullif(v_alloc->>'taxpayerTin',''),nullif(v_snap_alloc->>'taxpayerTin',''),
     CASE WHEN v_count<=1 THEN nullif(v_details->>'taxpayerTin','') END) IS DISTINCT FROM v_tin THEN
   RAISE EXCEPTION 'OFFICE_INITIATION_RECIPIENT_MISMATCH';
  END IF;
  v_year:=coalesce(nullif(v_alloc->>'assessmentYear',''),nullif(v_snap_alloc->>'assessmentYear',''),
    nullif(v_lines->v_alloc_index->>'assessmentYear',''),nullif(v_snapshot->>'assessmentYear',''),nullif(v_details->>'assessmentYear',''),'');
  v_circle:=coalesce(v_snapshot->>'taxCircle',v_details->>'taxCircle','');
  v_head:=coalesce(nullif(v_snap_alloc->>'economicCode',''),nullif(v_lines->v_alloc_index->>'economicCode',''),
    nullif(v_snapshot->'items'->v_alloc_index->>'economicCode',''),
    CASE WHEN v_count<=1 THEN nullif(v_snapshot#>>'{items,0,economicCode}','') END,'');
  IF (v_typed->>'currentAY',v_typed->>'currentCircle',v_typed->>'currentHeadCode') IS DISTINCT FROM (v_year,v_circle,v_head) THEN
   RAISE EXCEPTION 'OFFICE_CORRECTION_STALE_VALUES';
  END IF;
  v_new_year:=btrim(v_typed->>'proposedAY');v_new_circle:=btrim(v_typed->>'proposedCircle');v_new_head:=btrim(v_typed->>'proposedHeadCode');
  IF (v_new_year IS DISTINCT FROM v_year AND v_new_year !~ ('^[0-9]{4}-([0-9]{2}|[0-9]{4})'||chr(36))) OR
     length(v_new_circle)>120 OR length(v_new_head)>120 OR
     (v_new_circle='' AND v_circle<>'') OR (v_new_head='' AND v_head<>'') THEN RAISE EXCEPTION 'INVALID_OFFICE_TYPED_CORRECTION'; END IF;
  v_year_normal:=case when v_year ~ ('^[0-9]{4}-[0-9]{2}'||chr(36)) then left(v_year,5)||left(v_year,2)||right(v_year,2) else v_year end;
  v_new_year_normal:=case when v_new_year ~ ('^[0-9]{4}-[0-9]{2}'||chr(36)) then left(v_new_year,5)||left(v_new_year,2)||right(v_new_year,2) else v_new_year end;
  IF (v_year_normal,v_circle,v_head) IS NOT DISTINCT FROM (v_new_year_normal,v_new_circle,v_new_head) THEN
   RAISE EXCEPTION 'CORRECTION_NO_CHANGE';
  END IF;
  v_applied:=jsonb_build_object('paymentId',v_payment_id,'allocationIndex',v_alloc_index,'allocationId',v_alloc_id,
   'assessmentYear',v_new_year,'circle',v_new_circle,'headCode',v_new_head,'sourceProject','v2','decisionMessageId',v_id);
  INSERT INTO taxpay_guest_private.story_correction_requests(id,demo_id,payment_id,request_key,allocation_index,allocation_id,
    original_reference,current_year,proposed_year,current_circle,proposed_circle,current_head,proposed_head,reason,office_initiation,
    office_sync_state,office_ack_at,review_state,review_updated_at,review_reason,applied_correction)
  VALUES(v_id,v_demo,v_payment_id,v_id,v_alloc_index,v_alloc_id,v_reference,v_year,v_new_year,v_circle,v_new_circle,v_head,v_new_head,
    v_reason,p_command,'ACKNOWLEDGED',now(),'APPROVED',now(),v_reason,v_applied)
  ON CONFLICT DO NOTHING;
  SELECT * INTO v_row FROM taxpay_guest_private.story_correction_requests WHERE id=v_id;
  IF NOT FOUND OR v_row.demo_id IS DISTINCT FROM v_demo OR v_row.office_initiation IS DISTINCT FROM p_command
    OR v_row.applied_correction IS DISTINCT FROM v_applied THEN RAISE EXCEPTION 'OFFICE_INITIATION_CONFLICT'; END IF;
  RETURN jsonb_build_object('messageId',v_id,'stored',true,'ownerLinked',true,'reviewState','APPROVED','appliedCorrection',v_applied);
 END IF;
 -- Unchanged historical free-text path, never presented as applied.
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
 'appliedCorrection',(p_row).applied_correction,
 'initiatedBy',case when (p_row).office_initiation is null then 'TAXPAYER' else 'OFFICE' end,
 'requestedOutcome',(p_row).office_initiation->>'requestedOutcome','evidenceNote',(p_row).office_initiation->>'evidenceNote') || case when (p_row).case_kind='UNSOLICITED_PAYMENT_REPORT' then jsonb_build_object('paymentCompleted',exists(select 1 from demo_payment.story_payments p where p.id=coalesce((p_row).payment_id,(p_row).recipient_initiation_id))) else '{}'::jsonb end
$$;
revoke all on function taxpay_guest_private.story_correction_json(taxpay_guest_private.story_correction_requests) from public,anon,authenticated;


CREATE OR REPLACE FUNCTION public.taxpay_notify_correction_review_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_recipient uuid; v_message_code text;
BEGIN
  v_message_code := CASE NEW.action_code
    WHEN 'MAKER_ACKNOWLEDGE' THEN 'CORRECTION_MAKER_ACKNOWLEDGED'
    WHEN 'REVIEWER_VERIFY' THEN 'CORRECTION_REVIEWER_VERIFIED'
    WHEN 'APPROVER_CLOSE' THEN 'CORRECTION_APPROVER_CLOSED'
    WHEN 'APPROVE' THEN 'CORRECTION_APPROVED'
    WHEN 'REJECT' THEN 'CORRECTION_REJECTED'
    ELSE NULL END;
  IF v_message_code IS NULL THEN RAISE EXCEPTION 'Unknown correction notification action'; END IF;
  SELECT i.requester_uid INTO v_recipient
    FROM public.taxpay_correction_inquiries i WHERE i.inquiry_id=NEW.inquiry_id;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Correction notification owner not found'; END IF;
  INSERT INTO public.taxpay_in_app_notifications(
    recipient_uid,request_id,event_id,message_code,is_read,
    correction_inquiry_id,correction_decision_id)
  VALUES(v_recipient,NULL,NULL,v_message_code,false,NEW.inquiry_id,NEW.message_id)
  ON CONFLICT (correction_decision_id)
    WHERE correction_decision_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.taxpay_correction_record_office_decision(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_correction_record_office_decision(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.taxpay_demo_correction_office_decision(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_demo_correction_office_decision(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.taxpay_correction_receive_office_initiation(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_correction_receive_office_initiation(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.taxpay_demo_correction_office_initiation(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_demo_correction_office_initiation(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.taxpay_notify_correction_review_decision() FROM PUBLIC,anon,authenticated;
COMMIT;
