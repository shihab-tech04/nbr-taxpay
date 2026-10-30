-- Isolated SQL contract test for the TaxPay side of Office correction review.
-- Run only against the disposable Supabase database created by CI.
BEGIN;

CREATE TEMP TABLE correction_bridge_test_state(
  inquiry_id uuid NOT NULL,event_id uuid,claim_token uuid
) ON COMMIT DROP;
GRANT SELECT,INSERT,UPDATE ON correction_bridge_test_state TO authenticated,service_role;

CREATE TEMP TABLE correction_financial_guard(
  relation_name text PRIMARY KEY,row_count bigint NOT NULL,content_digest text NOT NULL
) ON COMMIT DROP;
DO $snapshot_financial$
DECLARE v_relation regclass; v_name text; v_count bigint; v_digest text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'public.taxpay_payment_requests','public.sim_payment_transactions',
    'public.sim_payment_allocations','payment_sync.requests','payment_sync.events',
    'payment_sync.request_mutations','payment_sync.notifications',
    'demo_payment.story_payments','demo_payment.story_notifications'
  ] LOOP
    v_relation := pg_catalog.to_regclass(v_name);
    IF v_relation IS NULL THEN CONTINUE; END IF;
    EXECUTE pg_catalog.format(
      'SELECT count(*)::bigint,pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(row_to_json(t)::text), '''' ORDER BY row_to_json(t)::text),'''')) FROM %s t',
      v_relation
    ) INTO v_count,v_digest;
    INSERT INTO correction_financial_guard VALUES(v_relation::text,v_count,v_digest);
  END LOOP;
END;
$snapshot_financial$;

INSERT INTO auth.users(id,email,raw_user_meta_data)
VALUES
  ('80000000-0000-4000-8000-000000000001','correction-bridge-test@example.invalid','{}'::jsonb),
  ('80000000-0000-4000-8000-000000000002','correction-outsider-test@example.invalid','{}'::jsonb)
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

-- Exercise the durable TaxPay outbox through a network failure and retry.
RESET ROLE;
SET LOCAL ROLE service_role;
DO $outbox_first_claim$
DECLARE v_batch jsonb; v_item jsonb; v_event uuid; v_token uuid;
BEGIN
  v_batch := public.taxpay_correction_internal_claim(10);
  IF pg_catalog.jsonb_array_length(v_batch)<>1 THEN
    RAISE EXCEPTION 'Expected one correction outbox claim';
  END IF;
  v_item := v_batch->0;
  v_event := (v_item->'event'->>'eventId')::uuid;
  v_token := (v_item->>'claimToken')::uuid;
  UPDATE correction_bridge_test_state SET event_id=v_event,claim_token=v_token;
  PERFORM public.taxpay_correction_internal_ack(v_event,v_token,false,'synthetic network failure');
  BEGIN
    PERFORM public.taxpay_correction_internal_ack(v_event,v_token,true,NULL);
    RAISE EXCEPTION 'Stale correction claim was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Stale correction claim was accepted' THEN RAISE; END IF;
  END;
END;
$outbox_first_claim$;

RESET ROLE;
DO $outbox_failed_state$
DECLARE v_state text; v_attempts integer; v_token uuid; v_error text; v_retry timestamptz;
BEGIN
  SELECT delivery_state,attempts,claim_token,last_error,next_attempt_at
    INTO v_state,v_attempts,v_token,v_error,v_retry
    FROM payment_sync.correction_outbox
    WHERE event_id=(SELECT event_id FROM correction_bridge_test_state);
  IF v_state IS DISTINCT FROM 'FAILED' OR v_attempts<>1 OR v_token IS NOT NULL
     OR v_error IS DISTINCT FROM 'synthetic network failure' OR v_retry<=now() THEN
    RAISE EXCEPTION 'Correction delivery failure was not durably recorded for retry';
  END IF;
END;
$outbox_failed_state$;
UPDATE payment_sync.correction_outbox SET next_attempt_at=now()
WHERE event_id=(SELECT event_id FROM correction_bridge_test_state);

SET LOCAL ROLE service_role;
DO $outbox_retry$
DECLARE v_batch jsonb; v_item jsonb; v_event uuid; v_token uuid; v_previous uuid;
BEGIN
  SELECT claim_token INTO v_previous FROM correction_bridge_test_state;
  v_batch := public.taxpay_correction_internal_claim(10);
  IF pg_catalog.jsonb_array_length(v_batch)<>1 THEN RAISE EXCEPTION 'Correction retry was not claimed'; END IF;
  v_item := v_batch->0;
  v_event := (v_item->'event'->>'eventId')::uuid;
  v_token := (v_item->>'claimToken')::uuid;
  IF v_event IS DISTINCT FROM (SELECT event_id FROM correction_bridge_test_state)
     OR v_token IS NULL OR v_token=v_previous THEN
    RAISE EXCEPTION 'Correction retry did not issue a fresh claim token';
  END IF;
  UPDATE correction_bridge_test_state SET claim_token=v_token;
  PERFORM public.taxpay_correction_internal_ack(v_event,v_token,true,NULL);
