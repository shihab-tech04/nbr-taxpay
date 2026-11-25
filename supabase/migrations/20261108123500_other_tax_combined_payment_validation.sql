-- Verify Office-compatible, single-payment Other Tax allocations against
-- payer-owned saved beneficiaries, head totals and the exact shared receipt.
-- Preserve the preceding saved-TIN legacy payment authorization path.
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
  v_allowed_tin boolean;
  v_allocations jsonb;
  v_snapshot jsonb;
  v_allocation jsonb;
  v_allocation_view jsonb;
  v_i integer;
  v_count integer;
  v_mode text;
BEGIN
  v_payer := new.data->'details'->>'payerId';
  IF v_payer IS NULL THEN RETURN new; END IF;
  IF v_payer !~ '^user([1-9]|[12][0-9]|30)$' OR
     NOT EXISTS (SELECT 1 FROM public.sim_payment_users WHERE id=v_payer)
  THEN RAISE EXCEPTION 'INVALID_DEMO_PAYER'; END IF;
  v_lines := new.data->'details'->'lines';
  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_array_length(v_lines) NOT BETWEEN 1 AND 20
  THEN RAISE EXCEPTION 'INVALID_BENEFICIARY_LINES'; END IF;
  -- One Office-compatible payment transaction, many independently verified
  -- taxpayer allocations. Keep accounting heads in details.lines and explicit
  -- beneficiary shares in details.allocations; never mix synthetic user IDs.
  IF new.data->'details'->>'combinedPayment' = 'true' THEN
    v_mode := new.data->'details'->>'payerMode';
    v_allocations := new.data->'details'->'allocations';
    v_snapshot := new.data->'details'->'receiptSnapshot';
    v_count := jsonb_array_length(v_lines);
    IF new.service_code <> 'OTHER_TAX_PAYMENT'
       OR v_mode IS NULL OR v_mode NOT IN ('OTHER','SELF')
       OR jsonb_typeof(v_allocations) IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_snapshot) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_snapshot->'items') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_snapshot->'allocationItems') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_allocations) <> v_count
       OR jsonb_array_length(v_snapshot->'items') <> v_count
       OR jsonb_array_length(v_snapshot->'allocationItems') <> v_count
       OR coalesce(new.data->'details'->>'allocationCount','') <> v_count::text
       OR v_snapshot->>'paymentCategory' <> 'OTHER_TAX_PAYMENT'
       OR v_snapshot->>'challanNo' <> 'SIM-' || new.idempotency_key::text
       OR v_snapshot->>'challanNo' IS DISTINCT FROM new.data->'details'->>'receiptReference'
       OR coalesce(v_snapshot->>'totalAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
       OR (v_snapshot->>'totalAmount')::numeric * 100 <> new.amount_minor
    THEN RAISE EXCEPTION 'INVALID_COMBINED_PAYMENT'; END IF;

    FOR v_i IN 0..v_count - 1 LOOP
      v_line := v_lines->v_i;
      v_allocation := v_allocations->v_i;
      v_allocation_view := v_snapshot->'allocationItems'->v_i;
      v_tin := btrim(coalesce(v_allocation->>'taxpayerTin',''));
      IF jsonb_typeof(v_line) <> 'object'
        OR jsonb_typeof(v_allocation) <> 'object'
        OR jsonb_typeof(v_allocation_view) <> 'object'
        OR v_tin !~ '^[0-9]{12,13}$'
        OR coalesce(v_allocation->>'assessmentYear','') = ''
        OR coalesce(v_allocation->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$'
        OR coalesce(v_allocation->>'headId','') !~ '^[1-9][0-9]{0,8}$'
        OR v_line->>'headId' IS DISTINCT FROM v_allocation->>'headId'
        OR (v_snapshot->'items'->v_i) IS DISTINCT FROM v_line
        OR coalesce(v_line->>'totalAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
        OR (v_line->>'totalAmount')::numeric * 100 <> (v_allocation->>'amountMinor')::bigint
        OR v_allocation_view->>'taxpayerTin' IS DISTINCT FROM v_tin
        OR v_allocation_view->>'assessmentYear' IS DISTINCT FROM v_allocation->>'assessmentYear'
        OR v_allocation_view->>'amountMinor' IS DISTINCT FROM v_allocation->>'amountMinor'
      THEN RAISE EXCEPTION 'INVALID_COMBINED_ALLOCATION'; END IF;
      v_amount := (v_allocation->>'amountMinor')::bigint;
      v_sum := v_sum + v_amount;
      IF v_mode = 'SELF' THEN
        v_number := substring(v_payer from 5)::integer;
        v_expected13 := CASE
          WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,13)
          WHEN v_number = 10 THEN '1010101010101'
          ELSE '90000000000'||lpad(v_number::text,2,'0') END;
        v_expected12 := CASE
          WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,12)
          WHEN v_number = 10 THEN '000000000000'
          ELSE '9090000000'||lpad(v_number::text,2,'0') END;
        IF v_tin IS DISTINCT FROM new.data->'details'->>'taxpayerTin'
          OR v_tin NOT IN (v_expected12,v_expected13)
        THEN RAISE EXCEPTION 'INVALID_SELF_ALLOCATION'; END IF;
      ELSE
        IF new.data->>'origin' <> 'TAXPAY_UI' THEN RAISE EXCEPTION 'INVALID_BENEFICIARY'; END IF;
        SELECT EXISTS(
          SELECT 1 FROM taxpay_guest_private.demo_profiles prof
          JOIN taxpay_guest_private.sessions sess
            ON sess.capability_hash =
              encode(extensions.digest(convert_to(prof.capability_token,'UTF8'),'sha256'),'hex')
          JOIN taxpay_guest_private.lists own_list ON own_list.session_id=sess.id
          JOIN taxpay_guest_private.beneficiaries saved
            ON saved.session_id=sess.id AND saved.list_id=own_list.id
          WHERE prof.demo_id=v_payer AND prof.payment_session_id=new.session_id
            AND saved.tin=v_tin
        ) INTO v_saved;
        IF NOT v_saved THEN RAISE EXCEPTION 'INVALID_BENEFICIARY'; END IF;
      END IF;
    END LOOP;
    IF v_sum <> new.amount_minor THEN RAISE EXCEPTION 'ALLOCATION_TOTAL_MISMATCH'; END IF;
    RETURN new;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_beneficiary := v_line->>'beneficiary';
    IF v_beneficiary !~ '^SAVED_TIN:[0-9]{12,13}$' AND
       NOT EXISTS (SELECT 1 FROM public.sim_payment_users WHERE id=v_beneficiary)
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
        -- Preserve literal external TIN identity; only owner-scoped saved rows
        -- can satisfy the new branch. No implicit authorization is generated.
        IF v_beneficiary LIKE 'SAVED_TIN:%' THEN
          v_allowed_tin := v_beneficiary = 'SAVED_TIN:'||v_tin
            AND v_tin ~ '^[0-9]{12,13}$'
            AND new.data->'details'->'receiptSnapshot'->>'taxpayerTin' = v_tin;
        ELSE
          v_number := substring(v_beneficiary from 5)::integer;
          v_expected13 := CASE
            WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,13)
            WHEN v_number = 10 THEN '1010101010101'
            ELSE '90000000000'||lpad(v_number::text,2,'0') END;
          v_expected12 := CASE
            WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,12)
            WHEN v_number = 10 THEN repeat('0',12)
            ELSE '9090000000'||lpad(v_number::text,2,'0') END;
          v_allowed_tin := v_tin IN (v_expected12,v_expected13);
        END IF;
        IF v_allowed_tin THEN
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
        -- A failed external saved-TIN check cannot use an unrelated consent.
        IF v_beneficiary LIKE 'SAVED_TIN:%' THEN
          RAISE EXCEPTION 'INVALID_BENEFICIARY';
        END IF;
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
