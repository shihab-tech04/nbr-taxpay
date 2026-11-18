-- Phase 6: signed Office-originated correction intake and authenticated
-- taxpayer claim. No service can impersonate a taxpayer or alter money.
-- Unlinked cases remain in a private durable inbox until the actual taxpayer
-- signs in with an established TIN-account binding.
BEGIN;
CREATE TABLE payment_sync.office_initiated_correction_inbox (
 case_id uuid PRIMARY KEY,
 source_payment_id uuid NOT NULL REFERENCES demo_payment.story_payments(id),
 original_reference text NOT NULL,
 taxpayer_tin text NOT NULL CHECK(taxpayer_tin ~ '^[0-9]{12,13}$'),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 10 AND 1000),
 requested_outcome text NOT NULL CHECK(char_length(btrim(requested_outcome)) BETWEEN 10 AND 600),
 evidence_note text NOT NULL CHECK(
   char_length(btrim(evidence_note)) BETWEEN 10 AND 2000
   AND octet_length(evidence_note)<=8000
 ),
 officer_uid uuid NOT NULL,
 officer_role text NOT NULL CHECK(officer_role IN ('MAKER','APPROVER')),
 occurred_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 claimed_by uuid REFERENCES auth.users(id),
 claimed_at timestamptz
);
ALTER TABLE payment_sync.office_initiated_correction_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sync.office_initiated_correction_inbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON payment_sync.office_initiated_correction_inbox FROM PUBLIC,anon,authenticated;
CREATE INDEX taxpay_office_initiated_pending_idx
 ON payment_sync.office_initiated_correction_inbox(taxpayer_tin,received_at)
 WHERE claimed_by IS NULL;

ALTER TABLE public.taxpay_correction_inquiries
 ADD COLUMN origin_system text NOT NULL DEFAULT 'TAXPAY_SQL'
   CHECK (origin_system IN ('TAXPAY_SQL','OFFICE_SQL'));
GRANT SELECT(origin_system) ON public.taxpay_correction_inquiries TO authenticated;

