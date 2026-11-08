-- Restore the preceding guarded demo payment trigger when rolling back the scoped
-- external saved-TIN simulation fix. No data is deleted.
-- Signed-in *simulated* payments use a saved beneficiary, not tax-data consent.
-- Preserve all existing demo authorization checks for non-wizard payment paths.
-- This is a private trigger: neither user input nor browser status can authorize a new beneficiary.
CREATE OR REPLACE FUNCTION demo_payment.validate_demo_authorized_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_payer text;
  v_lines jsonb;
  v_line jsonb;
  v_beneficiary text;
  v_auth uuid;
  v_amount bigint;
  v_sum bigint := 0;
  v_tin text;
  v_number integer;
  v_expected13 text;
  v_expected12 text;
  v_saved boolean;
BEGIN
  v_payer := new.data->'details'->>'payerId';
  IF v_payer IS NULL THEN RETURN new; END IF;
  IF v_payer !~ '^user([1-9]|[12][0-9]|30)$' OR
     NOT EXISTS (SELECT 1 FROM public.sim_payment_users WHERE id=v_payer)
  THEN RAISE EXCEPTION 'INVALID_DEMO_PAYER'; END IF;
  v_lines := new.data->'details'->'lines';
  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_array_length(v_lines) NOT BETWEEN 1 AND 20
  THEN RAISE EXCEPTION 'INVALID_BENEFICIARY_LINES'; END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_beneficiary := v_line->>'beneficiary';
    IF NOT EXISTS (SELECT 1 FROM public.sim_payment_users WHERE id=v_beneficiary)
    THEN RAISE EXCEPTION 'INVALID_BENEFICIARY'; END IF;
    IF coalesce(v_line->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$'
    THEN RAISE EXCEPTION 'INVALID_ALLOCATION_AMOUNT'; END IF;
    v_amount := (v_line->>'amountMinor')::bigint;
    v_sum := v_sum + v_amount;
    IF v_beneficiary <> v_payer THEN
      v_saved := false;
      -- The existing UI permits simulated payments for saved beneficiaries
      -- without access to their private data. Verify the server-side list,
      -- tied to the exact capability and demo payment session.
      IF new.data->>'origin' = 'TAXPAY_UI'
         AND new.data->'details'->>'payerMode' = 'OTHER'
         AND jsonb_typeof(new.data->'details'->'receiptSnapshot') = 'object'
         AND jsonb_array_length(v_lines) = 1
         AND v_line->>'authorizationId' IS NULL THEN
        v_tin := btrim(coalesce(new.data->'details'->>'taxpayerTin',''));
        v_number := substring(v_beneficiary from 5)::integer;
        v_expected13 := CASE
          WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,13)
          WHEN v_number = 10 THEN '1010101010101'
          ELSE '90000000000'||lpad(v_number::text,2,'0') END;
        v_expected12 := CASE
          WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,12)
          WHEN v_number = 10 THEN repeat('0',12)
          ELSE '9090000000'||lpad(v_number::text,2,'0') END;
        IF v_tin IN (v_expected12,v_expected13) THEN
          SELECT EXISTS (
            SELECT 1
            FROM taxpay_guest_private.demo_profiles prof
            JOIN taxpay_guest_private.sessions guest_sess
              ON guest_sess.capability_hash =
                 encode(extensions.digest(convert_to(prof.capability_token,'UTF8'),'sha256'),'hex')
            JOIN taxpay_guest_private.lists owned_list
              ON owned_list.session_id = guest_sess.id
            JOIN taxpay_guest_private.beneficiaries saved
              ON saved.session_id = guest_sess.id AND saved.list_id = owned_list.id
            WHERE prof.demo_id = v_payer
              AND prof.payment_session_id = new.session_id
              AND saved.tin = v_tin
          ) INTO v_saved;
        END IF;
      END IF;
      IF NOT v_saved THEN
        IF coalesce(v_line->>'authorizationId','') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN RAISE EXCEPTION 'AUTHORIZATION_REQUIRED'; END IF;
        v_auth := (v_line->>'authorizationId')::uuid;
        IF NOT EXISTS (
          SELECT 1 FROM public.demo_authorization_requests a
          WHERE a.id=v_auth AND a.payer_id=v_payer AND a.taxpayer_id=v_beneficiary
            AND a.status='ACTIVE'
        ) THEN RAISE EXCEPTION 'AUTHORIZATION_REQUIRED'; END IF;
      END IF;
    END IF;
  END LOOP;
  IF v_sum <> new.amount_minor THEN RAISE EXCEPTION 'ALLOCATION_TOTAL_MISMATCH'; END IF;
  RETURN new;
END;
$function$;
