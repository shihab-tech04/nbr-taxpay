-- Gift Tax uses the existing synthetic Story 1 parent, notifications and Office outbox.
-- No real payment, official economic code, challan, tax event or credit is created.
BEGIN;
CREATE OR REPLACE FUNCTION demo_payment.assert_gift_tax_simulation(p_input jsonb)
RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $gift$
DECLARE
 d jsonb := p_input->'details';
 g jsonb := d->'giftDetails';
 s jsonb := d->'receiptSnapshot';
 v_donor record; v_donee record;
 v_amount numeric; v_remaining numeric; v_tax numeric:=0; v_part numeric;
 v_date date; v_year integer; v_assessment text;
 v_session uuid; v_payer text;
BEGIN
 IF p_input->>'service' IS DISTINCT FROM 'GIFT_TAX' THEN RETURN; END IF;
 IF p_input->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
 OR d->>'sampleOnly' IS DISTINCT FROM 'true'
 OR jsonb_typeof(g) IS DISTINCT FROM 'object'
 OR jsonb_typeof(s) IS DISTINCT FROM 'object'
 OR coalesce(g#>>'{donor,tin}','') !~ '^[0-9]{12}$'
 OR coalesce(g#>>'{donee,tin}','') !~ '^[0-9]{12}$'
 OR g#>>'{donor,tin}' = g#>>'{donee,tin}'
 OR coalesce(g->>'giftAmountMinor','') !~ '^[1-9][0-9]{0,15}$'
 OR coalesce(g->>'estimatedTaxMinor','') !~ '^[1-9][0-9]{0,11}$'
 OR coalesce(p_input->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$'
 OR coalesce(g->>'giftDate','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
 OR jsonb_typeof(g->'description') IS DISTINCT FROM 'string'
 OR jsonb_typeof(g->'remarks') IS DISTINCT FROM 'string'
 OR coalesce(d->>'payerMode','') NOT IN ('SELF','OTHER')
 THEN RAISE EXCEPTION 'INVALID_GIFT_DETAILS'; END IF;
 -- Use the existing 12-digit lookup aliases common to both hosted databases.
 -- The later 13-digit confirmed-payer helper is not installed on original Taxpayer.
 -- These are display-only synthetic identities; existing capability guards still authorize the payment.
 SELECT 'user'||n.i::text AS profile_id,
   (CASE WHEN n.i<=10 THEN 'User ' ELSE 'Taxpayer Account ' END)||n.i::text AS name_en,
   (CASE WHEN n.i<=10 THEN 'ইউজার ' ELSE 'করদাতা অ্যাকাউন্ট ' END)||n.i::text AS name_bn
 INTO v_donor FROM pg_catalog.generate_series(1,30) AS n(i)
 WHERE taxpay_guest_private.walkin_sample_tin('user'||n.i::text)=g#>>'{donor,tin}';
 SELECT 'user'||n.i::text AS profile_id,
   (CASE WHEN n.i<=10 THEN 'User ' ELSE 'Taxpayer Account ' END)||n.i::text AS name_en,
   (CASE WHEN n.i<=10 THEN 'ইউজার ' ELSE 'করদাতা অ্যাকাউন্ট ' END)||n.i::text AS name_bn
 INTO v_donee FROM pg_catalog.generate_series(1,30) AS n(i)
 WHERE taxpay_guest_private.walkin_sample_tin('user'||n.i::text)=g#>>'{donee,tin}';
 IF v_donor.profile_id IS NULL OR v_donee.profile_id IS NULL
 OR coalesce(g#>>'{donor,name}','') NOT IN (v_donor.name_en,v_donor.name_bn)
 OR coalesce(g#>>'{donee,name}','') NOT IN (v_donee.name_en,v_donee.name_bn)
 THEN RAISE EXCEPTION 'INVALID_GIFT_PARTIES'; END IF;
 IF coalesce(g#>>'{donee,tag}','') NOT IN ('clients','friends_family','others')
 OR (g#>>'{donee,tag}'='friends_family' AND coalesce(g#>>'{donee,relationship}','') NOT IN ('father','mother','siblings','son','daughter','spouse','friends'))
 OR (g#>>'{donee,tag}'<>'friends_family' AND coalesce(g#>>'{donee,relationship}','')<>'')
 OR (g#>>'{donee,tag}'='others' AND length(btrim(coalesce(g#>>'{donee,otherLabel}',''))) NOT BETWEEN 1 AND 80)
 OR (g#>>'{donee,tag}'<>'others' AND coalesce(g#>>'{donee,otherLabel}','')<>'')
 THEN RAISE EXCEPTION 'INVALID_GIFT_RELATIONSHIP'; END IF;
 v_amount := (g->>'giftAmountMinor')::numeric;
 IF v_amount>9007199254740991 THEN RAISE EXCEPTION 'INVALID_GIFT_AMOUNT'; END IF;
 -- Replicate the approved simulation estimate in integer minor units.
 v_remaining:=greatest(0,v_amount-2000000);
 v_part:=least(v_remaining,50000000); v_tax:=v_tax+round(v_part*5/100); v_remaining:=v_remaining-v_part;
 v_part:=least(v_remaining,100000000); v_tax:=v_tax+round(v_part*10/100); v_remaining:=v_remaining-v_part;
 v_part:=least(v_remaining,200000000); v_tax:=v_tax+round(v_part*15/100); v_remaining:=v_remaining-v_part;
 v_tax:=v_tax+round(v_remaining*20/100);
 IF v_tax<=0 OR v_tax IS DISTINCT FROM (g->>'estimatedTaxMinor')::numeric
 OR v_tax IS DISTINCT FROM (p_input->>'amountMinor')::numeric
 THEN RAISE EXCEPTION 'GIFT_TOTAL_MISMATCH'; END IF;
 v_date:=(g->>'giftDate')::date;
 IF v_date>(now() AT TIME ZONE 'Asia/Dhaka')::date THEN RAISE EXCEPTION 'INVALID_GIFT_DATE'; END IF;
 v_year:=extract(year from v_date)::integer+CASE WHEN extract(month from v_date)>=7 THEN 1 ELSE 0 END;
 v_assessment:=v_year::text||'-'||right((v_year+1)::text,2);
 IF d->>'assessmentYear' IS DISTINCT FROM v_assessment
 OR d->>'taxpayerTin' IS DISTINCT FROM g#>>'{donor,tin}'
 OR d->>'taxpayerName' IS DISTINCT FROM g#>>'{donor,name}'
 OR d->>'challanRemarks' IS DISTINCT FROM g->>'remarks'
 OR d->>'receiptReference' IS DISTINCT FROM 'SIM-GIFT-'||(p_input->>'idempotencyKey')
 OR coalesce(d->>'paymentMethod','') NOT IN ('BKASH','NAGAD','ROCKET','SONALI_E_SHEBA','A_CHALLAN_CARD','BEFTN_RTGS','INTERNET_BANKING','VISA','MASTERCARD','BANK_BRANCH','SIMULATED')
 OR s->>'paymentCategory' IS DISTINCT FROM 'GIFT_TAX'
 OR s->>'taxpayerTin' IS DISTINCT FROM d->>'taxpayerTin'
 OR s->>'taxpayerName' IS DISTINCT FROM d->>'taxpayerName'
 OR s->>'assessmentYear' IS DISTINCT FROM v_assessment
 OR s->>'challanNo' IS DISTINCT FROM d->>'receiptReference'
 OR s->>'paymentRemarks' IS DISTINCT FROM d->>'challanRemarks'
 OR s->>'paymentMethod' IS DISTINCT FROM d->>'paymentMethod'
 OR s->>'payerTin' IS DISTINCT FROM d->>'payerTin'
 OR s->>'payerName' IS DISTINCT FROM d->>'payerName'
 OR s->>'receiptMobile' IS DISTINCT FROM d->>'receiptMobile'
 OR s->>'receiptEmail' IS DISTINCT FROM d->>'receiptEmail'
 OR s->>'noticeReference' IS DISTINCT FROM d->>'noticeReference'
 OR s->>'id' IS DISTINCT FROM d->>'receiptReference'
 OR s->>'gatewayTransactionId' IS DISTINCT FROM d->>'receiptReference'
 OR s->>'tokenNumber' IS DISTINCT FROM 'SIMULATION'
 OR s->>'isWithholding' IS DISTINCT FROM 'false'
 OR s ? 'treasuryScrollNo' OR s ? 'treasuryDate' OR s ? 'paymentTransactionId'
 OR d ? 'allocations' OR d ? 'combinedPayment' OR d ? 'sourcePaymentId'
 OR s->'giftDetails' IS DISTINCT FROM g
 OR s->>'isSimulatedDemo' IS DISTINCT FROM 'true'
 OR s->>'taxCreditStatus' IS DISTINCT FROM 'NOT_APPLICABLE'
 OR s->>'treasuryStatus' IS DISTINCT FROM 'INITIATED'
 OR coalesce(s->>'totalAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
 OR (s->>'totalAmount')::numeric*100 IS DISTINCT FROM v_tax
 OR jsonb_typeof(s->'items') IS DISTINCT FROM 'array'
 OR jsonb_array_length(s->'items')<>1
 OR s#>>'{items,0,headId}' IS DISTINCT FROM '0'
 OR s#>>'{items,0,economicCode}' IS DISTINCT FROM 'SIM-GIFT'
 OR s#>>'{items,0,headNameEn}' IS DISTINCT FROM 'Gift Tax'
 OR coalesce(s#>>'{items,0,totalAmount}','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
 OR (s#>>'{items,0,totalAmount}')::numeric*100 IS DISTINCT FROM v_tax
 OR s#>'{items,0,taxAmount}' IS DISTINCT FROM s#>'{items,0,totalAmount}'
 OR s#>'{items,0,penaltyAmount}' IS DISTINCT FROM '0'::jsonb
 OR s#>'{items,0,surchargeAmount}' IS DISTINCT FROM '0'::jsonb
 OR s#>'{items,0,interestAmount}' IS DISTINCT FROM '0'::jsonb
 THEN RAISE EXCEPTION 'GIFT_RECEIPT_MISMATCH'; END IF;
 -- Require the existing capability-owned demo session and donor authorization.
 -- Existing BEFORE INSERT authorization guard still enforces saved-recipient
 -- access for OTHER; this function never grants authorization or reads private donor data.
 v_session:=(p_input->>'sessionId')::uuid;
 v_payer:=d->>'payerId';
 IF v_payer IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM taxpay_guest_private.demo_profiles p
      WHERE p.demo_id=v_payer AND p.payment_session_id=v_session)
   OR (d->>'payerMode'='SELF' AND v_payer IS DISTINCT FROM v_donor.profile_id)
   OR (d->>'payerMode'='OTHER' AND v_payer IS NOT DISTINCT FROM v_donor.profile_id)
   THEN RAISE EXCEPTION 'GIFT_PAYER_SCOPE_MISMATCH'; END IF;
   IF d->>'payerTin' IS DISTINCT FROM taxpay_guest_private.walkin_sample_tin(v_payer)
   OR d->'receiptLines' IS DISTINCT FROM s->'items'
   OR jsonb_typeof(d->'lines') IS DISTINCT FROM 'array'
   OR jsonb_array_length(d->'lines')<>1
   OR d#>>'{lines,0,category}' IS DISTINCT FROM 'GIFT_TAX'
   OR d#>>'{lines,0,assessmentYear}' IS DISTINCT FROM v_assessment
   OR d#>>'{lines,0,amountMinor}' IS DISTINCT FROM p_input->>'amountMinor'
   OR d#>>'{lines,0,beneficiary}' IS DISTINCT FROM (CASE WHEN d->>'payerMode'='SELF' THEN v_payer ELSE 'SAVED_TIN:'||(g#>>'{donor,tin}') END)
   THEN RAISE EXCEPTION 'GIFT_ALLOCATION_MISMATCH'; END IF;
 ELSE
   IF d->'lines' IS DISTINCT FROM s->'items' OR d ? 'receiptLines' THEN
     RAISE EXCEPTION 'GIFT_ALLOCATION_MISMATCH';
   END IF;
 END IF;
END;
$gift$;
REVOKE ALL ON FUNCTION demo_payment.assert_gift_tax_simulation(jsonb) FROM PUBLIC,anon,authenticated;
-- Patch only the two existing synthetic submission allowlists; refuse unexpected definitions.
-- Do not rewrite, weaken, or remove any capability, ownership or existing head checks.
DO $patch$
DECLARE
 signature text; definition text; patched text;
 old_allow text := '''APPELLATE_TRIBUNAL'',''OTHER_TAX_PAYMENT'',''TRAVEL_TAX'')';
 new_allow text := '''APPELLATE_TRIBUNAL'',''OTHER_TAX_PAYMENT'',''TRAVEL_TAX'',''GIFT_TAX'')';
 guard text := 'perform demo_payment.assert_new_head_exclusivity(p_input);';
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.demo_story1_submit(jsonb)','public.taxpay_demo_story1_submit(text,jsonb)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO definition;
  IF position('''GIFT_TAX''' in definition)>0 THEN
    IF position('assert_gift_tax_simulation(p_input)' in definition)=0 THEN
      RAISE EXCEPTION 'GIFT_ALLOWLIST_WITHOUT_VALIDATION: %',signature;
    END IF;
    CONTINUE;
  END IF;
  IF position(old_allow in definition)=0 OR position(guard in definition)=0 THEN
    RAISE EXCEPTION 'UNEXPECTED_STORY1_CONTRACT: %',signature;
  END IF;
  patched:=replace(replace(definition,old_allow,new_allow),guard,
    guard||E'\n  perform demo_payment.assert_gift_tax_simulation(p_input);');
  EXECUTE patched;
 END LOOP;
END;
$patch$;
COMMIT;
