-- F-167 / US-168: disposable, rollback-only SQL boundary acceptance.
-- Exercise the exact production trigger on a temporary table, without changing
-- payment history, identity bindings, Office records or public authorization.
BEGIN;

CREATE TEMP TABLE walkin_guard_probe (
  service_code text NOT NULL,
  session_id uuid NOT NULL,
  data jsonb NOT NULL
) ON COMMIT DROP;
CREATE TRIGGER walkin_guard_probe_insert
BEFORE INSERT ON walkin_guard_probe
FOR EACH ROW EXECUTE FUNCTION demo_payment.validate_walkin_payer_tin();

DO $walkin_guard_acceptance$
DECLARE
  v_guest uuid := gen_random_uuid();
  v_preview uuid;
  v_valid jsonb;
  v_blocked boolean;
BEGIN
  SELECT payment_session_id INTO v_preview
  FROM taxpay_guest_private.demo_profiles WHERE demo_id = 'user1';
  IF v_preview IS NULL THEN RAISE EXCEPTION 'EXISTING_PROFILE_FIXTURE_MISSING'; END IF;

  v_valid := jsonb_build_object(
    'origin','TAXPAY_UI',
    'details',jsonb_build_object(
      'payerMode','OTHER','payerTin','111111111111','payerName','User 1',
      'receiptSnapshot',jsonb_build_object('payerTin','111111111111','payerName','User 1')
    )
  );

  -- Exact confirmed TIN and matched receipt identity are accepted.
  INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,v_valid);
  -- Blank TIN preserves the original walk-in path.
  INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
    jsonb_set(v_valid,'{details,payerTin}',to_jsonb('GUEST'::text)));
  -- Existing capability-scoped demo payer is allowed only with its own session.
  INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_preview,
    jsonb_set(v_valid,'{details,payerId}',to_jsonb('user1'::text)));

  v_blocked := false;
  BEGIN
    INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
      jsonb_set(v_valid,'{details,payerId}',to_jsonb('user1'::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%UNAUTHORIZED_WALKIN_PAYER_ID%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FORGED_PROFILE_SESSION_ACCEPTED'; END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
      jsonb_set(v_valid,'{details,payerId}',to_jsonb('fake-user'::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%UNAUTHORIZED_WALKIN_PAYER_ID%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FORGED_PROFILE_ID_ACCEPTED'; END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
      jsonb_set(v_valid,'{details,payerTin}',to_jsonb('123456789012'::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%UNMATCHED_WALKIN_PAYER_TIN%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'UNMATCHED_GUEST_TIN_ACCEPTED'; END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
      jsonb_set(v_valid,'{details,payerTin}',to_jsonb('2222222222222'::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%INVALID_WALKIN_PAYER_TIN%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'INVALID_GUEST_TIN_LENGTH_ACCEPTED'; END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
      jsonb_set(v_valid,'{details,receiptSnapshot,payerTin}',to_jsonb('222222222222'::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%UNCONFIRMED_WALKIN_PAYER%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FORGED_RECEIPT_IDENTITY_ACCEPTED'; END IF;

  IF (SELECT count(*) FROM walkin_guard_probe) <> 3 THEN
    RAISE EXCEPTION 'WALKIN_GUARD_UNEXPECTED_SUCCESSFUL_WRITES';
  END IF;
  IF has_function_privilege('anon',
      'public.taxpay_claim_walkin_payer_payments()','EXECUTE')
     OR NOT has_function_privilege('authenticated',
      'public.taxpay_claim_walkin_payer_payments()','EXECUTE') THEN
    RAISE EXCEPTION 'WALKIN_HISTORY_CLAIM_EXECUTE_GRANTS_INVALID';
  END IF;

  RAISE NOTICE 'PASS: verified and blank guest payer cases, preview-session separation, forged-ID/TIN/name rejection and authenticated-only claim grant';
END $walkin_guard_acceptance$;

ROLLBACK;
