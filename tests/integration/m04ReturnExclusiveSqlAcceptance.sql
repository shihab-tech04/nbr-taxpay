-- M04 isolated SQL: each invalid RPC payload fails without writing a record.
BEGIN;
DO $m04$
DECLARE
 v jsonb;
 invalid jsonb;
 blocked boolean;
 label text;
BEGIN
 IF position('perform demo_payment.assert_new_head_exclusivity(p_input)' IN lower(
   pg_get_functiondef('public.demo_story1_submit(jsonb)'::regprocedure)))=0
 OR position('perform demo_payment.assert_new_head_exclusivity(p_input)' IN lower(
   pg_get_functiondef('public.taxpay_demo_story1_submit(text,jsonb)'::regprocedure)))=0
 THEN RAISE EXCEPTION 'M04_GUARD_NOT_USED_BY_BOTH_RPCS'; END IF;
 v:=jsonb_build_object('origin','TAXPAY_UI','service','TAX_WITH_RETURN','amountMinor',1975,
  'details',jsonb_build_object('taxpayerTin','111111111111','payerTin','111111111111',
  'payerMode','SELF','assessmentYear','2025-26','receiptReference','SIM-M04',
  'lines',jsonb_build_array(jsonb_build_object('headId',125,'totalAmount',19.75)),
  'receiptSnapshot',jsonb_build_object('taxpayerTin','111111111111',
   'assessmentYear','2025-26','payerTin','111111111111','paymentCategory','TAX_WITH_RETURN',
   'challanNo','SIM-M04','totalAmount',19.75,
   'items',jsonb_build_array(jsonb_build_object('headId',125,'totalAmount',19.75)))));
 PERFORM demo_payment.assert_new_head_exclusivity(v);
 FOR label,invalid IN SELECT * FROM (VALUES
  ('second_line',jsonb_set(v,'{details,lines}',
   '[{"headId":125,"totalAmount":10},{"headId":125,"totalAmount":9.75}]'::jsonb)),
  ('nonreturn_head',jsonb_set(v,'{details,lines}',
   '[{"headId":121,"totalAmount":19.75}]'::jsonb)),
  ('second_recipient',jsonb_set(v,'{details,allocations}',
   '[{"taxpayerTin":"222222222222","headId":125,"assessmentYear":"2025-26","amountMinor":1975}]'::jsonb)),
  ('combined_flag',jsonb_set(v,'{details,combinedPayment}','true'::jsonb)),
  ('invalid_year',jsonb_set(v,'{details,assessmentYear}','"2026-28"'::jsonb)),
  ('multiple_years',jsonb_set(v,'{details,assessmentYear}','"2025-26, 2026-27"'::jsonb)),
  ('wrong_recipient',jsonb_set(v,'{details,receiptSnapshot,taxpayerTin}','"222222222222"'::jsonb)),
  ('wrong_receipt_year',jsonb_set(v,'{details,receiptSnapshot,assessmentYear}','"2026-27"'::jsonb)),
  ('wrong_receipt_total',jsonb_set(v,'{details,receiptSnapshot,totalAmount}','10'::jsonb)),
  ('missing_parent_amount',v - 'amountMinor'),
  ('missing_taxpayer',jsonb_set(v,'{details}',(v->'details') - 'taxpayerTin')),
  ('missing_year',jsonb_set(v,'{details}',(v->'details') - 'assessmentYear')),
  ('missing_payer_mode',jsonb_set(v,'{details}',(v->'details') - 'payerMode')),
  ('missing_head_total',jsonb_set(v,'{details,lines}','[{"headId":125}]'::jsonb)),
  ('missing_receipt_total',jsonb_set(v,'{details,receiptSnapshot}',(v#>'{details,receiptSnapshot}') - 'totalAmount')),
  ('mismatched_receipt_line',jsonb_set(v,'{details,receiptSnapshot,items,0,totalAmount}','20'::jsonb)),
  ('wrong_receipt_payer',jsonb_set(v,'{details,receiptSnapshot,payerTin}','"222222222222"'::jsonb)),
  ('wrong_parent_amount',jsonb_set(v,'{amountMinor}','2000'::jsonb))
 ) AS tests(label_name,payload) LOOP
  blocked:=false;
  BEGIN
   PERFORM demo_payment.assert_new_head_exclusivity(invalid);
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM LIKE 'RETURN_EXCLUSIVE_%' THEN blocked:=true;
   ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'M04_BAD_RETURN_ACCEPTED_%',label; END IF;
 END LOOP;
 blocked:=false;
 BEGIN
  PERFORM demo_payment.assert_new_head_exclusivity(
   jsonb_set(v,'{service}','"OTHER_TAX_PAYMENT"'::jsonb));
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='RETURN_HEAD_EXCLUSIVE' THEN blocked:=true;
  ELSE RAISE; END IF;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'M04_NONRETURN_ACCEPTED_RETURN_HEAD'; END IF;
 RAISE NOTICE 'M04_RETURN_SQL_GUARD_PASS';
END $m04$;
ROLLBACK;
