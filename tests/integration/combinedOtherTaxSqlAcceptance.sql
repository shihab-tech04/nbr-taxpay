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
      'serviceCode','ADVANCE_TAX','isWithholding',false,
      'taxAmount',15,'penaltyAmount',0,'surchargeAmount',0,'interestAmount',0,'totalAmount',15),
    jsonb_build_object('headId',145,'economicCode','135','headNameEn','Tax on notice of demand',
      'serviceCode','ASSESSED_DEMAND','isWithholding',false,
      'taxAmount',35,'penaltyAmount',0,'surchargeAmount',0,'interestAmount',0,'totalAmount',35));
  allocations:=jsonb_build_array(
    jsonb_build_object('allocationId','ws3-v3-one','taxpayerTin','909000000013','taxpayerName','First recipient',
      'headId',121,'assessmentYear','2026-27','amountMinor',1500,
      'serviceCode','ADVANCE_TAX','isWithholding',false),
    jsonb_build_object('allocationId','ws3-v3-two','taxpayerTin','000000000018','taxpayerName','Second recipient',
      'headId',145,'assessmentYear','2025-26','amountMinor',3500,
      'serviceCode','ASSESSED_DEMAND','isWithholding',false));
  -- Office and Taxpayer 360 read accounting heads plus explicit allocations.
  -- Never combine synthetic beneficiary lines and explicit allocations.
  lines:=ledger_lines;
  snapshot:=jsonb_build_object('challanNo','SIM-'||payment_key::text,
    'paymentCategory','OTHER_TAX_PAYMENT','totalAmount',50,'payerName','First recipient',
    'payerTin','909000000013','taxpayerTin','','items',ledger_lines,
    'allocationItems',jsonb_build_array(
      jsonb_build_object('allocationId','ws3-v3-one','taxpayerTin','909000000013','taxpayerName','First recipient',
        'assessmentYear','2026-27','amountMinor',1500,'paymentServiceEn','Advance Tax',
        'paymentServiceBn','Advance Tax','economicCode','64'),
      jsonb_build_object('allocationId','ws3-v3-two','taxpayerTin','000000000018','taxpayerName','Second recipient',
        'assessmentYear','2025-26','amountMinor',3500,'paymentServiceEn','Tax on notice of demand',
        'paymentServiceBn','Tax on notice of demand','economicCode','135')),
    'isSimulatedDemo',true);
  payload:=jsonb_build_object('origin','TAXPAY_UI','service','OTHER_TAX_PAYMENT',
    'idempotencyKey',payment_key,'sessionId',session_id,'amountMinor',5000,
    'details',jsonb_build_object('combinedPayment',true,'allocationContractVersion',3,'allocationCount',2,
      'taxpayerCount',2,'payerId','user1','payerMode','OTHER',
      'receiptReference','SIM-'||payment_key::text,'paymentChannel','NOW','paymentMethod','BKASH',
      'payerName','First recipient','payerTin','909000000013','totalAmount',50,'assessmentYear','2026-27, 2025-26',
      'taxpayerTin','','lines',lines,'receiptLines',ledger_lines,
      'allocations',allocations,'receiptSnapshot',snapshot));
  result:=public.taxpay_demo_story1_submit(owner_hash,payload);
  saved_id:=(result->>'id')::uuid;
  IF result->>'status' IS DISTINCT FROM 'SIMULATED_SUCCESS' OR result->>'replayed'<>'false'
  THEN RAISE EXCEPTION 'COMBINED_TEST_FIRST_SAVE_FAILED'; END IF;
  IF (SELECT count(*) FROM demo_payment.story_payments
       WHERE id=saved_id AND amount_minor=5000 AND data->'details'->>'combinedPayment'='true'
         AND data->'details'->>'allocationContractVersion'='3'
         AND data->'details'->>'payerTin'='909000000013'
         AND data->'details'->>'payerName'='First recipient'
         AND data->'details'->'receiptSnapshot'->>'payerTin'='909000000013'
         AND data->'details'->'receiptSnapshot'->>'payerName'='First recipient')<>1
    OR (SELECT jsonb_agg(a.value->>'allocationId' ORDER BY a.ordinality)
        FROM demo_payment.story_payments p
        CROSS JOIN LATERAL jsonb_array_elements(p.data->'details'->'allocations')
          WITH ORDINALITY AS a(value,ordinality) WHERE p.id=saved_id)
       IS DISTINCT FROM '["ws3-v3-one","ws3-v3-two"]'::jsonb
    OR (SELECT jsonb_agg(a.value->>'allocationId' ORDER BY a.ordinality)
        FROM demo_payment.story_payments p
        CROSS JOIN LATERAL jsonb_array_elements(p.data->'details'->'receiptSnapshot'->'allocationItems')
          WITH ORDINALITY AS a(value,ordinality) WHERE p.id=saved_id)
       IS DISTINCT FROM '["ws3-v3-one","ws3-v3-two"]'::jsonb
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
  -- Pay Again is a new independent payment, retaining the original ID only
  -- as immutable provenance. The UI journey supplies this same JSON field.
  mixed_payload:=jsonb_set(mixed_payload,'{details,sourcePaymentId}',to_jsonb(saved_id::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptReference}',to_jsonb('SIM-'||mixed_key::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,challanNo}',to_jsonb('SIM-'||mixed_key::text));
  -- Pay Again has an independent allocation identity namespace. Reuse the
  -- head/year/recipient facts as editable inputs, never the paid allocation IDs.
  mixed_payload:=jsonb_set(mixed_payload,'{details,allocations,0,allocationId}',to_jsonb('ws3-v3-repeat-one'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,allocations,1,allocationId}',to_jsonb('ws3-v3-repeat-two'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,allocationItems,0,allocationId}',to_jsonb('ws3-v3-repeat-one'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,allocationItems,1,allocationId}',to_jsonb('ws3-v3-repeat-two'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,allocations,0,headId}',to_jsonb(8));
  mixed_payload:=jsonb_set(mixed_payload,'{details,allocations,0,serviceCode}',to_jsonb('SOURCE_TAX_DEPOSIT'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,allocations,0,isWithholding}',to_jsonb(true));
  mixed_payload:=jsonb_set(mixed_payload,'{details,lines,0,headId}',to_jsonb(8));
  mixed_payload:=jsonb_set(mixed_payload,'{details,lines,0,serviceCode}',to_jsonb('SOURCE_TAX_DEPOSIT'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,lines,0,isWithholding}',to_jsonb(true));
  mixed_payload:=jsonb_set(mixed_payload,'{details,lines,0,economicCode}',to_jsonb('50'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,lines,0,headNameEn}',to_jsonb('Deduction from Salary'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptLines,0,headId}',to_jsonb(8));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptLines,0,serviceCode}',to_jsonb('SOURCE_TAX_DEPOSIT'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptLines,0,isWithholding}',to_jsonb(true));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptLines,0,economicCode}',to_jsonb('50'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptLines,0,headNameEn}',to_jsonb('Deduction from Salary'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,items,0,headId}',to_jsonb(8));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,items,0,serviceCode}',to_jsonb('SOURCE_TAX_DEPOSIT'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,items,0,isWithholding}',to_jsonb(true));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,items,0,economicCode}',to_jsonb('50'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,items,0,headNameEn}',to_jsonb('Deduction from Salary'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,allocationItems,0,economicCode}',to_jsonb('50'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,allocationItems,0,paymentServiceBn}',to_jsonb('Deduction from Salary'::text));
  mixed_payload:=jsonb_set(mixed_payload,'{details,receiptSnapshot,allocationItems,0,paymentServiceEn}',to_jsonb('Deduction from Salary'::text));
  result:=public.taxpay_demo_story1_submit(owner_hash,mixed_payload);
  mixed_saved_id:=(result->>'id')::uuid;
  IF result->>'status' IS DISTINCT FROM 'SIMULATED_SUCCESS'
    OR (SELECT count(*) FROM demo_payment.story_payments
      WHERE id=mixed_saved_id AND amount_minor=5000 AND service_code='OTHER_TAX_PAYMENT')<>1
    OR (SELECT count(*) FROM demo_payment.mirror_outbox
      WHERE entity_type='PAYMENT' AND entity_id=mixed_saved_id)<>1
  THEN RAISE EXCEPTION 'COMBINED_SOURCE_AND_DEMAND_NOT_ATOMIC'; END IF;
  -- Read the new source ID back from disposable Taxpayer SQL, not merely
  -- an intercepted browser request. The original parent remains untouched.
  IF mixed_saved_id=saved_id
    OR (SELECT count(*) FROM demo_payment.story_payments
        WHERE id=mixed_saved_id AND idempotency_key=mixed_key
          AND data->'details'->>'sourcePaymentId'=saved_id::text
          AND data->'details'->>'allocationContractVersion'='3')<>1
    OR (SELECT data FROM demo_payment.story_payments WHERE id=saved_id) IS DISTINCT FROM payload
    OR (SELECT jsonb_agg(a.value->>'allocationId' ORDER BY a.ordinality)
        FROM demo_payment.story_payments p
        CROSS JOIN LATERAL jsonb_array_elements(p.data->'details'->'allocations')
          WITH ORDINALITY AS a(value,ordinality) WHERE p.id=mixed_saved_id)
       IS DISTINCT FROM '["ws3-v3-repeat-one","ws3-v3-repeat-two"]'::jsonb
    OR (SELECT jsonb_agg(a.value->>'allocationId' ORDER BY a.ordinality)
        FROM demo_payment.story_payments p
        CROSS JOIN LATERAL jsonb_array_elements(p.data->'details'->'receiptSnapshot'->'allocationItems')
          WITH ORDINALITY AS a(value,ordinality) WHERE p.id=mixed_saved_id)
       IS DISTINCT FROM '["ws3-v3-repeat-one","ws3-v3-repeat-two"]'::jsonb
    OR (SELECT count(*) FROM demo_payment.story_payments
        WHERE id=saved_id AND idempotency_key=payment_key AND amount_minor=5000
          AND COALESCE(data->'details'->>'sourcePaymentId','')='')<>1
  THEN RAISE EXCEPTION 'PAY_AGAIN_SOURCE_ID_ORIGINAL_INTEGRITY_FAILED'; END IF;
  replay:=public.taxpay_demo_story1_submit(owner_hash,mixed_payload);
  IF replay->>'id' IS DISTINCT FROM mixed_saved_id::text OR replay->>'replayed' IS DISTINCT FROM 'true'
    OR (SELECT count(*) FROM demo_payment.mirror_outbox
        WHERE entity_type='PAYMENT' AND entity_id IN (saved_id,mixed_saved_id))<>2
  THEN RAISE EXCEPTION 'PAY_AGAIN_SOURCE_ID_REPLAY_FAILED'; END IF;
  IF (SELECT count(*) FROM demo_payment.taxpay_combined_demo_heads
      WHERE head_id=125)<>0
  THEN RAISE EXCEPTION 'RETURN_MIXING_ALLOWED'; END IF;

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
-- F-039 / US-014 T04 original Taxpayer SQL: exactly one existing saved
-- beneficiary plus a *confirmed but unsaved* one-time fictional lookup.
-- All source rows and the address book are rolled back with this transaction.
DO $f039$
DECLARE
  login jsonb;
  owner_hash text;
  session_id uuid;
  f039_list_id uuid;
  original_list jsonb;
  payment_key uuid:=gen_random_uuid();
  saved_payment_id uuid;
  saved_receipt text;
  lines jsonb;
  allocations jsonb;
  snapshot jsonb;
  payload jsonb;
  answer jsonb;
  invalid_payload jsonb;
  invalid_key uuid;
  duplicate_line jsonb;
  duplicate_allocation jsonb;
  duplicate_view jsonb;
  blocked boolean;
