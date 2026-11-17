-- F-178 / US-181 source contract: real PG17 insert, raw JSON readback and
-- negative malformed remarks. All contents are disposable, within ROLLBACK.
BEGIN;
DO $f178$
DECLARE v_note text :=
 'বাংলা বহু লাইনের মন্তব্য, ২০ অক্ষরের বেশি। English explanation over 20 chars.' ||
 chr(10) || 'Literal <script>alert("not code")</script> & punctuation; stay plain text.';
 v_data jsonb;
 v_original jsonb;
 v_denied boolean := false;
BEGIN
 INSERT INTO demo_payment.story_payments
  (id,idempotency_key,session_id,service_code,amount_minor,data)
 VALUES(
 '92000000-0000-4000-8000-000000000001',
 '92000000-0000-4000-8000-000000000011',
 '92000000-0000-4000-8000-000000000099',
 'OTHER_TAX_PAYMENT',1250,
 jsonb_build_object('origin','TAXPAY_UI','details',jsonb_build_object(
   'challanRemarks',v_note,'taxpayerTin','111111111111',
   'amountMinor',1250,'headId',125,'assessmentYear','2026-27'))
 );
 SELECT data INTO v_data FROM demo_payment.story_payments
 WHERE id='92000000-0000-4000-8000-000000000001';
 IF char_length(v_note)<=20 OR v_data#>>'{details,challanRemarks}' IS DISTINCT FROM v_note
 OR v_data#>>'{details,taxpayerTin}' IS DISTINCT FROM '111111111111'
 OR v_data#>>'{details,amountMinor}' IS DISTINCT FROM '1250'
 OR v_data#>>'{details,headId}' IS DISTINCT FROM '125'
 OR position(chr(10) IN v_data#>>'{details,challanRemarks}')=0
 THEN RAISE EXCEPTION 'F178_T01_UNICODE_ROUNDTRIP_OR_STRUCTURED_INTEGRITY_FAILED'; END IF;
 v_original:=v_data;
 -- Optional no-comment / explicit null and blank are accepted without
 -- changing the parent envelope or imposing a 20-char upper bound.
 INSERT INTO demo_payment.story_payments
  (id,idempotency_key,session_id,service_code,amount_minor,data) VALUES
 ('92000000-0000-4000-8000-000000000002',
  '92000000-0000-4000-8000-000000000012',
  '92000000-0000-4000-8000-000000000099','OTHER_TAX_PAYMENT',1250,
  '{"details":{"taxpayerTin":"111111111111"}}'::jsonb),
 ('92000000-0000-4000-8000-000000000003',
  '92000000-0000-4000-8000-000000000013',
  '92000000-0000-4000-8000-000000000099','OTHER_TAX_PAYMENT',1250,
  '{"details":{"challanRemarks":null}}'::jsonb),
 ('92000000-0000-4000-8000-000000000004',
  '92000000-0000-4000-8000-000000000014',
  '92000000-0000-4000-8000-000000000099','OTHER_TAX_PAYMENT',1250,
  '{"details":{"challanRemarks":""}}'::jsonb);
 IF (SELECT count(*) FROM demo_payment.story_payments
     WHERE id IN ('92000000-0000-4000-8000-000000000001',
       '92000000-0000-4000-8000-000000000002',
       '92000000-0000-4000-8000-000000000003',
       '92000000-0000-4000-8000-000000000004'))<>4
 THEN RAISE EXCEPTION 'F178_T01_OPTIONAL_CASES_FAILED'; END IF;
 -- Exactly 4,000 supplementary-plane Unicode code points (16,000 bytes)
 -- must round-trip; 4,001 must be rejected, never silently truncated.
 INSERT INTO demo_payment.story_payments
  (id,idempotency_key,session_id,service_code,amount_minor,data)
 VALUES ('92000000-0000-4000-8000-000000000005',
  '92000000-0000-4000-8000-000000000015',
  '92000000-0000-4000-8000-000000000099','OTHER_TAX_PAYMENT',1250,
  jsonb_build_object('details',jsonb_build_object('challanRemarks',repeat('😀',4000))));
 IF (SELECT data#>>'{details,challanRemarks}' FROM demo_payment.story_payments
      WHERE id='92000000-0000-4000-8000-000000000005') IS DISTINCT FROM repeat('😀',4000)
 THEN RAISE EXCEPTION 'F178_T03_BOUNDARY_ROUNDTRIP_FAILED'; END IF;
 v_denied:=false;
 BEGIN
  INSERT INTO demo_payment.story_payments
   (id,idempotency_key,session_id,service_code,amount_minor,data)
  VALUES ('92000000-0000-4000-8000-000000000006',
   '92000000-0000-4000-8000-000000000016',
   '92000000-0000-4000-8000-000000000099','OTHER_TAX_PAYMENT',1250,
   jsonb_build_object('details',jsonb_build_object('challanRemarks',repeat('😀',4001))));
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='CHALLAN_REMARKS_TOO_LONG' THEN v_denied:=true;
  ELSE RAISE; END IF;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'F178_T03_OVERSIZED_REMARKS_ACCEPTED'; END IF;
 -- Reject forged non-text remarks; do not let JSON arrays/objects/numbers
 -- become unreviewed state changes in the payment envelope.
 FOR v_data IN
   SELECT x FROM jsonb_array_elements('[
     {"details":{"challanRemarks":{"payerTin":"forged"}}},
     {"details":{"challanRemarks":["fake","payment"]}},
     {"details":{"challanRemarks":12345}},
     {"details":{"challanRemarks":true}}
   ]'::jsonb) AS t(x)
 LOOP
  v_denied:=false;
  BEGIN
   INSERT INTO demo_payment.story_payments
    (id,idempotency_key,session_id,service_code,amount_minor,data)
   VALUES(gen_random_uuid(),gen_random_uuid(),
    '92000000-0000-4000-8000-000000000099','OTHER_TAX_PAYMENT',1250,v_data);
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='CHALLAN_REMARKS_MUST_BE_TEXT' THEN v_denied:=true;
   ELSE RAISE; END IF;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'F178_T02_INVALID_COMMENT_ACCEPTED'; END IF;
 END LOOP;
 SELECT data INTO v_data FROM demo_payment.story_payments
 WHERE id='92000000-0000-4000-8000-000000000001';
 IF v_data IS DISTINCT FROM v_original
 THEN RAISE EXCEPTION 'F178_T02_FORGED_COMMENT_MUTATED_PAID_ORIGINAL'; END IF;
 IF has_function_privilege('anon',
   'demo_payment.validate_challan_remarks_v1()','EXECUTE') OR
   has_function_privilege('authenticated',
   'demo_payment.validate_challan_remarks_v1()','EXECUTE')
 THEN RAISE EXCEPTION 'F178_T02_TRIGGER_FUNCTION_PUBLIC_EXECUTION'; END IF;
 RAISE NOTICE 'F178_T01_T02_DISPOSABLE_POSTGRES_ACCEPTANCE_PASS';
END $f178$;
ROLLBACK;
