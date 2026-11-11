-- Allow multiple beneficiaries within Tax with Return, never with another head.
-- Reuse the proven combined schema, ownership and idempotency contract.
-- All existing non-return, single-payer, Travel Tax and historical rows are unchanged.
BEGIN;
INSERT INTO demo_payment.taxpay_combined_demo_heads(head_id,code_en,name_en,category)
VALUES (125,'74','Tax with return','return')
ON CONFLICT(head_id) DO UPDATE SET
 code_en=EXCLUDED.code_en,name_en=EXCLUDED.name_en,category=EXCLUDED.category;

DO $return_combined_trigger$
DECLARE v_sql text;
BEGIN
  v_sql := pg_get_functiondef('demo_payment.validate_demo_authorized_payment()'::regprocedure);
  IF position('IF new.service_code <> ''OTHER_TAX_PAYMENT''' IN v_sql)=0 OR
     position('OR v_snapshot->>''paymentCategory'' <> ''OTHER_TAX_PAYMENT''' IN v_sql)=0 OR
     position('IF NOT FOUND THEN RAISE EXCEPTION ''INVALID_COMBINED_HEAD''; END IF;' IN v_sql)=0
  THEN RAISE EXCEPTION 'RETURN_COMBINED_SQL_BASELINE_MISMATCH'; END IF;
  v_sql := replace(v_sql,
    'IF new.service_code <> ''OTHER_TAX_PAYMENT''',
    'IF new.service_code NOT IN (''OTHER_TAX_PAYMENT'',''TAX_WITH_RETURN'')');
  v_sql := replace(v_sql,
    'OR v_snapshot->>''paymentCategory'' <> ''OTHER_TAX_PAYMENT''',
    'OR v_snapshot->>''paymentCategory'' IS DISTINCT FROM new.service_code');
  v_sql := replace(v_sql,
    'IF NOT FOUND THEN RAISE EXCEPTION ''INVALID_COMBINED_HEAD''; END IF;',
    'IF NOT FOUND THEN RAISE EXCEPTION ''INVALID_COMBINED_HEAD''; END IF;' || E'\n' ||
    '      IF (new.service_code = ''TAX_WITH_RETURN'' AND v_head.head_id <> 125) OR' || E'\n' ||
    '         (new.service_code = ''OTHER_TAX_PAYMENT'' AND v_head.head_id = 125)' || E'\n' ||
    '      THEN RAISE EXCEPTION ''RETURN_HEAD_EXCLUSIVE''; END IF;');
  EXECUTE v_sql;
END $return_combined_trigger$;

DO $return_combined_rpc$
DECLARE v_sql text; v_rpc text;
  v_old text := 'AND p_input->>''service'' = ''OTHER_TAX_PAYMENT'' THEN 750000';
  v_new text := 'AND p_input->>''service'' IN (''OTHER_TAX_PAYMENT'',''TAX_WITH_RETURN'') THEN 750000';
BEGIN
  FOR v_rpc IN SELECT unnest(ARRAY[
    'public.demo_story1_submit(jsonb)',
    'public.taxpay_demo_story1_submit(text,jsonb)'
  ]) LOOP
    v_sql := pg_get_functiondef(v_rpc::regprocedure);
    IF position(v_old IN v_sql)=0 THEN RAISE EXCEPTION 'RETURN_COMBINED_RPC_BASELINE_MISMATCH: %',v_rpc; END IF;
    v_sql := replace(v_sql,v_old,v_new);
    EXECUTE v_sql;
  END LOOP;
END $return_combined_rpc$;

-- Retain the already-installed exclusive Return guard; no additional grants,
-- RLS changes or public write privileges are introduced.
DO $verify_return_guard$
BEGIN
  IF position('RETURN_HEAD_EXCLUSIVE' IN pg_get_functiondef(
    'demo_payment.assert_new_head_exclusivity(jsonb)'::regprocedure))=0
  THEN RAISE EXCEPTION 'RETURN_EXCLUSIVITY_GUARD_MISSING'; END IF;
END $verify_return_guard$;
COMMIT;
