-- Isolated SQL contract test for the TaxPay side of Office correction review.
-- Run only against the disposable Supabase database created by CI.
BEGIN;

CREATE TEMP TABLE correction_bridge_test_state(inquiry_id uuid NOT NULL) ON COMMIT DROP;
GRANT SELECT,INSERT ON correction_bridge_test_state TO authenticated,service_role;

INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES ('80000000-0000-4000-8000-000000000001','correction-bridge-test@example.invalid','{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
WITH inserted AS (
  INSERT INTO public.taxpay_correction_inquiries
    (requester_uid,original_reference,reason,requested_outcome,change_kind,old_value,new_value)
  VALUES
    ('80000000-0000-4000-8000-000000000001','SYN-REF-003',
     'Synthetic evidence-pending review request','Review this synthetic payment reference',
     'CIRCLE','Circle A','Circle B')
  RETURNING inquiry_id
)
INSERT INTO correction_bridge_test_state SELECT inquiry_id FROM inserted;

DO $owner_initial$
DECLARE v_count integer; v_state text; v_revision integer;
BEGIN
  SELECT count(*),min(office_review_state),min(office_review_revision)
    INTO v_count,v_state,v_revision FROM public.taxpay_correction_inquiries
    WHERE inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state);
  IF v_count<>1 OR v_state IS DISTINCT FROM 'PENDING_OFFICER' OR v_revision<>1 THEN
    RAISE EXCEPTION 'Initial owner correction readback failed';
  END IF;
END;
$owner_initial$;

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT public.taxpay_correction_record_office_decision(jsonb_build_object(
  'schemaVersion','1.0.0','commandType','CORRECTION_REVIEW',
  'messageId','80000000-0000-4000-8000-000000000011',
  'requestId',(SELECT inquiry_id::text FROM correction_bridge_test_state),
  'origin','OFFICE_SQL','action','MAKER_ACKNOWLEDGE',
  'officerUid','80000000-0000-4000-8000-000000000021','officerRole','MAKER',
  'reason','Synthetic maker acknowledgment for SQL contract test',
  'idempotencyKey','80000000-0000-4000-8000-000000000031',
  'expectedReviewState','PENDING_OFFICER','occurredAt','2026-10-29T17:00:00.000Z'
));
SELECT public.taxpay_correction_record_office_decision(jsonb_build_object(
  'schemaVersion','1.0.0','commandType','CORRECTION_REVIEW',
  'messageId','80000000-0000-4000-8000-000000000012',
  'requestId',(SELECT inquiry_id::text FROM correction_bridge_test_state),
  'origin','OFFICE_SQL','action','REVIEWER_VERIFY',
  'officerUid','80000000-0000-4000-8000-000000000022','officerRole','REVIEWER',
  'reason','Synthetic reviewer verification for SQL contract test',
  'idempotencyKey','80000000-0000-4000-8000-000000000032',
  'expectedReviewState','MAKER_ACKNOWLEDGED','occurredAt','2026-10-29T17:01:00.000Z'
));
SELECT public.taxpay_correction_record_office_decision(jsonb_build_object(
  'schemaVersion','1.0.0','commandType','CORRECTION_REVIEW',
  'messageId','80000000-0000-4000-8000-000000000013',
  'requestId',(SELECT inquiry_id::text FROM correction_bridge_test_state),
  'origin','OFFICE_SQL','action','APPROVER_CLOSE',
  'officerUid','80000000-0000-4000-8000-000000000023','officerRole','APPROVER',
  'reason','Synthetic approver closure for SQL contract test',
  'idempotencyKey','80000000-0000-4000-8000-000000000033',
  'expectedReviewState','REVIEWER_VERIFIED','occurredAt','2026-10-29T17:02:00.000Z'
));

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
DO $owner_final$
DECLARE v_count integer; v_state text; v_revision integer;
DECLARE v_evidence_ok boolean; v_claimant boolean; v_receipt boolean; v_financial boolean;
BEGIN
  SELECT count(*),min(office_review_state),min(office_review_revision),
    bool_and(evidence_state='PENDING_EVIDENCE'),bool_and(claimant_verified=false),
    bool_and(original_receipt_verified=false),bool_and(may_change_financial_records=false)
  INTO v_count,v_state,v_revision,v_evidence_ok,v_claimant,v_receipt,v_financial
  FROM public.taxpay_correction_inquiries
  WHERE inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state);
  IF v_count<>1 OR v_state IS DISTINCT FROM 'APPROVER_CLOSED' OR v_revision<>4
     OR v_evidence_ok IS DISTINCT FROM true OR v_claimant IS DISTINCT FROM true
     OR v_receipt IS DISTINCT FROM true OR v_financial IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Final owner correction readback or non-financial status failed';
  END IF;
END;
$owner_final$;

RESET ROLE;
DO $test$
DECLARE v_inquiry uuid; v_payload jsonb;
BEGIN
  SELECT inquiry_id INTO v_inquiry FROM correction_bridge_test_state;
  SELECT event_payload INTO v_payload FROM payment_sync.correction_outbox WHERE inquiry_id=v_inquiry;
  IF v_payload->>'originalReference'<>'SYN-REF-003'
     OR v_payload ? 'requesterUid' OR v_payload ? 'requester_uid'
     OR v_payload ? 'taxpayerTin' OR v_payload ? 'tin' THEN
    RAISE EXCEPTION 'Correction outbox payload contains missing or over-scoped fields';
  END IF;
  IF (SELECT count(*) FROM public.taxpay_correction_review_decisions WHERE inquiry_id=v_inquiry)<>3 THEN
    RAISE EXCEPTION 'Expected three persisted Office review decisions';
  END IF;
END;
$test$;

ROLLBACK;
