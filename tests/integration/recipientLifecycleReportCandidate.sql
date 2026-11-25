-- Disposable original Taxpayer SQL recipient allocation/read-state contract.
-- All synthetic payments and read receipts disappear after ROLLBACK.
BEGIN;
DO $demo_recipient_notice$
DECLARE
  payer jsonb; recipient2 jsonb; recipient3 jsonb;
  payer_hash text; recipient2_hash text; recipient3_hash text;
  session_id uuid; list_id uuid; payment_key uuid:=gen_random_uuid();
  lines jsonb; allocations jsonb; snapshot jsonb; payload jsonb;
  payment jsonb; replay jsonb; notice2 jsonb; notice3 jsonb;
  event2 text; event3 text; ack jsonb;
  payment_id uuid; before_data jsonb; early_report jsonb;
  before_outbox bigint; before_payment_count bigint;
  before_story_notices bigint; denied boolean;
  invalid_case text; bad_payload jsonb; v_bad_key uuid;
BEGIN
  IF has_function_privilege('anon',
       'public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)','EXECUTE')
    OR has_function_privilege('authenticated',
       'public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)','EXECUTE')
    OR NOT has_function_privilege('service_role',
       'public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)','EXECUTE')
    OR has_table_privilege('anon',
       'taxpay_guest_private.demo_received_payment_notice_ack','SELECT')
  THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_DIRECT_ACCESS'; END IF;

  payer:=public.taxpay_demo_profile_login('user1','user1');
  recipient2:=public.taxpay_demo_profile_login('user2','user2');
  recipient3:=public.taxpay_demo_profile_login('user3','user3');
  payer_hash:=encode(extensions.digest(convert_to(payer->>'capability','UTF8'),'sha256'),'hex');
  recipient2_hash:=encode(extensions.digest(convert_to(recipient2->>'capability','UTF8'),'sha256'),'hex');
  recipient3_hash:=encode(extensions.digest(convert_to(recipient3->>'capability','UTF8'),'sha256'),'hex');
  session_id:=(payer->>'paymentSessionId')::uuid;
  list_id:=(public.taxpay_guest_beneficiary_create_list(payer_hash,'Recipient notice WS3')->>'id')::uuid;
  IF public.taxpay_guest_beneficiary_add(payer_hash,list_id,
    '[{"tin":"222222222222","display_name":"WS3 recipient 2","tag":"clients"},
      {"tin":"333333333333","display_name":"WS3 recipient 3","tag":"clients"}]'::jsonb)<>2
  THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_SAVED_PEOPLE_FAILED'; END IF;
  lines:=jsonb_build_array(
    jsonb_build_object('headId',121,'economicCode','64','headNameEn','Advance Tax',
      'totalAmount',15,'taxAmount',15,'penaltyAmount',0,'surchargeAmount',0,'interestAmount',0),
    jsonb_build_object('headId',145,'economicCode','135','headNameEn','Tax on notice of demand',
      'totalAmount',35,'taxAmount',35,'penaltyAmount',0,'surchargeAmount',0,'interestAmount',0));
  allocations:=jsonb_build_array(
    jsonb_build_object('allocationId','ws3-recipient-2','taxpayerTin','222222222222',
      'taxpayerName','WS3 recipient 2','headId',121,'assessmentYear','2026-27',
      'amountMinor',1500,'serviceCode','ADVANCE_TAX','isWithholding',false),
    jsonb_build_object('allocationId','ws3-recipient-3','taxpayerTin','333333333333',
      'taxpayerName','WS3 recipient 3','headId',145,'assessmentYear','2025-26',
      'amountMinor',3500,'serviceCode','ASSESSED_DEMAND','isWithholding',false));
  snapshot:=jsonb_build_object('paymentCategory','OTHER_TAX_PAYMENT','totalAmount',50,
    'challanNo','SIM-'||payment_key::text,'items',lines,
    'allocationItems',jsonb_build_array(
      jsonb_build_object('allocationId','ws3-recipient-2','taxpayerTin','222222222222',
        'assessmentYear','2026-27','amountMinor',1500,'paymentServiceEn','Advance Tax','economicCode','64'),
      jsonb_build_object('allocationId','ws3-recipient-3','taxpayerTin','333333333333',
        'assessmentYear','2025-26','amountMinor',3500,
        'paymentServiceEn','Tax on notice of demand','economicCode','135')),
    'isSimulatedDemo',true);
  payload:=jsonb_build_object(
    'origin','TAXPAY_UI','idempotencyKey',payment_key,
    'sessionId',session_id,'service','OTHER_TAX_PAYMENT','amountMinor',5000,
    'details',jsonb_build_object(
      'payerId','user1','payerName','WS3 disposable payer','payerMode','OTHER',
      'combinedPayment',true,'allocationContractVersion',3,'allocationCount',2,'taxpayerCount',2,
      'receiptReference','SIM-'||payment_key::text,
      'challanRemarks',E'বাংলা মন্তব্য: করের বিস্তারিত তথ্য\nThis comment is longer than twenty characters.',
      'totalAmount',50,'assessmentYear','2026-27, 2025-26','taxpayerTin','',
      'lines',lines,'receiptLines',lines,'allocations',allocations,
      'receiptSnapshot',snapshot));
  -- Staging must not create a completed parent, payer-success notice or outbox.
  SELECT count(*) INTO before_payment_count FROM demo_payment.story_payments;
  SELECT count(*) INTO before_story_notices FROM demo_payment.story_notifications;
  SELECT count(*) INTO before_outbox FROM demo_payment.mirror_outbox;
  payment:=public.taxpay_demo_story1_initiate(payer_hash,payload);
  payment_id:=(payment->>'id')::uuid;
  replay:=public.taxpay_demo_story1_initiate(payer_hash,payload);
  IF payment->>'status'<>'SIMULATED_INITIATED' OR replay->>'id'<>payment_id::text
    OR replay->>'replayed'<>'true' OR (SELECT count(*) FROM demo_payment.story_payments)<>before_payment_count
    OR (SELECT count(*) FROM demo_payment.story_notifications)<>before_story_notices
    OR (SELECT count(*) FROM demo_payment.mirror_outbox)<>before_outbox
  THEN RAISE EXCEPTION 'INITIATION_SOURCE_MUTATION'; END IF;
  notice2:=public.taxpay_demo_received_payment_notices(recipient2_hash,'unread');
  event2:=payment_id::text||':allocation:1';
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(notice2->'items') x WHERE x->>'eventId'=event2 AND x->>'paymentStatus'='SIMULATED_INITIATED' AND x->>'amountMinor'='1500')
  THEN RAISE EXCEPTION 'INITIATION_RECIPIENT_MISSING'; END IF;
  early_report:=public.taxpay_demo_received_payment_report_save(recipient2_hash,event2,gen_random_uuid(),'Unrecognized simulated payment allocation');
  IF early_report->>'paymentId'<>payment_id::text OR early_report->>'paymentCompleted'<>'false'
    OR jsonb_array_length(public.taxpay_demo_correction_claim(1,(early_report->>'id')::uuid))<>0
  THEN RAISE EXCEPTION 'INITIATED_REPORT_OR_PREMATURE_OFFICE_DISPATCH'; END IF;
  payment:=public.taxpay_demo_story1_submit(payer_hash,payload);
  IF payment->>'id'<>payment_id::text OR payment->>'status'<>'SIMULATED_SUCCESS'
  THEN RAISE EXCEPTION 'INITIATION_COMPLETION_ID_DRIFT'; END IF;
  payment_id:=(payment->>'id')::uuid;
  replay:=public.taxpay_demo_story1_submit(payer_hash,payload);
  IF payment->>'replayed' IS DISTINCT FROM 'false'
    OR replay->>'id' IS DISTINCT FROM payment_id::text
    OR replay->>'replayed' IS DISTINCT FROM 'true'
  THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_PAYMENT_SOURCE_RETRY_FAILED'; END IF;

  -- Snapshot original rows first; each attempted malformed payment must leave
  -- the source payment, notification and relay outbox counts unchanged.
  SELECT count(*) INTO before_payment_count FROM demo_payment.story_payments;
  SELECT count(*) INTO before_story_notices FROM demo_payment.story_notifications;
  SELECT count(*) INTO before_outbox FROM demo_payment.mirror_outbox;

  -- A malformed new v3 combined payment is rejected at the original source,
  -- before any immutable payment, notification or mirror outbox is created.
  FOR invalid_case IN SELECT unnest(ARRAY[
    'MISSING_ALLOCATION_ID','DUPLICATE_ALLOCATION_ID',
    'ALLOCATION_AMOUNT_DRIFT','MISSING_LINE_SERVICE','PARENT_TOTAL_DRIFT'
  ]) LOOP
    v_bad_key := pg_catalog.gen_random_uuid();
    bad_payload := pg_catalog.jsonb_set(payload,'{idempotencyKey}',
      pg_catalog.to_jsonb(v_bad_key::text));
    IF invalid_case='MISSING_ALLOCATION_ID' THEN
      bad_payload := pg_catalog.jsonb_set(bad_payload,
        '{details,allocations,0,allocationId}','null'::jsonb);
    ELSIF invalid_case='DUPLICATE_ALLOCATION_ID' THEN
      bad_payload := pg_catalog.jsonb_set(bad_payload,
        '{details,allocations,1,allocationId}',
        pg_catalog.to_jsonb('ws3-recipient-2'::text));
    ELSIF invalid_case='ALLOCATION_AMOUNT_DRIFT' THEN
      bad_payload := pg_catalog.jsonb_set(bad_payload,
        '{details,allocations,1,amountMinor}','3400'::jsonb);
    ELSIF invalid_case='MISSING_LINE_SERVICE' THEN
      bad_payload := pg_catalog.jsonb_set(bad_payload,
        '{details,allocations,0,serviceCode}','null'::jsonb);
    ELSE
      bad_payload := pg_catalog.jsonb_set(bad_payload,
        '{amountMinor}','4900'::jsonb);
    END IF;
    -- The existing public submit validator may reject first. Preserve it;
    -- assert its denial separately from the new database trigger.
    BEGIN
      PERFORM public.taxpay_demo_story1_submit(payer_hash,bad_payload);
      RAISE EXCEPTION 'INVALID_V3_RPC_ACCEPTED_%',invalid_case;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT IN ('INVALID_COMBINED_PAYMENT','INVALID_V3_ALLOCATION')
      THEN RAISE; END IF;
    END;
    -- Privileged direct write only inside this disposable ROLLBACK fixture:
    -- prove that bypassing the public RPC still cannot insert a malformed v3
    -- parent, and therefore cannot create a source notice or mirror outbox.
    BEGIN
      INSERT INTO demo_payment.story_payments(
        idempotency_key,session_id,service_code,amount_minor,data,status
      ) VALUES(
        v_bad_key,session_id,'OTHER_TAX_PAYMENT',
        (bad_payload->>'amountMinor')::bigint,bad_payload,'SIMULATED_SUCCESS'
      );
      RAISE EXCEPTION 'INVALID_V3_DIRECT_INSERT_ACCEPTED_%',invalid_case;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM IS DISTINCT FROM 'INVALID_V3_ALLOCATION' THEN RAISE; END IF;
    END;
    IF EXISTS(SELECT 1 FROM demo_payment.story_payments
              WHERE idempotency_key=v_bad_key)
       OR (SELECT count(*) FROM demo_payment.story_payments)<>before_payment_count
       OR (SELECT count(*) FROM demo_payment.story_notifications)<>before_story_notices
       OR (SELECT count(*) FROM demo_payment.mirror_outbox)<>before_outbox
    THEN RAISE EXCEPTION 'REJECTED_V3_SOURCE_PERSISTED_%',invalid_case; END IF;
  END LOOP;

  SELECT data INTO before_data FROM demo_payment.story_payments WHERE id=payment_id;
  SELECT count(*) INTO before_payment_count FROM demo_payment.story_payments;
  SELECT count(*) INTO before_story_notices FROM demo_payment.story_notifications;
  SELECT count(*) INTO before_outbox FROM demo_payment.mirror_outbox;

  notice2:=public.taxpay_demo_received_payment_notices(recipient2_hash,'unread');
  notice3:=public.taxpay_demo_received_payment_notices(recipient3_hash,'unread');
  IF jsonb_array_length(notice2->'items')<>1
    OR jsonb_array_length(notice3->'items')<>1
  THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_ISOLATED_COUNTS_FAILED'; END IF;
  event2:=notice2->'items'->0->>'eventId';
  event3:=notice3->'items'->0->>'eventId';
  IF event2=event3
     OR notice2->'items'->0->>'allocationId' IS DISTINCT FROM 'ws3-recipient-2'
     OR notice3->'items'->0->>'allocationId' IS DISTINCT FROM 'ws3-recipient-3'
     OR notice2->'items'->0->>'amountMinor' IS DISTINCT FROM '1500'
     OR notice3->'items'->0->>'amountMinor' IS DISTINCT FROM '3500'
     OR notice2->'items'->0->>'assessmentYear' IS DISTINCT FROM '2026-27'
     OR notice3->'items'->0->>'assessmentYear' IS DISTINCT FROM '2025-26'
     OR notice2->'items'->0->>'recipientTin' IS DISTINCT FROM '222222222222'
     OR notice3->'items'->0->>'recipientTin' IS DISTINCT FROM '333333333333'
     OR notice2->'items'->0->>'payerName' IS DISTINCT FROM 'WS3 disposable payer'
     OR notice2->'items'->0->>'paymentStatus' IS DISTINCT FROM 'SIMULATED_SUCCESS'
     OR notice2->'items'->0->>'serviceCode' IS DISTINCT FROM 'ADVANCE_TAX'
     OR (notice2->'items'->0->>'createdAt')::timestamptz IS DISTINCT FROM (SELECT created_at FROM demo_payment.story_payment_initiations WHERE id=payment_id)
     OR notice2->'items'->0->>'paymentId' IS DISTINCT FROM payment_id::text
     OR notice2->'items'->0->>'receiptReference' IS DISTINCT FROM 'SIM-'||payment_key::text
     OR notice2->'items'->0 ? 'payerTin'
     OR notice2->'items'->0 ? 'allocations'
  THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_DETAIL_PRIVACY_FAILED'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.taxpay_demo_received_payment_notices(recipient2_hash,'ack',event3);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='NOTICE_NOT_FOUND' THEN denied:=true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_CROSS_ACK_ACCEPTED'; END IF;
  ack:=public.taxpay_demo_received_payment_notices(recipient2_hash,'ack',event2);
  IF ack->>'isRead' IS DISTINCT FROM 'true'
    OR ack->>'eventId' IS DISTINCT FROM event2
    OR ack->>'acknowledgedAt' IS NULL
  THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_ACK_FAILED'; END IF;
  IF public.taxpay_demo_received_payment_notices(recipient2_hash,'ack',event2)
       IS DISTINCT FROM ack
    OR (public.taxpay_demo_received_payment_notices(recipient2_hash,'unread')->>'total')::integer<>0
    OR (public.taxpay_demo_received_payment_notices(recipient3_hash,'unread')->>'total')::integer<>1
  THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_REPLAY_OR_UNREAD_RECOVERY_FAILED'; END IF;
  IF (public.taxpay_demo_received_payment_notices(recipient2_hash,'list')
       ->'items'->0->>'isRead') IS DISTINCT FROM 'true'
    OR (public.taxpay_demo_received_payment_notices(recipient3_hash,'list')
       ->'items'->0->>'isRead') IS DISTINCT FROM 'false'
  THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_HISTORY_STATE_FAILED'; END IF;
  IF (SELECT data FROM demo_payment.story_payments WHERE id=payment_id)
       IS DISTINCT FROM before_data
    OR (SELECT count(*) FROM demo_payment.story_payments)<>before_payment_count
    OR (SELECT count(*) FROM demo_payment.story_notifications)<>before_story_notices
    OR (SELECT count(*) FROM demo_payment.mirror_outbox)<>before_outbox
  THEN RAISE EXCEPTION 'RECIPIENT_NOTICE_MUTATED_FINANCIAL_EVENT'; END IF;
  RAISE NOTICE 'PASS: capability recipient allocation isolation, exact AY/head/tin/amount, stable event IDs, read/ack replay, unread resume and original payment immutability';

  -- Direct report from the exact recipient: no payer identity or TIN supplied.
  DECLARE report jsonb; duplicate jsonb; claimed jsonb; report_id uuid; denied_report boolean:=false;
  BEGIN
    report:=public.taxpay_demo_received_payment_report_save(recipient2_hash,event2,gen_random_uuid(),'Unrecognized simulated payment allocation');
    report_id:=(report->>'id')::uuid;
    duplicate:=public.taxpay_demo_received_payment_report_save(recipient2_hash,event2,gen_random_uuid(),'Unrecognized simulated payment allocation');
    IF report->>'caseKind'<>'UNSOLICITED_PAYMENT_REPORT' OR duplicate->>'id'<>report_id::text OR report->>'id'<>early_report->>'id' OR report->>'paymentCompleted'<>'true' OR report->>'officeSyncState'<>'PENDING' THEN RAISE EXCEPTION 'REPORT_IDEMPOTENCY_FAILED'; END IF;
    BEGIN
      PERFORM public.taxpay_demo_received_payment_report_save(recipient3_hash,event2,gen_random_uuid(),'Unauthorized other allocation report');
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM='CORRECTION_PAYMENT_UNAVAILABLE' THEN denied_report:=true; ELSE RAISE; END IF;
    END;
    IF NOT denied_report THEN RAISE EXCEPTION 'REPORT_OUTSIDER_ACCEPTED'; END IF;
    claimed:=public.taxpay_demo_correction_claim(1,report_id);
    IF jsonb_array_length(claimed)<>1 OR claimed#>>'{0,event,payload,caseKind}'<>'UNSOLICITED_PAYMENT_REPORT' OR claimed#>>'{0,event,payload,recipientEventId}'<>event2 OR claimed#>>'{0,event,payload,targetAllocationId}'<>'ws3-recipient-2' OR claimed#>>'{0,event,payload,correctionChanges}' IS NOT NULL
      THEN RAISE EXCEPTION 'REPORT_OFFICE_EVENT_MISMATCH'; END IF;
    IF NOT public.taxpay_demo_correction_ack(report_id,(claimed#>>'{0,claimToken}')::uuid,true)
      THEN RAISE EXCEPTION 'REPORT_ACK_FAILED'; END IF;
    IF public.taxpay_demo_correction_get(report_id)->>'officeSyncState'<>'ACKNOWLEDGED'
      THEN RAISE EXCEPTION 'REPORT_ACK_READBACK_FAILED'; END IF;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_correction_notices(recipient2_hash,100,0)->'items') n WHERE n->>'requestId'=report_id::text AND n->>'code'='REPORT_OFFICE_RECEIVED')
      THEN RAISE EXCEPTION 'REPORT_NOTIFICATION_MISSING'; END IF;
    -- Exercise the same authorized decision RPC used by the existing signed Office dispatcher.
    DECLARE command jsonb; decision jsonb; message uuid:=gen_random_uuid();
    BEGIN
      command:=jsonb_build_object('schemaVersion','1.0.0','origin','OFFICE_SQL','sourceProject','v2','simulationOnly',true,'commandType','CORRECTION_REVIEW','requestId',report_id,'messageId',message,'officerUid','80000000-0000-4000-8000-000000000011','officerRole','MAKER','action','MAKER_ACKNOWLEDGE','expectedReviewState','PENDING_OFFICER','reason','Received the simulated report');
      decision:=public.taxpay_demo_correction_office_decision(command);
      IF decision->>'reviewState' IS DISTINCT FROM 'MAKER_ACKNOWLEDGED' OR public.taxpay_demo_correction_office_decision(command) IS DISTINCT FROM decision
      THEN RAISE EXCEPTION 'REPORT_DECISION_REPLAY_FAILED'; END IF;
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_correction_list(recipient2_hash,100,0)) q WHERE q->>'id'=report_id::text AND q->>'reviewState'='MAKER_ACKNOWLEDGED')
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_correction_notices(recipient2_hash,100,0)->'items') n WHERE n->>'requestId'=report_id::text AND n->>'code'='REPORT_MAKER_ACKNOWLEDGED')
      THEN RAISE EXCEPTION 'REPORT_DECISION_READBACK_FAILED'; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_correction_notices(recipient3_hash,100,0)->'items') n WHERE n->>'requestId'=report_id::text)
      THEN RAISE EXCEPTION 'REPORT_DECISION_OWNER_LEAK'; END IF;
    END;
    IF (SELECT data FROM demo_payment.story_payments WHERE id=payment_id) IS DISTINCT FROM before_data
      THEN RAISE EXCEPTION 'REPORT_CHANGED_PAYMENT'; END IF;
  END;
