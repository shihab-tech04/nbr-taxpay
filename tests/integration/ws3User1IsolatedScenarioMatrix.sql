-- WS3 Stage 5: isolated, reversible User1 scenario matrix.
-- NO real Supabase Auth user, government challan, Treasury status, or live data.
-- Run against disposable local Supabase only. All inserts roll back.
BEGIN;
DO $ws3_user1_scenarios$
DECLARE
  v_login jsonb; v_cap text; v_sid uuid;
  v_list_client uuid; v_list_family uuid; v_list_other uuid;
  v_auth_before bigint;
  v_key uuid; v_id uuid; v_first uuid; v_first_data jsonb;
  v_payload jsonb; v_saved jsonb; v_result jsonb; v_replay jsonb;
  v_allocs jsonb; v_items jsonb; v_receipt_allocs jsonb;
  v_total bigint; v_lines integer; v_head integer;
  v_amount bigint; v_tin text; v_name text; v_year text;
  v_alloc_id text; v_head_name text; v_code text;
  v_remarks text; v_case integer; v_line integer; v_idx integer;
  v_orig_count integer; v_count integer;
BEGIN
  SELECT count(*) INTO v_auth_before FROM auth.users;
  v_login:=public.taxpay_demo_profile_login('user1','user1');
  v_cap:=encode(extensions.digest(convert_to(v_login->>'capability','UTF8'),'sha256'),'hex');
  v_sid:=(v_login->>'paymentSessionId')::uuid;
  v_list_client:=(public.taxpay_guest_beneficiary_create_list(v_cap,'WS3 User1 Clients')->>'id')::uuid;
  v_list_family:=(public.taxpay_guest_beneficiary_create_list(v_cap,'WS3 User1 Family')->>'id')::uuid;
  v_list_other:=(public.taxpay_guest_beneficiary_create_list(v_cap,'WS3 User1 Others')->>'id')::uuid;
  FOR v_idx IN 2..11 LOOP
    v_tin:=CASE WHEN v_idx BETWEEN 2 AND 9 THEN repeat(v_idx::text,12)
      WHEN v_idx=10 THEN repeat('0',12) ELSE '909000000011' END;
    v_name:='User '||v_idx;
    IF public.taxpay_guest_beneficiary_add(v_cap,
       CASE WHEN v_idx<=5 THEN v_list_client WHEN v_idx<=8 THEN v_list_family
            ELSE v_list_other END,
       jsonb_build_array(jsonb_build_object(
          'tin',v_tin,'display_name',v_name,'tag',
          CASE WHEN v_idx<=5 THEN 'clients' WHEN v_idx<=8 THEN 'friends_family'
               ELSE 'others' END,
          'relationship',CASE WHEN v_idx<=5 OR v_idx>8 THEN NULL
             WHEN v_idx=6 THEN 'father' WHEN v_idx=7 THEN 'spouse'
             ELSE 'friends' END,
          'other_label',CASE WHEN v_idx>8 THEN 'User1 contact '||v_idx ELSE NULL END))
    )<>1 THEN RAISE EXCEPTION 'WS3_USER1_BENEFICIARY_ADD_FAILED_%',v_idx; END IF;
  END LOOP;
  SELECT count(*) INTO v_count FROM taxpay_guest_private.beneficiaries b
  WHERE b.list_id IN (v_list_client,v_list_family,v_list_other);
  IF v_count<>10 THEN RAISE EXCEPTION 'WS3_USER1_TEN_BENEFICIARIES_REQUIRED'; END IF;
  IF (SELECT count(*) FROM taxpay_guest_private.beneficiaries b
      WHERE b.list_id IN(v_list_client,v_list_family,v_list_other)
        AND b.tag='friends_family' AND b.relationship IS NOT NULL)<>3
  THEN RAISE EXCEPTION 'WS3_USER1_TAGS_NOT_SAVED'; END IF;

  CREATE TEMP TABLE ws3_user1_created (
    case_no integer PRIMARY KEY,payment_id uuid UNIQUE,receipt text,
    allocation_count integer,amount_minor bigint,original_payment_id uuid,
    service text NOT NULL
  ) ON COMMIT DROP;

  -- 16 mixed-beneficiary v3 payments, including different head/year patterns
  -- and both two- and three-allocation combined receipts.
  FOR v_case IN 1..16 LOOP
    v_key:=gen_random_uuid();
    v_allocs:='[]'::jsonb;v_items:='[]'::jsonb;
    v_receipt_allocs:='[]'::jsonb;v_total:=0;
    v_lines:=CASE WHEN v_case%3=0 THEN 3 ELSE 2 END;
    FOR v_line IN 1..v_lines LOOP
      v_idx:=2+((v_case+v_line-2)%10);
      v_tin:=CASE WHEN v_idx BETWEEN 2 AND 9 THEN repeat(v_idx::text,12)
        WHEN v_idx=10 THEN repeat('0',12) ELSE '909000000011' END;
      v_name:='User '||v_idx;
      v_head:=CASE WHEN v_line%2=1 THEN 121 ELSE 145 END;
      v_head_name:=CASE WHEN v_head=121 THEN 'Advance Tax'
        ELSE 'Tax on notice of demand' END;
      v_code:=CASE WHEN v_head=121 THEN '64' ELSE '135' END;
      v_amount:=CASE WHEN v_head=121 THEN 1500 ELSE 3500 END;
      v_year:=CASE (v_case+v_line)%3 WHEN 0 THEN '2024-25'
        WHEN 1 THEN '2025-26' ELSE '2026-27' END;
      v_alloc_id:='ws3-user1-'||v_case||'-line-'||v_line;
      v_allocs:=v_allocs||jsonb_build_array(jsonb_build_object(
        'allocationId',v_alloc_id,'taxpayerTin',v_tin,'taxpayerName',v_name,
        'headId',v_head,'assessmentYear',v_year,'amountMinor',v_amount,
        'serviceCode',CASE WHEN v_head=121 THEN 'ADVANCE_TAX' ELSE 'ASSESSED_DEMAND' END,
        'isWithholding',false));
      v_items:=v_items||jsonb_build_array(jsonb_build_object(
        'headId',v_head,'economicCode',v_code,'headNameEn',v_head_name,
        'totalAmount',round(v_amount::numeric/100,2),'taxAmount',round(v_amount::numeric/100,2),
        'penaltyAmount',0,'surchargeAmount',0,'interestAmount',0));
      v_receipt_allocs:=v_receipt_allocs||jsonb_build_array(jsonb_build_object(
        'allocationId',v_alloc_id,'taxpayerTin',v_tin,
        'assessmentYear',v_year,'amountMinor',v_amount,
        'paymentServiceEn',v_head_name,'economicCode',v_code));
      v_total:=v_total+v_amount;
    END LOOP;
    v_remarks:=CASE WHEN v_case%2=0
      THEN E'বাংলায় User1 মন্তব্য: একাধিক কর খাত\nEnglish line with detailed context.'
      ELSE E'User1 grouped payment for multiple assessment years.\nAdditional explanation.' END;
    v_payload:=jsonb_build_object(
      'origin','TAXPAY_UI','idempotencyKey',v_key,'sessionId',v_sid,
      'service','OTHER_TAX_PAYMENT','amountMinor',v_total,
      'details',jsonb_build_object(
        'payerId','user1','payerName','WS3 User1 isolated payer',
        'payerMode','OTHER','payerTin','111111111111',
        'combinedPayment',true,'allocationContractVersion',3,
        'allocationCount',v_lines,'taxpayerCount',
          (SELECT count(DISTINCT a.value->>'taxpayerTin')
           FROM jsonb_array_elements(v_allocs) a(value)),
        'receiptReference','SIM-'||v_key::text,'challanRemarks',v_remarks,
        'totalAmount',round(v_total::numeric/100,2),'assessmentYear','Multiple years',
        'taxpayerTin','','lines',v_items,'receiptLines',v_items,
        'allocations',v_allocs,
        'receiptSnapshot',jsonb_build_object(
          'challanNo','SIM-'||v_key::text,'paymentCategory','OTHER_TAX_PAYMENT',
          'totalAmount',round(v_total::numeric/100,2),'items',v_items,
          'allocationItems',v_receipt_allocs,'isSimulatedDemo',true)));
    v_result:=public.taxpay_demo_story1_submit(v_cap,v_payload);
    v_id:=(v_result->>'id')::uuid;
    IF v_result->>'replayed' IS DISTINCT FROM 'false'
      OR v_result->>'status' IS DISTINCT FROM 'SIMULATED_SUCCESS'
    THEN RAISE EXCEPTION 'WS3_USER1_SOURCE_PAYMENT_FAILED_%',v_case; END IF;
    IF v_case=1 THEN
      v_first:=v_id;
      SELECT data INTO v_first_data FROM demo_payment.story_payments WHERE id=v_id;
    END IF;
    INSERT INTO ws3_user1_created VALUES
      (v_case,v_id,'SIM-'||v_key::text,v_lines,v_total,NULL,'OTHER_TAX_PAYMENT');
    v_replay:=public.taxpay_demo_story1_submit(v_cap,v_payload);
    IF v_replay->>'id' IS DISTINCT FROM v_id::text
      OR v_replay->>'replayed' IS DISTINCT FROM 'true'
    THEN RAISE EXCEPTION 'WS3_USER1_IDEMPOTENCY_FAILED_%',v_case; END IF;
  END LOOP;

  -- Two independent single-head return payments. Never combine with other
  -- heads or AYs; keep separate original parent receipts and events.
  FOR v_case IN 17..18 LOOP
    v_key:=gen_random_uuid();
    -- M04 requires one Return taxpayer/AY/head per transaction. Each
    -- distinct row below gets a complete immutable one-head receipt.
    v_payload:=jsonb_build_object(
      'origin','TAXPAY_UI','service','TAX_WITH_RETURN',
      'idempotencyKey',v_key,'sessionId',v_sid,'amountMinor',1000*v_case,
      'details',jsonb_build_object(
        'payerId','user1','payerTin','111111111111',
        'taxpayerTin','111111111111','payerMode','SELF',
        'assessmentYear',CASE WHEN v_case=17 THEN '2025-26' ELSE '2026-27' END,
        'payerName','WS3 User1 isolated payer',
        'challanRemarks',E'রিটার্ন করের জন্য মন্তব্য\nAdditional text',
        'receiptReference','SIM-'||v_key::text,
        'receiptSnapshot',jsonb_build_object(
          'challanNo','SIM-'||v_key::text,
          'paymentCategory','TAX_WITH_RETURN','payerTin','111111111111',
          'taxpayerTin','111111111111',
          'assessmentYear',CASE WHEN v_case=17 THEN '2025-26' ELSE '2026-27' END,
          'totalAmount',v_case*10,
          'items',jsonb_build_array(jsonb_build_object('headId',125,'totalAmount',v_case*10))),
        'lines',jsonb_build_array(jsonb_build_object(
           'beneficiary','user1','category','TAX_WITH_RETURN','headId',125,
           'assessmentYear',CASE WHEN v_case=17 THEN '2025-26' ELSE '2026-27' END,
           'amountMinor',1000*v_case,'totalAmount',v_case*10))));
    v_result:=public.taxpay_demo_story1_submit(v_cap,v_payload);
    v_id:=(v_result->>'id')::uuid;
    IF v_result->>'replayed' IS DISTINCT FROM 'false'
    THEN RAISE EXCEPTION 'WS3_USER1_SINGLE_RETURN_FAILED_%',v_case; END IF;
    INSERT INTO ws3_user1_created VALUES
      (v_case,v_id,'SIM-'||v_key::text,1,1000*v_case,NULL,'TAX_WITH_RETURN');
  END LOOP;

  -- One edited Pay Again: same payer, immutable source, fresh receipt,
  -- idempotency and every allocation identity. No reuse of originals.
  v_key:=gen_random_uuid();
  v_payload:=jsonb_set(v_first_data,'{idempotencyKey}',to_jsonb(v_key::text));
  v_payload:=jsonb_set(v_payload,'{details,sourcePaymentId}',to_jsonb(v_first::text),true);
  v_payload:=jsonb_set(v_payload,'{details,receiptReference}',to_jsonb('SIM-'||v_key::text));
  v_payload:=jsonb_set(v_payload,'{details,receiptSnapshot,challanNo}',
    to_jsonb('SIM-'||v_key::text));
  v_payload:=jsonb_set(v_payload,'{details,challanRemarks}',
    to_jsonb(E'Pay Again: পুনরায় পরিশোধ\nUpdated independent remarks'::text));
  FOR v_line IN 0..jsonb_array_length(v_payload#>'{details,allocations}')-1 LOOP
    v_alloc_id:='ws3-user1-repeat-line-'||(v_line+1);
    v_payload:=jsonb_set(v_payload,
      ARRAY['details','allocations',v_line::text,'allocationId'],to_jsonb(v_alloc_id));
    v_payload:=jsonb_set(v_payload,
      ARRAY['details','receiptSnapshot','allocationItems',v_line::text,'allocationId'],
      to_jsonb(v_alloc_id));
  END LOOP;
  v_result:=public.taxpay_demo_story1_submit(v_cap,v_payload);
  v_id:=(v_result->>'id')::uuid;
  IF v_id=v_first OR v_result->>'replayed' IS DISTINCT FROM 'false'
  THEN RAISE EXCEPTION 'WS3_USER1_PAY_AGAIN_NEW_PARENT_REQUIRED'; END IF;
  INSERT INTO ws3_user1_created VALUES
    (19,v_id,'SIM-'||v_key::text,2,
      (v_payload->>'amountMinor')::bigint,v_first,'OTHER_TAX_PAYMENT');
  IF (SELECT data FROM demo_payment.story_payments p WHERE p.id=v_first)
     IS DISTINCT FROM v_first_data
  THEN RAISE EXCEPTION 'WS3_USER1_SOURCE_PAYMENT_WAS_MUTATED'; END IF;

  -- A separate User1 Travel Tax story uses the existing capability-bound source path,
  -- never the combined OTHER_TAX_PAYMENT allocations.
  v_key:=gen_random_uuid();
  v_result:=public.taxpay_demo_story1_submit(v_cap,jsonb_build_object(
    'idempotencyKey',v_key,'sessionId',v_sid,'service','TRAVEL_TAX',
    'amountMinor',1200,'origin','TAXPAY_UI',
    'details',jsonb_build_object(
       'payerId','user1','payerName','WS3 User1 travel scenario',
       'travelRoute','WS3 isolated travel route','challanRemarks','',
       'lines',jsonb_build_array(jsonb_build_object(
          'beneficiary','user1','category','TRAVEL_TAX','amountMinor',1200)),
       'receiptReference','SIM-'||v_key::text)));
  v_id:=(v_result->>'id')::uuid;
  INSERT INTO ws3_user1_created VALUES
    (20,v_id,'SIM-'||v_key::text,0,1200,NULL,'TRAVEL_TAX');

  IF (SELECT count(*) FROM ws3_user1_created)<>20
    OR (SELECT count(*) FROM ws3_user1_created WHERE service='OTHER_TAX_PAYMENT')<>17
    OR (SELECT count(*) FROM ws3_user1_created WHERE service='TAX_WITH_RETURN')<>2
    OR (SELECT count(*) FROM ws3_user1_created WHERE service='TRAVEL_TAX')<>1
    OR (SELECT count(*) FROM ws3_user1_created e JOIN demo_payment.story_payments p
       ON p.id=e.payment_id WHERE p.amount_minor=e.amount_minor
          AND p.data#>>'{details,receiptReference}'=e.receipt)<>20
    OR (SELECT count(*) FROM ws3_user1_created e JOIN demo_payment.mirror_outbox o
       ON o.entity_id=e.payment_id AND o.entity_type='PAYMENT')<>20
    OR (SELECT count(*) FROM ws3_user1_created e JOIN demo_payment.story_notifications n
       ON n.payment_id=e.payment_id)<>20
    OR (SELECT count(DISTINCT receipt) FROM ws3_user1_created)<>20
    OR (SELECT count(*) FROM auth.users)<>v_auth_before
  THEN RAISE EXCEPTION 'WS3_USER1_TWENTY_SCENARIO_PARITY_FAILED'; END IF;
  IF EXISTS(SELECT 1 FROM ws3_user1_created e JOIN demo_payment.story_payments p
    ON p.id=e.payment_id WHERE p.data->'details' ? 'sourcePaymentId'
    AND e.original_payment_id IS DISTINCT FROM
      (p.data#>>'{details,sourcePaymentId}')::uuid)
  THEN RAISE EXCEPTION 'WS3_USER1_REPEAT_PARENT_LINK_INVALID'; END IF;
  RAISE NOTICE 'PASS WS3 User1: twenty reversible source payment scenarios, ten tagged beneficiary records, allocation/receipt/notices/outbox, separate Travel Tax, distinct Pay Again parent, no Auth/treasury mutation';
END;
$ws3_user1_scenarios$;
ROLLBACK;
