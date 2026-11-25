-- V5 simulated-only: preserve original M04 Return exclusivity. No persistent writes.
BEGIN;
DO $v5$
DECLARE
  v jsonb; invalid jsonb; label text; rejected boolean;
BEGIN
  v := jsonb_build_object('service','OTHER_TAX_PAYMENT','origin','TAXPAY_UI',
    'amountMinor',550000,'details',jsonb_build_object('combinedPayment',true,
    'allocationContractVersion',5,'lines',jsonb_build_array(
      jsonb_build_object('headId',125,'category','TAX_WITH_RETURN','totalAmount',1500),
      jsonb_build_object('headId',121,'totalAmount',4000))));
  PERFORM demo_payment.assert_new_head_exclusivity(v);
  IF position('INVALID_V5_RETURN_ALLOCATION' IN
     pg_get_functiondef('demo_payment.validate_demo_authorized_payment()'::regprocedure)) = 0
  THEN RAISE EXCEPTION 'V5_CANONICAL_HEAD_GUARD_MISSING'; END IF;
  FOR label,invalid IN SELECT * FROM (VALUES
    ('version3',jsonb_set(v,'{details,allocationContractVersion}','3'::jsonb)),
    ('missing_version',jsonb_set(v,'{details}',(v->'details')-'allocationContractVersion')),
    ('missing_combined',jsonb_set(v,'{details}',(v->'details')-'combinedPayment')),
    ('combined_false',jsonb_set(v,'{details,combinedPayment}','false'::jsonb)),
    ('untrusted_origin',jsonb_set(v,'{origin}','"QA_BROWSER"'::jsonb)),
    ('missing_origin',v-'origin'),
    ('legacy_return_service',jsonb_set(v,'{service}','"TAX_WITH_RETURN"'::jsonb))
  ) AS cases(label,body) LOOP
    rejected:=false;
    BEGIN
      PERFORM demo_payment.assert_new_head_exclusivity(invalid);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM IN ('RETURN_HEAD_EXCLUSIVE','RETURN_EXCLUSIVE_SINGLE_HEAD_RECIPIENT')
      THEN rejected:=true; ELSE RAISE; END IF;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'V5_UNAUTHORIZED_RETURN_ACCEPTED_%',label; END IF;
  END LOOP;
  RAISE NOTICE 'PASS: v5 transport is opt-in; M04 exclusive original service, null versions, origin and mixed guards preserved';
END $v5$;
ROLLBACK;