END;
$outbox_retry$;

RESET ROLE;
DO $outbox_acknowledged$
DECLARE v_state text; v_attempts integer; v_ack timestamptz;
BEGIN
  SELECT delivery_state,attempts,acknowledged_at INTO v_state,v_attempts,v_ack
    FROM payment_sync.correction_outbox
    WHERE event_id=(SELECT event_id FROM correction_bridge_test_state);
  IF v_state IS DISTINCT FROM 'ACKNOWLEDGED' OR v_attempts<>2 OR v_ack IS NULL THEN
    RAISE EXCEPTION 'Correction retry did not persist acknowledgment';
  END IF;
END;
$outbox_acknowledged$;

SET LOCAL ROLE service_role;
DO $command_rejections$
DECLARE v_inquiry uuid := (SELECT inquiry_id FROM correction_bridge_test_state);
BEGIN
  BEGIN
    PERFORM public.taxpay_correction_record_office_decision(pg_catalog.jsonb_build_object(
      'schemaVersion','1.0.0','commandType','CORRECTION_REVIEW',
      'messageId','80000000-0000-4000-8000-000000000014','requestId',v_inquiry,
      'origin','OFFICE_SQL','action','MAKER_ACKNOWLEDGE',
      'officerUid','80000000-0000-4000-8000-000000000024','officerRole','REVIEWER',
      'reason','Incorrect role must not create a correction decision',
      'idempotencyKey','80000000-0000-4000-8000-000000000034',
      'expectedReviewState','PENDING_OFFICER'));
    RAISE EXCEPTION 'Incorrect role was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'Invalid correction review action' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.taxpay_correction_record_office_decision(pg_catalog.jsonb_build_object(
      'schemaVersion','1.0.0','commandType','CORRECTION_REVIEW',
      'messageId','80000000-0000-4000-8000-000000000015','requestId',v_inquiry,
      'origin','OFFICE_SQL','action','MAKER_ACKNOWLEDGE',
      'officerUid','80000000-0000-4000-8000-000000000024','officerRole','MAKER',
      'reason','Stale correction command must be rejected',
      'idempotencyKey','80000000-0000-4000-8000-000000000035',
      'expectedReviewState','REVIEWER_VERIFIED'));
    RAISE EXCEPTION 'Stale correction command was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'Correction review state changed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.taxpay_correction_record_office_decision(pg_catalog.jsonb_build_object(
      'schemaVersion','1.0.0','commandType','CORRECTION_REVIEW',
      'messageId','80000000-0000-4000-8000-000000000016','requestId','80000000-0000-4000-8000-000000000099',
      'origin','OFFICE_SQL','action','MAKER_ACKNOWLEDGE',
      'officerUid','80000000-0000-4000-8000-000000000024','officerRole','MAKER',
      'reason','Missing correction inquiry must be rejected',
      'idempotencyKey','80000000-0000-4000-8000-000000000036',
      'expectedReviewState','PENDING_OFFICER'));
    RAISE EXCEPTION 'Missing correction inquiry was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'Correction inquiry not found' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.taxpay_correction_review_decisions
             WHERE inquiry_id=v_inquiry) THEN
    RAISE EXCEPTION 'Rejected commands changed persisted review state';
  END IF;
END;
$command_rejections$;

DO $maker_replay$
DECLARE v_command jsonb; v_first jsonb; v_second jsonb;
BEGIN
  v_command := pg_catalog.jsonb_build_object(
    'schemaVersion','1.0.0','commandType','CORRECTION_REVIEW',
    'messageId','80000000-0000-4000-8000-000000000011',
    'requestId',(SELECT inquiry_id::text FROM correction_bridge_test_state),
    'origin','OFFICE_SQL','action','MAKER_ACKNOWLEDGE',
    'officerUid','80000000-0000-4000-8000-000000000021','officerRole','MAKER',
    'reason','Synthetic maker acknowledgment for SQL contract test',
    'idempotencyKey','80000000-0000-4000-8000-000000000031',
    'expectedReviewState','PENDING_OFFICER','occurredAt','2026-10-29T17:00:00.000Z');
  v_first := public.taxpay_correction_record_office_decision(v_command);
  v_second := public.taxpay_correction_record_office_decision(v_command);
  IF v_first->>'duplicate'<>'false' OR v_second->>'duplicate'<>'true' THEN
    RAISE EXCEPTION 'TaxPay decision replay was not idempotent';
  END IF;
END;
$maker_replay$;