END;
$demo_recipient_notice$;

-- Exercise the function installed by the normal ordered migration chain.
-- No test-only DDL injection: this verifies clean database reproducibility.
-- Preserve the separate savepoint for synthetic walk-in rows because the
-- paired runner may capture/commit the registered source fixture.
CREATE TEMP TABLE p0_notice_restore_check ON COMMIT DROP AS
SELECT pg_get_functiondef('public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)'::regprocedure) AS definition,
  (SELECT count(*) FROM demo_payment.story_payments) AS payment_count,
  (SELECT count(*) FROM demo_payment.story_notifications) AS notice_count,
  (SELECT count(*) FROM demo_payment.mirror_outbox) AS outbox_count,
  (SELECT count(*) FROM taxpay_guest_private.demo_received_payment_notice_ack) AS ack_count;
SAVEPOINT p0_walkin_candidate;
DO $p0_walkin$
DECLARE
  payer jsonb; recipient2 jsonb; recipient3 jsonb;
  payer_hash text; recipient2_hash text; recipient3_hash text;
  source jsonb; guest jsonb; result jsonb; replay jsonb;
  guest_key uuid:=gen_random_uuid(); guest_session uuid:=gen_random_uuid();
  guest_id uuid; source_id uuid; event2 text; event3 text;
  notice2 jsonb; notice3 jsonb; saved_ack jsonb;
  before_data jsonb; denied boolean:=false;
  guest_v5 jsonb; guest_v5_id uuid; guest_v5_key uuid:=gen_random_uuid();
  self_payload jsonb; self_id uuid; self_key uuid:=gen_random_uuid();
