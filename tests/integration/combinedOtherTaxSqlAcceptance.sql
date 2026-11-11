-- Disposable local Postgres only. Every synthetic row, list and notice rolls back.
BEGIN;
DO $combined$
DECLARE
  owner_login jsonb;
  other_login jsonb;
  owner_hash text;
  other_hash text;
  session_id uuid;
  payment_key uuid := gen_random_uuid();
  list_id uuid;
  lines jsonb;
  ledger_lines jsonb;
  allocations jsonb;
  snapshot jsonb;
  payload jsonb;
  result jsonb;
  replay jsonb;
  saved_id uuid;
  blocked boolean;
  bad_key uuid;
  bad_payload jsonb;
  mixed_key uuid;
  mixed_payload jsonb;
  mixed_saved_id uuid;
BEGIN
  owner_login:=public.taxpay_demo_profile_login('user1','user1');
  other_login:=public.taxpay_demo_profile_login('user2','user2');
  owner_hash:=encode(extensions.digest(convert_to(owner_login->>'capability','UTF8'),'sha256'),'hex');
  other_hash:=encode(extensions.digest(convert_to(other_login->>'capability','UTF8'),'sha256'),'hex');
  session_id:=(owner_login->>'paymentSessionId')::uuid;
  list_id:=(public.taxpay_guest_beneficiary_create_list(owner_hash,'Combined acceptance')->>'id')::uuid;
  IF public.taxpay_guest_beneficiary_add(owner_hash,list_id,
    '[{"tin":"909000000013","display_name":"First recipient"},{"tin":"000000000018","display_name":"Second recipient"}]'::jsonb)<>2
  THEN RAISE EXCEPTION 'COMBINED_TEST_SAVED_LIST_FAILED'; END IF;

  ledger_lines:=jsonb_build_array(
    jsonb_build_object('headId',121,'economicCode','64','headNameEn','Advance Tax',
      'taxAmount',15,'penaltyAmount',0,'surchargeAmount',0,'interestAmount',0,'totalAmount',15),
    jsonb_build_object('headId',145,'economicCode','135','headNameEn','Tax on notice of demand',
      'taxAmount',35,'penaltyAmount',0,'surchargeAmount',0,'interestAmount',0,'totalAmount',35));
  allocations:=jsonb_build_array(
    jsonb_build_object('taxpayerTin','909000000013','taxpayerName','First recipient',
      'headId',121,'assessmentYear','2026-27','amountMinor',1500),
    jsonb_build_object('taxpayerTin','000000000018','taxpayerName','Second recipient',
      'headId',145,'assessmentYear','2025-26','amountMinor',3500));
  -- Office and Taxpayer 360 read accounting heads plus explicit allocations.
  -- Never combine synthetic beneficiary lines and explicit allocations.
  lines:=ledger_lines;
  snapshot:=jsonb_build_object('challanNo','SIM-'||payment_key::text,
    'paymentCategory','OTHER_TAX_PAYMENT','totalAmount',50,'items',ledger_lines,
    'allocationItems',jsonb_build_array(
      jsonb_build_object('taxpayerTin','909000000013','taxpayerName','First recipient',
        'assessmentYear','2026-27','amountMinor',1500,'paymentServiceEn','Advance Tax','economicCode','64'),
      jsonb_build_object('taxpayerTin','000000000018','taxpayerName','Second recipient',
        'assessmentYear','2025-26','amountMinor',3500,'paymentServiceEn','Tax on notice of demand','economicCode','135')),
    'isSimulatedDemo',true);
  payload:=jsonb_build_object('origin','TAXPAY_UI','service','OTHER_TAX_PAYMENT',
    'idempotencyKey',payment_key,'sessionId',session_id,'amountMinor',5000,
    'details',jsonb_build_object('combinedPayment',true,'allocationCount',2,
      'taxpayerCount',2,'payerId','user1','payerMode','OTHER',
      'receiptReference','SIM-'||payment_key::text,'paymentChannel','NOW','paymentMethod','BKASH',
      'payerName','First payer','totalAmount',50,'assessmentYear','2026-27, 2025-26',
      'taxpayerTin','','lines',lines,'receiptLines',ledger_lines,
      'allocations',allocations,'receiptSnapshot',snapshot));
  result:=public.taxpay_demo_story1_submit(owner_hash,payload);
  saved_id:=(result->>'id')::uuid;
  IF result->>'status' IS DISTINCT FROM 'SIMULATED_SUCCESS' OR result->>'replayed'<>'false'
  THEN RAISE EXCEPTION 'COMBINED_TEST_FIRST_SAVE_FAILED'; END IF;
  IF (SELECT count(*) FROM demo_payment.story_payments
       WHERE id=saved_id AND amount_minor=5000 AND data->'details'->>'combinedPayment'='true')<>1
    OR (SELECT count(*) FROM demo_payment.mirror_outbox WHERE entity_type='PAYMENT' AND entity_id=saved_id)<>1
    OR (SELECT count(*) FROM demo_payment.story_notifications WHERE payment_id=saved_id)<>1
  THEN RAISE EXCEPTION 'COMBINED_TEST_NOT_SINGLE_PAYMENT_OR_MIRROR'; END IF;
  replay:=public.taxpay_demo_story1_submit(owner_hash,payload);
  IF replay->>'id'<>saved_id::text OR replay->>'replayed'<>'true'
  THEN RAISE EXCEPTION 'COMBINED_TEST_IDEMPOTENCY_FAILED'; END IF;
  IF (SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key=payment_key)<>1
  THEN RAISE EXCEPTION 'COMBINED_TEST_DUPLICATE_ROW'; END IF;

  -- The same payer and two owned TINs must combine Source Tax and Demand in
  -- one SQL payment without forging an Office beneficiary or a Treasury credit.
  mixed_key:=gen_random_uuid();
  mixed_payload:=jsonb_set(payload,'{idempotencyKey}',to_jsonb(mixed_key::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptReference}',to_jsonb('SIM-'||mixed_key::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,challanNo}',to_jsonb('SIM-'||mixed_key::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,allocations,0,headId}',to_jsonb(8));
  mixed_payload:=jsonb_set(mixed_payload,'{details,lines,0,headId}',to_jsonb(8));
  mixed_payload:=jsonb_set(mixed_payload,'{details,lines,0,economicCode}',to_jsonb('50'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,lines,0,headNameEn}',to_jsonb('Deduction from Salary'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptLines,0,headId}',to_jsonb(8));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptLines,0,economicCode}',to_jsonb('50'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptLines,0,headNameEn}',to_jsonb('Deduction from Salary'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,items,0,headId}',to_jsonb(8));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,items,0,economicCode}',to_jsonb('50'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,items,0,headNameEn}',to_jsonb('Deduction from Salary'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,allocationItems,0,economicCode}',to_jsonb('50'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,allocationItems,0,paymentServiceEn}',to_jsonb('Deduction from Salary'::text));
  result:=public.taxpay_demo_story1_submit(owner_hash,mixed_payload);
  mixed_saved_id:=(result->>'id')::uuid;
  IF result->>'status' IS DISTINCT FROM 'SIMULATED_SUCCESS'
    OR (SELECT count(*) FROM demo_payment.story_payments
      WHERE id=mixed_saved_id AND amount_minor=5000 AND service_code='OTHER_TAX_PAYMENT')<>1
    OR (SELECT count(*) FROM demo_payment.mirror_outbox
      WHERE entity_type='PAYMENT' AND entity_id=mixed_saved_id)<>1
  THEN RAISE EXCEPTION 'COMBINED_SOURCE_AND_DEMAND_NOT_ATOMIC'; END IF;
  -- Return head is now mapped only for the distinct TAX_WITH_RETURN journey.
  -- Its presence in the canonical catalogue must never allow mixed Other Tax.
  IF (SELECT count(*) FROM demo_payment.taxpay_combined_demo_heads
      WHERE head_id=125 AND category='return')<>1
  THEN RAISE EXCEPTION 'RETURN_ONLY_HEAD_NOT_REGISTERED'; END IF;
  blocked:=false;
  BEGIN
    PERFORM demo_payment.assert_new_head_exclusivity(
      jsonb_set(payload,'{details,lines,1,headId}',to_jsonb(125)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%RETURN_HEAD_EXCLUSIVE%' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'RETURN_MIXING_ALLOWED'; END IF;

  blocked:=false;
  bad_key:=gen_random_uuid();
  bad_payload:=jsonb_set(payload,'{idempotencyKey}',to_jsonb(bad_key::text));
  bad_payload:=jsonb_set(bad_payload,'{details,receiptReference}',to_jsonb('SIM-'||bad_key::text));
  bad_payload:=jsonb_set(bad_payload,'{details,receiptSnapshot,challanNo}',to_jsonb('SIM-'||bad_key::text));
  BEGIN
    PERFORM public.taxpay_demo_story1_submit(owner_hash,
      jsonb_set(jsonb_set(bad_payload,
          '{details,allocations,1,taxpayerTin}',to_jsonb('999999999998'::text)),
          '{details,receiptSnapshot,allocationItems,1,taxpayerTin}',to_jsonb('999999999998'::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%INVALID_BENEFICIARY%' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'COMBINED_TEST_MISMATCHED_TIN_ACCEPTED'; END IF;
  blocked:=false;
  bad_key:=gen_random_uuid();
  bad_payload:=jsonb_set(payload,'{idempotencyKey}',to_jsonb(bad_key::text));
  bad_payload:=jsonb_set(bad_payload,'{details,receiptReference}',to_jsonb('SIM-'||bad_key::text));
  bad_payload:=jsonb_set(bad_payload,'{details,receiptSnapshot,challanNo}',to_jsonb('SIM-'||bad_key::text));
  BEGIN
    PERFORM public.taxpay_demo_story1_submit(owner_hash,
      jsonb_set(bad_payload,'{details,allocations,1,headId}',to_jsonb(90)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%INVALID_COMBINED_ALLOCATION%' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'COMBINED_TEST_FORGED_HEAD_ACCEPTED'; END IF;
  blocked:=false;
  BEGIN
    PERFORM public.taxpay_demo_story1_submit(other_hash,
      jsonb_set(payload,'{idempotencyKey}',to_jsonb(gen_random_uuid()::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%PROFILE_PAYMENT_SCOPE_MISMATCH%' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'COMBINED_TEST_CROSS_ACCOUNT_ACCEPTED'; END IF;

  RAISE NOTICE 'PASS: one combined TaxPay SQL row, one Office outbox, one notice, two allocations, exactly-one retry and denied cross-account mutations';
END
$combined$;
ROLLBACK;