BEGIN
  login:=public.taxpay_demo_profile_login('user1','user1');
  owner_hash:=encode(extensions.digest(convert_to(login->>'capability','UTF8'),'sha256'),'hex');
  session_id:=(login->>'paymentSessionId')::uuid;
  f039_list_id:=(public.taxpay_guest_beneficiary_create_list(owner_hash,'F039 saved + one-time')->>'id')::uuid;
  IF public.taxpay_guest_beneficiary_add(owner_hash,f039_list_id,
       '[{"tin":"222222222222","display_name":"Saved Taxpayer Two"}]'::jsonb)<>1
  THEN RAISE EXCEPTION 'F039_SAVED_FIXTURE_INSERT_FAILED'; END IF;
  SELECT jsonb_agg(to_jsonb(person) ORDER BY person.tin) INTO original_list
  FROM taxpay_guest_private.beneficiaries person WHERE person.list_id=f039_list_id;
  IF jsonb_array_length(original_list)<>1
     OR original_list->0->>'tin' IS DISTINCT FROM '222222222222'
  THEN RAISE EXCEPTION 'F039_NOT_EXACTLY_ONE_SAVED_RECIPIENT'; END IF;

  lines:=jsonb_build_array(
    jsonb_build_object('headId',122,'economicCode','68A',
      'headNameEn','Advance tax on cigarrete manufacturer','serviceCode','ADVANCE_TAX',
      'isWithholding',false,'taxAmount',10,'penaltyAmount',0,
      'surchargeAmount',0,'interestAmount',0,'totalAmount',10),
    jsonb_build_object('headId',123,'economicCode','68B',
      'headNameEn','Advance tax for the owners of private motor car','serviceCode','ADVANCE_TAX',
      'isWithholding',false,'taxAmount',20,'penaltyAmount',0,
      'surchargeAmount',0,'interestAmount',0,'totalAmount',20));
  allocations:=jsonb_build_array(
    jsonb_build_object('allocationId','ws3-f039-saved','taxpayerTin','222222222222',
      'taxpayerName','Saved Taxpayer Two','headId',122,'assessmentYear','2026-27',
      'amountMinor',1000,'serviceCode','ADVANCE_TAX','isWithholding',false),
    jsonb_build_object('allocationId','ws3-f039-onetime','taxpayerTin','444444444444',
      'taxpayerName','User 4','headId',123,'assessmentYear','2025-26',
      'amountMinor',2000,'serviceCode','ADVANCE_TAX','isWithholding',false));
  saved_receipt:='SIM-'||payment_key::text;
  snapshot:=jsonb_build_object('challanNo',saved_receipt,
    'paymentCategory','OTHER_TAX_PAYMENT','totalAmount',30,
    'payerName','Md. Arif Rahman','payerTin','1111111111111','taxpayerTin','',
    'items',lines,'allocationItems',jsonb_build_array(
      jsonb_build_object('allocationId','ws3-f039-saved','taxpayerTin','222222222222',
        'taxpayerName','Saved Taxpayer Two','assessmentYear','2026-27','amountMinor',1000,
        'paymentServiceEn','Advance Tax','paymentServiceBn','অগ্রিম কর','economicCode','68A'),
      jsonb_build_object('allocationId','ws3-f039-onetime','taxpayerTin','444444444444',
        'taxpayerName','User 4','assessmentYear','2025-26','amountMinor',2000,
        'paymentServiceEn','Advance Tax','paymentServiceBn','অগ্রিম কর','economicCode','68B')),
    'isSimulatedDemo',true);
  payload:=jsonb_build_object('origin','TAXPAY_UI','service','OTHER_TAX_PAYMENT',
    'idempotencyKey',payment_key,'sessionId',session_id,'amountMinor',3000,
    'details',jsonb_build_object('payerId','user1','payerMode','OTHER',
      'payerName','Md. Arif Rahman','payerTin','1111111111111','taxpayerTin','',
      'combinedPayment',true,'allocationContractVersion',3,'allocationCount',2,
      'taxpayerCount',2,'assessmentYear','2026-27, 2025-26','totalAmount',30,
      'receiptReference',saved_receipt,'paymentChannel','NOW','paymentMethod','BKASH',
      'lines',lines,'receiptLines',lines,'allocations',allocations,'receiptSnapshot',snapshot));

  answer:=public.taxpay_demo_story1_submit(owner_hash,payload);
  saved_payment_id:=(answer->>'id')::uuid;
  IF answer->>'status' IS DISTINCT FROM 'SIMULATED_SUCCESS'
     OR answer->>'replayed' IS DISTINCT FROM 'false'
     OR (SELECT count(*) FROM demo_payment.story_payments payment
         WHERE payment.id=saved_payment_id AND payment.amount_minor=3000
           AND payment.idempotency_key=payment_key AND payment.data=payload)<>1
     OR (SELECT count(*) FROM demo_payment.mirror_outbox
         WHERE entity_type='PAYMENT' AND entity_id=saved_payment_id)<>1
     OR (SELECT jsonb_agg(item.value->>'allocationId' ORDER BY item.ordinality)
         FROM demo_payment.story_payments payment
         CROSS JOIN LATERAL jsonb_array_elements(payment.data->'details'->'receiptSnapshot'->'allocationItems')
           WITH ORDINALITY item(value,ordinality)
         WHERE payment.id=saved_payment_id)
        IS DISTINCT FROM '["ws3-f039-saved","ws3-f039-onetime"]'::jsonb
  THEN RAISE EXCEPTION 'F039_IMMUTABLE_PARENT_OR_RECEIPT_MISMATCH'; END IF;
  IF (SELECT jsonb_agg(to_jsonb(person) ORDER BY person.tin)
       FROM taxpay_guest_private.beneficiaries person WHERE person.list_id=f039_list_id)
      IS DISTINCT FROM original_list
  THEN RAISE EXCEPTION 'F039_ONE_TIME_AUTO_SAVED'; END IF;
  answer:=public.taxpay_demo_story1_submit(owner_hash,payload);
  IF answer->>'id' IS DISTINCT FROM saved_payment_id::text
     OR answer->>'replayed' IS DISTINCT FROM 'true'
     OR (SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key=payment_key)<>1
  THEN RAISE EXCEPTION 'F039_DUPLICATED_OR_MUTATED_ON_REPLAY'; END IF;

  -- T02: a forged, unsaved TIN/name must never enter an immutable parent.
  invalid_key:=gen_random_uuid();
  invalid_payload:=jsonb_set(payload,'{idempotencyKey}',to_jsonb(invalid_key::text));
  invalid_payload:=jsonb_set(invalid_payload,'{details,receiptReference}',to_jsonb('SIM-'||invalid_key::text));
  invalid_payload:=jsonb_set(invalid_payload,'{details,receiptSnapshot,challanNo}',to_jsonb('SIM-'||invalid_key::text));
  invalid_payload:=jsonb_set(invalid_payload,'{details,allocations,1,taxpayerTin}',to_jsonb('999999999998'::text));
  invalid_payload:=jsonb_set(invalid_payload,'{details,receiptSnapshot,allocationItems,1,taxpayerTin}',to_jsonb('999999999998'::text));
  blocked:=false;
  BEGIN
    PERFORM public.taxpay_demo_story1_submit(owner_hash,invalid_payload);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%INVALID_BENEFICIARY%' THEN blocked:=true; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'F039_UNKNOWN_ONE_TIME_TIN_ACCEPTED'; END IF;

  -- T02: reject a duplicate recipient/head/AY even if the amounts differ.
  invalid_key:=gen_random_uuid();
  invalid_payload:=jsonb_set(payload,'{idempotencyKey}',to_jsonb(invalid_key::text));
  invalid_payload:=jsonb_set(invalid_payload,'{details,receiptReference}',to_jsonb('SIM-'||invalid_key::text));
  invalid_payload:=jsonb_set(invalid_payload,'{details,receiptSnapshot,challanNo}',to_jsonb('SIM-'||invalid_key::text));
  duplicate_line:=jsonb_set(
    jsonb_set(lines->0,'{taxAmount}',to_jsonb(20)),
    '{totalAmount}',to_jsonb(20));
  duplicate_allocation:=jsonb_set(allocations->0,'{amountMinor}',to_jsonb(2000));
  duplicate_view:=jsonb_set(snapshot->'allocationItems'->0,'{amountMinor}',to_jsonb(2000));
  invalid_payload:=jsonb_set(invalid_payload,'{details,lines,1}',duplicate_line);
  invalid_payload:=jsonb_set(invalid_payload,'{details,receiptLines,1}',duplicate_line);
  invalid_payload:=jsonb_set(invalid_payload,'{details,receiptSnapshot,items,1}',duplicate_line);
  invalid_payload:=jsonb_set(invalid_payload,'{details,allocations,1}',duplicate_allocation);
  invalid_payload:=jsonb_set(invalid_payload,'{details,receiptSnapshot,allocationItems,1}',duplicate_view);
  blocked:=false;
  BEGIN
    PERFORM public.taxpay_demo_story1_submit(owner_hash,invalid_payload);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%DUPLICATE_COMBINED_ALLOCATION%' THEN blocked:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'F039_DUPLICATE_ALLOCATION_ACCEPTED'; END IF;
  IF (SELECT jsonb_agg(to_jsonb(person) ORDER BY person.tin)
       FROM taxpay_guest_private.beneficiaries person WHERE person.list_id=f039_list_id)
      IS DISTINCT FROM original_list
     OR (SELECT data FROM demo_payment.story_payments WHERE id=saved_payment_id)
      IS DISTINCT FROM payload
  THEN RAISE EXCEPTION 'F039_FAILED_RETRY_MUTATED_SOURCE_OR_SAVED_LIST'; END IF;

  RAISE NOTICE 'PASS F039: one saved + one confirmed unsaved TIN, one immutable v3 parent and receipt, no beneficiary mutations, blocked unknown TIN and duplicate allocation';
END
$f039$;

ROLLBACK;