BEGIN
  payer:=public.taxpay_demo_profile_login('user1','user1');
  recipient2:=public.taxpay_demo_profile_login('user2','user2');
  recipient3:=public.taxpay_demo_profile_login('user3','user3');
  payer_hash:=encode(extensions.digest(convert_to(payer->>'capability','UTF8'),'sha256'),'hex');
  recipient2_hash:=encode(extensions.digest(convert_to(recipient2->>'capability','UTF8'),'sha256'),'hex');
  recipient3_hash:=encode(extensions.digest(convert_to(recipient3->>'capability','UTF8'),'sha256'),'hex');
  SELECT id,data INTO STRICT source_id,source FROM demo_payment.story_payments
    WHERE data->'details'->'allocations'->0->>'allocationId'='ws3-recipient-2';
  -- Recheck privileges on the replacement, not only the original function.
  IF has_function_privilege('anon',
       'public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)','EXECUTE')
    OR has_function_privilege('authenticated',
       'public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)','EXECUTE')
    OR NOT has_function_privilege('service_role',
       'public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)','EXECUTE')
  THEN RAISE EXCEPTION 'P0_CANDIDATE_NOTICE_DIRECT_ACCESS'; END IF;
  -- SQL NULL must not pass the action allowlist through three-valued logic.
  BEGIN
    PERFORM public.taxpay_demo_received_payment_notices(recipient2_hash,NULL);
    RAISE EXCEPTION 'P0_NULL_ACTION_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM 'INVALID_NOTICE_REQUEST' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.taxpay_demo_received_payment_notices(recipient2_hash,'invalid-action');
    RAISE EXCEPTION 'P0_INVALID_ACTION_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM 'INVALID_NOTICE_REQUEST' THEN RAISE; END IF;
  END;
  -- Prove registered-source ACK and visibility survive the replacement.
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient2_hash,'list')->'items') n
    WHERE n->>'paymentId'=source_id::text AND n->>'isRead'='true')
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient3_hash,'unread')->'items') n
    WHERE n->>'paymentId'=source_id::text)
  THEN RAISE EXCEPTION 'P0_REGISTERED_NOTICE_REGRESSION'; END IF;
  guest:=jsonb_set(source,'{idempotencyKey}',to_jsonb(guest_key::text));
  guest:=jsonb_set(guest,'{sessionId}',to_jsonb(guest_session::text));
  guest:=guest #- '{details,payerId}';
  guest:=jsonb_set(guest,'{details,payerName}',to_jsonb('User 4'::text));
  guest:=jsonb_set(guest,'{details,payerTin}',to_jsonb('444444444444'::text));
  guest:=jsonb_set(guest,'{details,receiptReference}',to_jsonb('SIM-'||guest_key::text));
  guest:=jsonb_set(guest,'{details,receiptSnapshot,payerName}',to_jsonb('User 4'::text));
  guest:=jsonb_set(guest,'{details,receiptSnapshot,payerTin}',to_jsonb('444444444444'::text));
  guest:=jsonb_set(guest,'{details,receiptSnapshot,challanNo}',to_jsonb('SIM-'||guest_key::text));
  result:=public.demo_story1_initiate(guest);
  guest_id:=(result->>'id')::uuid;
  IF result->>'status'<>'SIMULATED_INITIATED' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient2_hash,'unread')->'items') n WHERE n->>'paymentId'=guest_id::text AND n->>'paymentStatus'='SIMULATED_INITIATED') THEN RAISE EXCEPTION 'WALKIN_INITIATION_NOT_VISIBLE'; END IF;
  result:=public.demo_story1_submit(guest);
  IF result->>'id'<>guest_id::text THEN RAISE EXCEPTION 'WALKIN_INITIATION_ID_DRIFT'; END IF;
  replay:=public.demo_story1_submit(guest);
  IF result->>'status' IS DISTINCT FROM 'SIMULATED_SUCCESS'
    OR replay->>'id' IS DISTINCT FROM guest_id::text
    OR replay->>'replayed' IS DISTINCT FROM 'true'
  THEN RAISE EXCEPTION 'P0_WALKIN_SOURCE_REPLAY_FAILED'; END IF;
  SELECT data INTO STRICT before_data FROM demo_payment.story_payments WHERE id=guest_id;
  SELECT n INTO STRICT notice2 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient2_hash,'unread')->'items') n
    WHERE n->>'paymentId'=guest_id::text;
  SELECT n INTO STRICT notice3 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient3_hash,'unread')->'items') n
    WHERE n->>'paymentId'=guest_id::text;
  event2:=notice2->>'eventId'; event3:=notice3->>'eventId';
  IF event2=event3 OR event2 IS NULL OR event3 IS NULL
    OR notice2->>'allocationId' IS DISTINCT FROM 'ws3-recipient-2'
    OR notice3->>'allocationId' IS DISTINCT FROM 'ws3-recipient-3'
    OR notice2->>'amountMinor' IS DISTINCT FROM '1500'
    OR notice3->>'amountMinor' IS DISTINCT FROM '3500'
    OR notice2->>'assessmentYear' IS DISTINCT FROM '2026-27'
    OR notice3->>'assessmentYear' IS DISTINCT FROM '2025-26'
    OR notice2->>'payerName' IS DISTINCT FROM 'User 4'
    OR notice2->>'paymentStatus' IS DISTINCT FROM 'SIMULATED_SUCCESS'
    OR notice2->>'serviceCode' IS DISTINCT FROM 'ADVANCE_TAX'
    OR (notice2->>'createdAt')::timestamptz IS DISTINCT FROM (SELECT created_at FROM demo_payment.story_payment_initiations WHERE id=guest_id)
    OR notice2->>'receiptReference' IS DISTINCT FROM 'SIM-'||guest_key::text
    OR notice2 ? 'payerTin' OR notice2 ? 'allocations'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(payer_hash,'list')->'items') n
      WHERE n->>'paymentId'=guest_id::text)
  THEN RAISE EXCEPTION 'P0_WALKIN_NOTICE_SCOPE_FAILED'; END IF;
  BEGIN
    PERFORM public.taxpay_demo_received_payment_notices(recipient2_hash,'ack',event3);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='NOTICE_NOT_FOUND' THEN denied:=true; ELSE RAISE; END IF;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'P0_WALKIN_CROSS_ACK_ACCEPTED'; END IF;
  saved_ack:=public.taxpay_demo_received_payment_notices(recipient2_hash,'ack',event2);
  IF saved_ack->>'isRead' IS DISTINCT FROM 'true'
    OR public.taxpay_demo_received_payment_notices(recipient2_hash,'ack',event2) IS DISTINCT FROM saved_ack
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient2_hash,'unread')->'items') n WHERE n->>'eventId'=event2)
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient2_hash,'list')->'items') n WHERE n->>'eventId'=event2 AND n->>'isRead'='true')
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient3_hash,'unread')->'items') n WHERE n->>'eventId'=event3)
    OR (SELECT data FROM demo_payment.story_payments WHERE id=guest_id) IS DISTINCT FROM before_data
    OR (SELECT data FROM demo_payment.story_payments WHERE id=source_id) IS DISTINCT FROM source
  THEN RAISE EXCEPTION 'P0_WALKIN_ACK_OR_SOURCE_IMMUTABILITY_FAILED'; END IF;
  -- A v5 anonymous walk-in uses the same exact allocation integrity rules,
  -- and never gains account identity by leaving the optional payer TIN blank.
  guest_v5:=jsonb_set(guest,'{idempotencyKey}',to_jsonb(guest_v5_key::text));
  guest_v5:=jsonb_set(guest_v5,'{details,allocationContractVersion}','5'::jsonb);
  guest_v5:=jsonb_set(guest_v5,'{details,payerTin}',to_jsonb('GUEST'::text));
  guest_v5:=jsonb_set(guest_v5,'{details,payerName}',to_jsonb('Disposable walk-in payer'::text));
  guest_v5:=jsonb_set(guest_v5,'{details,receiptSnapshot,payerTin}',to_jsonb('GUEST'::text));
  guest_v5:=jsonb_set(guest_v5,'{details,receiptSnapshot,payerName}',to_jsonb('Disposable walk-in payer'::text));
  guest_v5:=jsonb_set(guest_v5,'{details,receiptReference}',to_jsonb('SIM-'||guest_v5_key::text));
  guest_v5:=jsonb_set(guest_v5,'{details,receiptSnapshot,challanNo}',to_jsonb('SIM-'||guest_v5_key::text));
  guest_v5_id:=(public.demo_story1_submit(guest_v5)->>'id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient2_hash,'unread')->'items') n
    WHERE n->>'paymentId'=guest_v5_id::text AND n->>'allocationId'='ws3-recipient-2' AND n->>'amountMinor'='1500')
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient3_hash,'unread')->'items') n
    WHERE n->>'paymentId'=guest_v5_id::text AND n->>'allocationId'='ws3-recipient-3' AND n->>'amountMinor'='3500')
  THEN RAISE EXCEPTION 'P0_WALKIN_V5_GUEST_ALLOCATION_FAILED'; END IF;
  -- Even an exact lookup-matched guest name/TIN is not an authenticated
  -- payer. A guest could otherwise suppress the recipient's warning by
  -- declaring that recipient's identity. Both notices must remain visible.
  self_payload:=jsonb_set(guest,'{idempotencyKey}',to_jsonb(self_key::text));
  self_payload:=jsonb_set(self_payload,'{details,payerTin}',to_jsonb('222222222222'::text));
  self_payload:=jsonb_set(self_payload,'{details,payerName}',to_jsonb('User 2'::text));
  self_payload:=jsonb_set(self_payload,'{details,receiptSnapshot,payerTin}',to_jsonb('222222222222'::text));
  self_payload:=jsonb_set(self_payload,'{details,receiptSnapshot,payerName}',to_jsonb('User 2'::text));
  self_payload:=jsonb_set(self_payload,'{details,receiptReference}',to_jsonb('SIM-'||self_key::text));
  self_payload:=jsonb_set(self_payload,'{details,receiptSnapshot,challanNo}',to_jsonb('SIM-'||self_key::text));
  self_id:=(public.demo_story1_submit(self_payload)->>'id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient2_hash,'list')->'items') n
    WHERE n->>'paymentId'=self_id::text AND n->>'allocationId'='ws3-recipient-2')
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.taxpay_demo_received_payment_notices(recipient3_hash,'unread')->'items') n
    WHERE n->>'paymentId'=self_id::text AND n->>'allocationId'='ws3-recipient-3')
  THEN RAISE EXCEPTION 'P0_WALKIN_DECLARED_IDENTITY_SUPPRESSED_NOTICE'; END IF;
  RAISE NOTICE 'PASS: recorded walk-in v3/v5 allocation isolation, source replay, registered ACK preservation, cross-owner denial, declared identity cannot suppress notice and immutable originals';
END;
$p0_walkin$;
ROLLBACK TO SAVEPOINT p0_walkin_candidate;
RELEASE SAVEPOINT p0_walkin_candidate;
DO $p0_restore$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.p0_notice_restore_check c
    WHERE c.definition = pg_get_functiondef('public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)'::regprocedure)
      AND c.payment_count = (SELECT count(*) FROM demo_payment.story_payments)
      AND c.notice_count = (SELECT count(*) FROM demo_payment.story_notifications)
      AND c.outbox_count = (SELECT count(*) FROM demo_payment.mirror_outbox)
      AND c.ack_count = (SELECT count(*) FROM taxpay_guest_private.demo_received_payment_notice_ack))
  THEN RAISE EXCEPTION 'P0_WALKIN_CANDIDATE_ROLLBACK_FAILED'; END IF;
  RAISE NOTICE 'PASS: candidate definition and synthetic row counts restored before paired capture/commit';
END;
$p0_restore$;
ROLLBACK;