DO $same_officer_denial$
BEGIN
  BEGIN
    PERFORM public.taxpay_correction_record_office_decision(pg_catalog.jsonb_build_object(
      'schemaVersion','1.0.0','commandType','CORRECTION_REVIEW',
      'messageId','80000000-0000-4000-8000-000000000017',
      'requestId',(SELECT inquiry_id::text FROM correction_bridge_test_state),
      'origin','OFFICE_SQL','action','REVIEWER_VERIFY',
      'officerUid','80000000-0000-4000-8000-000000000021','officerRole','REVIEWER',
      'reason','One officer cannot review their own maker decision',
      'idempotencyKey','80000000-0000-4000-8000-000000000037',
      'expectedReviewState','MAKER_ACKNOWLEDGED'));
    RAISE EXCEPTION 'Same-officer review was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'Correction reviewers must be separate officers' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.taxpay_correction_record_office_decision(pg_catalog.jsonb_build_object(
      'schemaVersion','1.0.0','commandType','CORRECTION_REVIEW',
      'messageId','80000000-0000-4000-8000-000000000018',
      'requestId',(SELECT inquiry_id::text FROM correction_bridge_test_state),
      'origin','OFFICE_SQL','action','REVIEWER_VERIFY',
      'officerUid','80000000-0000-4000-8000-000000000022','officerRole','REVIEWER',
      'reason','Stale reviewer state must not be accepted',
      'idempotencyKey','80000000-0000-4000-8000-000000000038',
      'expectedReviewState','PENDING_OFFICER'));
    RAISE EXCEPTION 'Stale reviewer state was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'Correction review state changed' THEN RAISE; END IF;
  END;
END;
$same_officer_denial$;

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

DO $owner_notices$
DECLARE v_count integer; v_distinct integer; v_messages text[];
BEGIN
  SELECT count(*),count(DISTINCT correction_decision_id),
         array_agg(message_code ORDER BY message_code)
    INTO v_count,v_distinct,v_messages
    FROM public.taxpay_in_app_notifications
    WHERE correction_inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state);
  IF v_count<>3 OR v_distinct<>3
     OR v_messages IS DISTINCT FROM ARRAY[
       'CORRECTION_APPROVER_CLOSED','CORRECTION_MAKER_ACKNOWLEDGED',
       'CORRECTION_REVIEWER_VERIFIED']::text[]
     OR EXISTS (SELECT 1 FROM public.taxpay_in_app_notifications
       WHERE correction_inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state)
         AND (recipient_uid<>'80000000-0000-4000-8000-000000000001'
           OR request_id IS NOT NULL OR event_id IS NOT NULL OR is_read IS DISTINCT FROM false)) THEN
    RAISE EXCEPTION 'Correction decision notifications were missing, duplicated or malformed';
  END IF;
END;
$owner_notices$;
UPDATE public.taxpay_in_app_notifications SET is_read=true
WHERE correction_inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state)
  AND recipient_uid='80000000-0000-4000-8000-000000000001'
  AND message_code='CORRECTION_APPROVER_CLOSED';
DO $owner_notice_read$
BEGIN
  IF (SELECT count(*) FROM public.taxpay_in_app_notifications
      WHERE correction_inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state)
        AND is_read=true)<>1 THEN
    RAISE EXCEPTION 'Taxpayer correction notification read state did not persist';
  END IF;
END;
$owner_notice_read$;
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
DO $outsider_notice$
DECLARE v_visible integer; v_updated integer;
BEGIN
  SELECT count(*) INTO v_visible FROM public.taxpay_in_app_notifications
    WHERE correction_inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state);
  UPDATE public.taxpay_in_app_notifications SET is_read=false
    WHERE correction_inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_visible<>0 OR v_updated<>0 THEN
    RAISE EXCEPTION 'Unrelated account could read or change a correction notification';
  END IF;
END;
$outsider_notice$;
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
DO $notice_refresh$
BEGIN
  IF (SELECT count(*) FROM public.taxpay_in_app_notifications
      WHERE correction_inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state)
        AND is_read=true)<>1 THEN
    RAISE EXCEPTION 'Correction notification read state did not survive identity refresh';
  END IF;
END;
$notice_refresh$;

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

DO $financial_unchanged$
DECLARE v_relation regclass; v_name text; v_count bigint; v_digest text; v_expected record;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'public.taxpay_payment_requests','public.sim_payment_transactions',
    'public.sim_payment_allocations','payment_sync.requests','payment_sync.events',
    'payment_sync.request_mutations','payment_sync.notifications',
    'demo_payment.story_payments','demo_payment.story_notifications'
  ] LOOP
    v_relation := pg_catalog.to_regclass(v_name);
    IF v_relation IS NULL THEN CONTINUE; END IF;
    EXECUTE pg_catalog.format(
      'SELECT count(*)::bigint,pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(row_to_json(t)::text), '''' ORDER BY row_to_json(t)::text),'''')) FROM %s t',
      v_relation
    ) INTO v_count,v_digest;
    SELECT * INTO v_expected FROM correction_financial_guard
      WHERE relation_name=v_relation::text;
    IF NOT FOUND OR v_expected.row_count<>v_count OR v_expected.content_digest<>v_digest THEN
      RAISE EXCEPTION 'Correction review unexpectedly mutated financial/payment rows in %',v_relation;
    END IF;
  END LOOP;
END;
$financial_unchanged$;

ROLLBACK;
