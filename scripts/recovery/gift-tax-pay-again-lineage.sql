-- Gift Tax Pay Again candidate for disposable verification and migration generation.
-- Do not apply to hosted projects until recovery, exact schema and release gates pass.
-- Extend only receipt namespace and repeat token validation; retain every existing
-- payer/session, ownership, service, amount, authorization and immutability guard.
BEGIN;
DO $gift_repeat$
DECLARE
  v_def text;
  v_old text;
  v_new text;
  v_source text := 'demo_payment.check_new_pay_again_source_lineage()';
  v_gift text := 'demo_payment.assert_gift_tax_simulation(jsonb)';
BEGIN
  SELECT pg_catalog.pg_get_functiondef(v_source::regprocedure) INTO STRICT v_def;
  v_old := $a$v_new_ref IS DISTINCT FROM 'SIM-'||NEW.idempotency_key::text$a$;
  v_new := $a$v_new_ref IS DISTINCT FROM (CASE WHEN NEW.service_code='GIFT_TAX' THEN 'SIM-GIFT-' ELSE 'SIM-' END)||NEW.idempotency_key::text$a$;
  IF position(v_new IN v_def)=0 THEN
    IF (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old)<>1 THEN
      RAISE EXCEPTION 'UNEXPECTED_PAY_AGAIN_LINEAGE_DEFINITION';
    END IF;
    EXECUTE replace(v_def,v_old,v_new);
  END IF;
  SELECT pg_catalog.pg_get_functiondef(v_gift::regprocedure) INTO STRICT v_def;
  v_old := $a$OR s->>'tokenNumber' IS DISTINCT FROM 'SIMULATION'$a$;
  v_new := $a$OR s->>'tokenNumber' IS DISTINCT FROM (CASE WHEN d ? 'sourcePaymentId' THEN d->>'receiptReference' ELSE 'SIMULATION' END)$a$;
  IF position(v_new IN v_def)=0 THEN
    IF (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old)<>1 THEN
      RAISE EXCEPTION 'UNEXPECTED_GIFT_TOKEN_DEFINITION';
    END IF;
    v_def:=replace(v_def,v_old,v_new);
  END IF;
  v_old := $a$OR d ? 'allocations' OR d ? 'combinedPayment' OR d ? 'sourcePaymentId'$a$;
  v_new := $a$OR d ? 'allocations' OR d ? 'combinedPayment' OR d ? 'sourceAllocationIds'
 OR (d ? 'sourcePaymentId' AND (
      jsonb_typeof(d->'sourcePaymentId') IS DISTINCT FROM 'string'
      OR coalesce(d->>'sourcePaymentId','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      OR d->>'sourcePaymentId'=p_input->>'idempotencyKey'
      OR d->>'payerId' IS NULL
 ))$a$;
  IF position(v_new IN v_def)=0 THEN
    IF (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old)<>1 THEN
      RAISE EXCEPTION 'UNEXPECTED_GIFT_SOURCE_DEFINITION';
    END IF;
    v_def:=replace(v_def,v_old,v_new);
  END IF;
  EXECUTE v_def;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='demo_payment.story_payments'::regclass
      AND tgname='b_taxpay_pay_again_lineage_before_insert'
      AND tgenabled IN ('O','A')
      AND tgfoid=v_source::regprocedure
      AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'PAY_AGAIN_LINEAGE_GUARD_NOT_ACTIVE'; END IF;
  IF pg_catalog.has_function_privilege('anon',v_source,'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated',v_source,'EXECUTE')
     OR pg_catalog.has_function_privilege('anon',v_gift,'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated',v_gift,'EXECUTE')
  THEN RAISE EXCEPTION 'GIFT_LINEAGE_PRIVILEGE_REGRESSION'; END IF;
END;
$gift_repeat$;
COMMIT;
