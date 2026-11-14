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
  payment_id uuid; before_data jsonb;
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
      'totalAmount',50,'assessmentYear','2026-27, 2025-26','taxpayerTin','',
      'lines',lines,'receiptLines',lines,'allocations',allocations,
      'receiptSnapshot',snapshot));
  payment:=public.taxpay_demo_story1_submit(payer_hash,payload);
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
END;
$demo_recipient_notice$;
ROLLBACK;
