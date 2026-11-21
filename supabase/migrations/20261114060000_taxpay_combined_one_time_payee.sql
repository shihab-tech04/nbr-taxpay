-- F-039/US-014: an existing saved payee and a confirmed, one-time public
-- fictional TIN lookup can share one v3 Other Tax parent without adding that
-- TIN to the payer's private saved list. This affects only the original
-- Taxpayer disposable payment contract, never Office SQL or actual tax credit.
-- The public synthetic TIN catalogue is NOT taxpayer authorization.
BEGIN;
DO $one_time$
DECLARE
  v_existing text := 'IF NOT v_saved THEN RAISE EXCEPTION ''INVALID_BENEFICIARY''; END IF;';
  v_replacement text := $verified$
        IF NOT v_saved THEN
          -- A one-time recipient is not saved, entitled to private data, or
          -- automatically imported. Allow only the existing server-known
          -- fictional 30-profile lookup aliases after a verified payer session.
          -- No arbitrary typed TIN, claimed name or alternate payment mode.
          SELECT candidate.number INTO v_number
          FROM pg_catalog.generate_series(1,30) AS candidate(number)
          WHERE taxpay_guest_private.walkin_sample_tin(
            'user'||candidate.number::text) = v_tin;
          IF v_number IS NULL
             OR new.data->'details'->>'allocationContractVersion' IS DISTINCT FROM '3'
             OR NOT EXISTS (
               SELECT 1 FROM taxpay_guest_private.demo_profiles prof
               WHERE prof.demo_id=v_payer AND prof.payment_session_id=new.session_id)
             OR v_allocation->>'taxpayerName' NOT IN (
               (CASE WHEN v_number<=10 THEN 'User ' ELSE 'Taxpayer Account ' END)||v_number::text,
               (CASE WHEN v_number<=10 THEN 'ইউজার ' ELSE 'করদাতা অ্যাকাউন্ট ' END)||v_number::text)
             OR v_allocation_view->>'taxpayerName'
                  IS DISTINCT FROM v_allocation->>'taxpayerName'
          THEN RAISE EXCEPTION 'INVALID_BENEFICIARY'; END IF;
        END IF;
$verified$;
  v_sql text;
BEGIN
  v_sql:=pg_catalog.pg_get_functiondef(
    'demo_payment.validate_demo_authorized_payment()'::pg_catalog.regprocedure);
  IF (pg_catalog.length(v_sql)-pg_catalog.length(pg_catalog.replace(v_sql,v_existing,'')))
      IS DISTINCT FROM pg_catalog.length(v_existing)
     OR pg_catalog.to_regprocedure('taxpay_guest_private.walkin_sample_tin(text)') IS NULL
  THEN RAISE EXCEPTION 'F039_COMBINED_GUARD_BASELINE_MISMATCH'; END IF;
  EXECUTE pg_catalog.replace(v_sql,v_existing,v_replacement);
  IF pg_catalog.strpos(
       pg_catalog.pg_get_functiondef(
         'demo_payment.validate_demo_authorized_payment()'::pg_catalog.regprocedure),
       'A one-time recipient is not saved')=0
  THEN RAISE EXCEPTION 'F039_GUARD_NOT_INSTALLED'; END IF;
END
$one_time$;
-- No new SQL grants, Auth bindings, RLS bypass, payment records, Office rows,
-- or implicit beneficiary entries. Existing saved-TIN and Return guards stay.
COMMIT;
