-- F-039: accept an explicitly reviewed one-time fictional taxpayer as a
-- PAYMENT RECIPIENT, not as a saved beneficiary or a private-data entitlement.
-- The existing guest path, saved-beneficiary path, RLS and Auth bindings remain.
-- No changes to real TIN verification, financial settlement or Office officers.
BEGIN;

DO $install_f039$
DECLARE
  v_sql text;
  v_old constant text :=
    'IF NOT v_saved THEN RAISE EXCEPTION ''INVALID_BENEFICIARY''; END IF;';
  v_new constant text := $guard$
IF NOT v_saved THEN
          -- The public sample lookup is useful for checking a fictional
          -- payment target; it cannot prove the target's account ownership.
          -- Do not add the target to lists or grant it a session/payment read.
          IF NOT (
            new.data->>'origin' = 'TAXPAY_UI'
            AND v_mode = 'OTHER'
            AND v_allocation_view->>'taxpayerName'
                IS NOT DISTINCT FROM v_allocation->>'taxpayerName'
            AND EXISTS (
              SELECT 1
              FROM public.sim_payment_users sample
              CROSS JOIN LATERAL (
                SELECT substring(sample.id from 5)::integer AS n
              ) AS account
              WHERE account.n BETWEEN 1 AND 30
                AND v_tin IN (
                  CASE WHEN account.n BETWEEN 1 AND 9 THEN repeat(account.n::text,12)
                       WHEN account.n = 10 THEN repeat('0',12)
                       ELSE '9090000000'||lpad(account.n::text,2,'0') END,
                  CASE WHEN account.n BETWEEN 1 AND 9 THEN repeat(account.n::text,13)
                       WHEN account.n = 10 THEN '1010101010101'
                       ELSE '90000000000'||lpad(account.n::text,2,'0') END
                )
                AND v_allocation->>'taxpayerName' IN (
                  'User '||account.n::text, sample.name_en
                )
            )
          ) THEN
            RAISE EXCEPTION 'INVALID_BENEFICIARY';
          END IF;
          -- ONE_TIME_PREVIEW_PAYMENT_ONLY: allow payment without list write,
          -- consent inference, ownership claim, or recipient history grant.
        END IF;
$guard$;
BEGIN
  v_sql := pg_get_functiondef(
    'demo_payment.validate_demo_authorized_payment()'::regprocedure
  );
  -- WS5 integration compatibility: the earlier approved combined one-time
  -- recipient migration can already have replaced the original exact guard.
  -- Do not overwrite that stricter, authenticated, payment-session-bound
  -- validator with a second independently authored version. Fail closed if
  -- neither the exact old baseline nor the known stronger guard is present.
  IF position(v_old IN v_sql) = 0 THEN
    IF position('A one-time recipient is not saved' IN v_sql) > 0
       AND position('walkin_sample_tin' IN v_sql) > 0
       AND position('payment_session_id' IN v_sql) > 0
       AND position('v_allocation_view' IN v_sql) > 0 THEN
      RETURN; -- Already installed; no duplicate validator or permission change.
    END IF;
    RAISE EXCEPTION 'F039_COMBINED_VALIDATOR_BASELINE_MISMATCH';
  END IF;
  IF position('ONE_TIME_PREVIEW_PAYMENT_ONLY' IN v_sql) <> 0 THEN
    RAISE EXCEPTION 'F039_COMBINED_VALIDATOR_BASELINE_MISMATCH';
  END IF;
  v_sql := replace(v_sql,v_old,v_new);
  EXECUTE v_sql;
  IF position('ONE_TIME_PREVIEW_PAYMENT_ONLY' IN pg_get_functiondef(
    'demo_payment.validate_demo_authorized_payment()'::regprocedure
  )) = 0 THEN
    RAISE EXCEPTION 'F039_ONE_TIME_GUARD_NOT_INSTALLED';
  END IF;
END
$install_f039$;

COMMIT;
