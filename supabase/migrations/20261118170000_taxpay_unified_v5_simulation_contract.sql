-- Unified All Tax Payments v5 simulated-only mixed Return allocations.
-- Forward-only: preserve every historical row, existing Return-only service,
-- legacy v3 OTHER_TAX_PAYMENT, protected account/RLS and Office mirror.
-- Requires independently verified DB/Auth/Storage recovery and WS3 security review
-- before installing on either hosted Taxpayer project.
BEGIN;

DO $v5_return_guard$
DECLARE
  v_sql text;
  v_old text := $source$ELSIF jsonb_typeof(v_lines) = 'array' AND EXISTS ($source$;
  v_new text := $source$ELSIF NOT (
    v_service = 'OTHER_TAX_PAYMENT'
    AND coalesce(v_details->>'combinedPayment','') = 'true'
    AND coalesce(v_details->>'allocationContractVersion','') = '5'
    AND coalesce(p_input->>'origin','') = 'TAXPAY_UI'
  ) AND jsonb_typeof(v_lines) = 'array' AND EXISTS ($source$;
BEGIN
  v_sql := pg_catalog.pg_get_functiondef('demo_payment.assert_new_head_exclusivity(jsonb)'::pg_catalog.regprocedure);
  IF position(v_old IN v_sql) = 0
     OR position('RETURN_HEAD_EXCLUSIVE' IN v_sql) = 0
  THEN RAISE EXCEPTION 'V5_RETURN_GUARD_BASELINE_MISMATCH'; END IF;
  EXECUTE pg_catalog.replace(v_sql, v_old, v_new);
END $v5_return_guard$;

DO $v5_source_validator$
DECLARE
  v_sql text;
  v_old_lookup text := $source$SELECT h.head_id,h.code_en,h.name_en,h.category INTO v_head
      FROM demo_payment.taxpay_combined_demo_heads h
      WHERE h.head_id=(v_allocation->>'headId')::integer;
      IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_COMBINED_HEAD'; END IF;$source$;
  v_new_lookup text := $source$IF new.service_code = 'OTHER_TAX_PAYMENT'
         AND new.data->>'origin' = 'TAXPAY_UI'
         AND new.data#>>'{details,allocationContractVersion}' = '5'
         AND (v_allocation->>'headId') = '125'
      THEN
        -- Canonical frozen fictional source head; do not insert Return into
        -- the original combined-payment catalogue or claim Treasury authority.
        SELECT 125::integer AS head_id, '74'::text AS code_en,
          'Tax with return'::text AS name_en, 'return'::text AS category INTO v_head;
        IF v_allocation->>'serviceCode' IS DISTINCT FROM 'TAX_WITH_RETURN'
           OR v_line->>'serviceCode' IS DISTINCT FROM 'TAX_WITH_RETURN'
           OR v_allocation->>'isWithholding' IS DISTINCT FROM 'false'
           OR v_line->>'isWithholding' IS DISTINCT FROM 'false'
        THEN RAISE EXCEPTION 'INVALID_V5_RETURN_ALLOCATION'; END IF;
      ELSE
        SELECT h.head_id,h.code_en,h.name_en,h.category INTO v_head
        FROM demo_payment.taxpay_combined_demo_heads h
        WHERE h.head_id=(v_allocation->>'headId')::integer;
      END IF;
      IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_COMBINED_HEAD'; END IF;$source$;
  v_old_exclusive text := $source$(new.service_code = 'OTHER_TAX_PAYMENT' AND v_head.head_id = 125)$source$;
  v_new_exclusive text := $source$(new.service_code = 'OTHER_TAX_PAYMENT' AND v_head.head_id = 125
            AND NOT (coalesce(new.data->>'origin','') = 'TAXPAY_UI'
                     AND coalesce(new.data#>>'{details,allocationContractVersion}','') = '5'
                     AND coalesce(new.data#>>'{details,combinedPayment}','') = 'true'))$source$;
  v_old_one_time text := $source$new.data->'details'->>'allocationContractVersion' IS DISTINCT FROM '3'$source$;
  v_new_one_time text := $source$coalesce(new.data->'details'->>'allocationContractVersion','') NOT IN ('3','5')$source$;
BEGIN
  v_sql := pg_catalog.pg_get_functiondef('demo_payment.validate_demo_authorized_payment()'::pg_catalog.regprocedure);
  IF position(v_old_lookup IN v_sql) = 0
     OR position(v_old_exclusive IN v_sql) = 0
     OR position(v_old_one_time IN v_sql) = 0
  THEN RAISE EXCEPTION 'V5_SOURCE_VALIDATOR_BASELINE_MISMATCH'; END IF;
  v_sql := pg_catalog.replace(v_sql,v_old_lookup,v_new_lookup);
  v_sql := pg_catalog.replace(v_sql,v_old_exclusive,v_new_exclusive);
  v_sql := pg_catalog.replace(v_sql,v_old_one_time,v_new_one_time);
  EXECUTE v_sql;
END $v5_source_validator$;

DO $v5_allocation_integrity$
DECLARE
  v_sql text;
  v_old text := $source$OR NEW.data#>>'{details,allocationContractVersion}' IS DISTINCT FROM '3'$source$;
  v_new text := $source$OR coalesce(NEW.data#>>'{details,allocationContractVersion}','') NOT IN ('3','5')$source$;
BEGIN
  v_sql := pg_catalog.pg_get_functiondef('demo_payment.check_new_v3_source_allocations()'::pg_catalog.regprocedure);
  IF position(v_old IN v_sql) = 0
     OR position('INVALID_V3_ALLOCATION' IN v_sql) = 0
  THEN RAISE EXCEPTION 'V5_ALLOCATION_INTEGRITY_BASELINE_MISMATCH'; END IF;
  EXECUTE pg_catalog.replace(v_sql,v_old,v_new);
END $v5_allocation_integrity$;

-- Do not grant additional access. Existing security-mode, grants, RLS,
-- owner bindings, immutable audit rows and payment event triggers stay intact.
COMMIT;