CREATE FUNCTION public.taxpay_correction_receive_office_initiation(p_command jsonb)
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
    OR octet_length(v_note)>8000 OR v_role NOT IN ('MAKER','APPROVER') THEN
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
REVOKE ALL ON FUNCTION public.taxpay_correction_receive_office_initiation(jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_correction_receive_office_initiation(jsonb)
 TO service_role;

-- Allow one genuine initial Office-notification target per linked correction.
-- Existing payment notices and Office decision notices remain unchanged.
ALTER TABLE public.taxpay_in_app_notifications
 DROP CONSTRAINT taxpay_notifications_one_target_check;
ALTER TABLE public.taxpay_in_app_notifications
 ADD CONSTRAINT taxpay_notifications_one_target_check CHECK (
  (request_id IS NOT NULL AND event_id IS NOT NULL
   AND correction_inquiry_id IS NULL AND correction_decision_id IS NULL)
  OR
  (request_id IS NULL AND event_id IS NULL AND correction_inquiry_id IS NOT NULL
   AND correction_decision_id IS NOT NULL)
  OR
  (request_id IS NULL AND event_id IS NULL AND correction_inquiry_id IS NOT NULL
   AND correction_decision_id IS NULL AND message_code='CORRECTION_OFFICE_INITIATED')
 ) NOT VALID;
ALTER TABLE public.taxpay_in_app_notifications
 VALIDATE CONSTRAINT taxpay_notifications_one_target_check;
CREATE UNIQUE INDEX taxpay_office_initiation_notice_unique
 ON public.taxpay_in_app_notifications(correction_inquiry_id)
 WHERE message_code='CORRECTION_OFFICE_INITIATED';

-- Update the existing source event envelope without changing its identity.
CREATE OR REPLACE FUNCTION public.taxpay_enqueue_correction_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $outbox$
BEGIN
 INSERT INTO payment_sync.correction_outbox(inquiry_id,event_payload)
 VALUES(NEW.inquiry_id,pg_catalog.jsonb_build_object(
  'originalReference',NEW.original_reference,
  'originalPaymentId',NEW.original_payment_id,
  'originalPaymentKind',NEW.original_payment_kind,
  'targetAllocationId',NEW.target_allocation_id,
  'caseKind',NEW.case_kind,'originSystem',NEW.origin_system,
  'reason',NEW.reason,'evidenceNote',NEW.evidence_note,
  'requestedOutcome',NEW.requested_outcome,
  'evidenceState',NEW.evidence_state,
  'claimantVerified',NEW.claimant_verified,
  'originalReceiptVerified',NEW.original_receipt_verified,
  'mayChangeFinancialRecords',NEW.may_change_financial_records,
  'changeKind',NEW.change_kind,'oldValue',NEW.old_value,
  'newValue',NEW.new_value,'createdAt',NEW.created_at
 ));
 RETURN NEW;
END;
$outbox$;
REVOKE ALL ON FUNCTION public.taxpay_enqueue_correction_submission()
 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.taxpay_claim_office_initiated_corrections(p_limit integer DEFAULT 20)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $claim$
DECLARE v_actor uuid:=auth.uid();v_case payment_sync.office_initiated_correction_inbox%ROWTYPE;
 v_owner boolean;v_alloc_count bigint;v_alloc text;v_claimed integer:=0;
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATED_ACCOUNT_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN
  RAISE EXCEPTION 'Invalid Office initiation claim limit';
 END IF;
 FOR v_case IN
  SELECT q.* FROM payment_sync.office_initiated_correction_inbox q
  WHERE q.claimed_by IS NULL
    AND EXISTS(
      SELECT 1 FROM public.sim_payment_account_bindings b
      JOIN public.taxpay_taxpayer_registration_profiles p
        ON p.account_id=b.user_id
      WHERE b.owner_uid=v_actor AND p.tin=q.taxpayer_tin
    )
  ORDER BY q.occurred_at,q.case_id LIMIT p_limit FOR UPDATE SKIP LOCKED
 LOOP
  -- Never accept a typed TIN alone as account ownership.
  IF (SELECT count(DISTINCT b.user_id) FROM public.sim_payment_account_bindings b
      JOIN public.taxpay_taxpayer_registration_profiles p ON p.account_id=b.user_id
      WHERE b.owner_uid=v_actor AND p.tin=v_case.taxpayer_tin)<>1 THEN CONTINUE; END IF;
  SELECT EXISTS(
   SELECT 1 FROM public.taxpay_story1_payment_owners o
   WHERE o.payment_id=v_case.source_payment_id AND o.owner_uid=v_actor
  ) INTO v_owner;
  SELECT count(*), (pg_catalog.array_agg(a.line->>'allocationId'))[1]
   INTO v_alloc_count,v_alloc
   FROM demo_payment.story_payments p
   CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
    CASE WHEN pg_catalog.jsonb_typeof(p.data#>'{details,allocations}')='array'
      THEN p.data#>'{details,allocations}' ELSE '[]'::jsonb END
   ) a(line)
   WHERE p.id=v_case.source_payment_id AND a.line->>'taxpayerTin'=v_case.taxpayer_tin;
  -- For a non-payer beneficiary, the source allocation must be unique;
  -- an ambiguous multi-head parent remains pending rather than guessed.
  IF NOT v_owner AND (v_alloc_count<>1 OR v_alloc IS NULL) THEN CONTINUE; END IF;
  INSERT INTO public.taxpay_correction_inquiries(
    inquiry_id,requester_uid,original_reference,reason,requested_outcome,
    case_kind,evidence_note,target_allocation_id,origin_system,created_at)
  VALUES(v_case.case_id,v_actor,v_case.original_reference,v_case.reason,
    v_case.requested_outcome,'CORRECTION_REVIEW',v_case.evidence_note,
    CASE WHEN v_owner THEN NULL ELSE v_alloc END,
    'OFFICE_SQL',v_case.occurred_at)
  ON CONFLICT(inquiry_id) DO NOTHING;
  IF NOT EXISTS(
    SELECT 1 FROM public.taxpay_correction_inquiries i
    WHERE i.inquiry_id=v_case.case_id AND i.requester_uid=v_actor
      AND i.original_payment_id=v_case.source_payment_id
      AND i.origin_system='OFFICE_SQL'
  ) THEN RAISE EXCEPTION 'OFFICE_INITIATION_CLAIM_CONFLICT'; END IF;
  UPDATE payment_sync.office_initiated_correction_inbox
  SET claimed_by=v_actor,claimed_at=now()
  WHERE case_id=v_case.case_id AND claimed_by IS NULL;
  INSERT INTO public.taxpay_in_app_notifications(
    recipient_uid,request_id,event_id,message_code,is_read,
    correction_inquiry_id,correction_decision_id)
  VALUES(v_actor,NULL,NULL,'CORRECTION_OFFICE_INITIATED',false,v_case.case_id,NULL)
  ON CONFLICT(correction_inquiry_id)
   WHERE message_code='CORRECTION_OFFICE_INITIATED' DO NOTHING;
  v_claimed:=v_claimed+1;
 END LOOP;
 RETURN v_claimed;
END;
$claim$;
REVOKE ALL ON FUNCTION public.taxpay_claim_office_initiated_corrections(integer)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.taxpay_claim_office_initiated_corrections(integer)
 TO authenticated;
COMMENT ON TABLE payment_sync.office_initiated_correction_inbox IS
 'Private signed Office correction intake. Claim only by a real signed-in bound account and verified original Taxpayer SQL payment. No payment/credit mutation.';
COMMIT;
