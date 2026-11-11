-- Restore the approved exclusive Tax with Return journey after the
-- multi-beneficiary Return-only experiment. This is forward-only: no payment,
-- receipt, owner or outbox rows are changed.
BEGIN;

DO $preserve_existing_return_records$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM demo_payment.story_payments
    WHERE service_code = 'TAX_WITH_RETURN'
      AND data #>> '{details,combinedPayment}' = 'true'
  ) THEN
    RAISE EXCEPTION 'RETURN_COMBINED_RECORDS_EXIST_REQUIRES_REVIEW';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM demo_payment.story_payments
    WHERE jsonb_typeof(data #> '{details,allocations}') = 'array'
      AND data #> '{details,allocations}' @> '[{"headId":125}]'::jsonb
  ) THEN
    RAISE EXCEPTION 'RETURN_HEAD_ALLOCATIONS_EXIST_REQUIRES_REVIEW';
  END IF;
END $preserve_existing_return_records$;

DO $restore_return_exclusive_validator$
DECLARE
  v_sql text;
  v_old_service text := 'IF new.service_code NOT IN (''OTHER_TAX_PAYMENT'',''TAX_WITH_RETURN'')';
  v_new_service text := 'IF new.service_code <> ''OTHER_TAX_PAYMENT''';
  v_old_snapshot text := 'OR v_snapshot->>''paymentCategory'' IS DISTINCT FROM new.service_code';
  v_new_snapshot text := 'OR v_snapshot->>''paymentCategory'' <> ''OTHER_TAX_PAYMENT''';
BEGIN
  v_sql := pg_get_functiondef('demo_payment.validate_demo_authorized_payment()'::regprocedure);
  IF position(v_old_service IN v_sql) = 0 OR position(v_old_snapshot IN v_sql) = 0 THEN
    RAISE EXCEPTION 'RETURN_EXCLUSIVE_VALIDATOR_BASELINE_MISMATCH';
  END IF;
  v_sql := replace(v_sql, v_old_service, v_new_service);
  v_sql := replace(v_sql, v_old_snapshot, v_new_snapshot);
  EXECUTE v_sql;
END $restore_return_exclusive_validator$;

DO $restore_return_payload_limit$
DECLARE
  v_sql text;
  v_rpc text;
  v_old text := 'AND p_input->>''service'' IN (''OTHER_TAX_PAYMENT'',''TAX_WITH_RETURN'') THEN 750000';
  v_new text := 'AND p_input->>''service'' = ''OTHER_TAX_PAYMENT'' THEN 750000';
BEGIN
  FOR v_rpc IN SELECT unnest(ARRAY[
    'public.demo_story1_submit(jsonb)',
    'public.taxpay_demo_story1_submit(text,jsonb)'
  ]) LOOP
    v_sql := pg_get_functiondef(v_rpc::regprocedure);
    IF position(v_old IN v_sql) = 0 THEN
      RAISE EXCEPTION 'RETURN_EXCLUSIVE_RPC_BASELINE_MISMATCH: %', v_rpc;
    END IF;
    v_sql := replace(v_sql, v_old, v_new);
    EXECUTE v_sql;
  END LOOP;
END $restore_return_payload_limit$;

DO $remove_return_from_combined_catalogue$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM demo_payment.taxpay_combined_demo_heads
  WHERE head_id = 125 AND code_en = '74' AND name_en = 'Tax with return' AND category = 'return';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'RETURN_COMBINED_CATALOGUE_BASELINE_MISMATCH';
  END IF;
END $remove_return_from_combined_catalogue$;

COMMIT;
