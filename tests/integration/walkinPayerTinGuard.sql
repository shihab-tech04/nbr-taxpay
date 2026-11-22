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
  -- Parallel unified Walk-in accepts only exact 13-digit fictional
  -- account identities, including the UI's exact EN and BN payer names.
  INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
    jsonb_build_object('origin','TAXPAY_UI','details',jsonb_build_object(
      'payerMode','OTHER','payerTin','1111111111111','payerName','Md. Arif Rahman',
      'receiptSnapshot',jsonb_build_object('payerTin','1111111111111','payerName','Md. Arif Rahman')
    )));
  INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
    jsonb_build_object('origin','TAXPAY_UI','details',jsonb_build_object(
      'payerMode','OTHER','payerTin','9000000000019','payerName','করদাতা অ্যাকাউন্ট 19',
      'receiptSnapshot',jsonb_build_object('payerTin','9000000000019','payerName','করদাতা অ্যাকাউন্ট 19')
    )));

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
      jsonb_set(v_valid,'{details,payerTin}',to_jsonb('22222222222222'::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%INVALID_WALKIN_PAYER_TIN%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'INVALID_GUEST_TIN_LENGTH_ACCEPTED'; END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
      jsonb_set(v_valid,'{details,payerTin}',to_jsonb('1234567890123'::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%UNMATCHED_WALKIN_PAYER_TIN%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'UNLISTED_13_DIGIT_PAYER_ACCEPTED'; END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
      jsonb_build_object('origin','TAXPAY_UI','details',jsonb_build_object(
        'payerMode','OTHER','payerTin','1111111111111','payerName','Forged Name',
        'receiptSnapshot',jsonb_build_object('payerTin','1111111111111','payerName','Forged Name')
      )));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%UNCONFIRMED_WALKIN_PAYER%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FORGED_13_DIGIT_PAYER_NAME_ACCEPTED'; END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
      jsonb_build_object('origin','TAXPAY_UI','details',jsonb_build_object(
        'payerMode','OTHER','payerTin','2222222222222','payerName','Meghna Trading Ltd.',
        'receiptSnapshot',jsonb_build_object('payerTin','3333333333333','payerName','Meghna Trading Ltd.')
      )));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%UNCONFIRMED_WALKIN_PAYER%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FORGED_13_DIGIT_RECEIPT_TIN_ACCEPTED'; END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO walkin_guard_probe VALUES ('OTHER_TAX_PAYMENT',v_guest,
      jsonb_set(v_valid,'{details,receiptSnapshot,payerTin}',to_jsonb('222222222222'::text)));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%UNCONFIRMED_WALKIN_PAYER%' THEN v_blocked := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FORGED_RECEIPT_IDENTITY_ACCEPTED'; END IF;

  IF (SELECT count(*) FROM walkin_guard_probe) <> 5 THEN
    RAISE EXCEPTION 'WALKIN_GUARD_UNEXPECTED_SUCCESSFUL_WRITES';
  END IF;
  IF has_function_privilege('anon',
      'public.taxpay_claim_walkin_payer_payments()','EXECUTE')
     OR NOT has_function_privilege('authenticated',
      'public.taxpay_claim_walkin_payer_payments()','EXECUTE') THEN
    RAISE EXCEPTION 'WALKIN_HISTORY_CLAIM_EXECUTE_GRANTS_INVALID';
  END IF;

  RAISE NOTICE 'PASS: exact 12/13-digit demo payer aliases, blank guest, forged IDs, unmatched TIN, snapshot mismatch and grants';
END $walkin_guard_acceptance$;

-- Verify the real owner-claim RPC under two distinct synthetic authenticated users.
-- All Auth, binding, payment, outbox and ownership rows disappear on ROLLBACK.
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at)
VALUES
 ('84000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','walkin-verified-owner@example.invalid',now(),now(),now()),
 ('84000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','walkin-unrelated-owner@example.invalid',now(),now(),now());
INSERT INTO public.sim_payment_account_bindings(user_id,owner_uid,assigned_by)
VALUES('user1','84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001');

CREATE TEMP TABLE walkin_claim_fixture(payment_id uuid NOT NULL) ON COMMIT DROP;
GRANT SELECT ON walkin_claim_fixture TO authenticated;

WITH created AS (
  INSERT INTO demo_payment.story_payments(idempotency_key,session_id,service_code,amount_minor,data,status)
  VALUES(gen_random_uuid(),gen_random_uuid(),'OTHER_TAX_PAYMENT',2500,
    jsonb_build_object('origin','TAXPAY_UI','details',jsonb_build_object(
      'payerMode','OTHER','payerTin','111111111111','payerName','User 1',
      'receiptSnapshot',jsonb_build_object('payerTin','111111111111','payerName','User 1')
    )), 'SIMULATED_SUCCESS')
  RETURNING id
)
INSERT INTO walkin_claim_fixture(payment_id) SELECT id FROM created;

-- A 13-digit payer's record is claimable ONLY via the same verified
-- admin-assigned user1 binding; it cannot leak to an unrelated account.
WITH created AS (
  INSERT INTO demo_payment.story_payments(idempotency_key,session_id,service_code,amount_minor,data,status)
  VALUES(gen_random_uuid(),gen_random_uuid(),'OTHER_TAX_PAYMENT',2500,
    jsonb_build_object('origin','TAXPAY_UI','details',jsonb_build_object(
      'payerMode','OTHER','payerTin','1111111111111','payerName','Md. Arif Rahman',
      'receiptSnapshot',jsonb_build_object('payerTin','1111111111111','payerName','Md. Arif Rahman')
    )), 'SIMULATED_SUCCESS')
  RETURNING id
)
INSERT INTO walkin_claim_fixture(payment_id) SELECT id FROM created;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','84000000-0000-4000-8000-000000000002',true);
DO $unrelated_claim$
BEGIN
  IF public.taxpay_claim_walkin_payer_payments() <> 0 THEN
    RAISE EXCEPTION 'UNRELATED_ACCOUNT_CLAIMED_WALKIN_PAYMENT';
  END IF;
END $unrelated_claim$;
SELECT set_config('request.jwt.claim.sub','84000000-0000-4000-8000-000000000001',true);
DO $verified_claim$
BEGIN
  IF public.taxpay_claim_walkin_payer_payments() <> 2 THEN
    RAISE EXCEPTION 'VERIFIED_WALKIN_OWNER_CLAIM_MISSING';
  END IF;
  IF public.taxpay_claim_walkin_payer_payments() <> 0 THEN
    RAISE EXCEPTION 'DUPLICATE_WALKIN_CLAIM';
  END IF;
END $verified_claim$;
RESET ROLE;

DO $verify_claim$
BEGIN
  IF (SELECT count(*) FROM public.taxpay_story1_payment_owners o
      JOIN walkin_claim_fixture f ON f.payment_id=o.payment_id
      WHERE o.owner_uid='84000000-0000-4000-8000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'WALKIN_PAYMENT_OWNER_MAPPING_WRONG';
  END IF;
  IF EXISTS (SELECT 1 FROM public.taxpay_story1_payment_owners
             WHERE owner_uid='84000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'UNRELATED_ACCOUNT_RECEIVED_WALKIN_HISTORY';
  END IF;
  RAISE NOTICE 'PASS: verified owner claims original walk-in transaction once; unrelated account receives none';
END $verify_claim$;

-- The same 30-account identity contract must work in demo authorizations;
-- a user19 target previously failed because the SQL constructed 26 digits.
DO $walkin_13_auth$
DECLARE
  v_request jsonb;
  v_rejected boolean := false;
BEGIN
  v_request := public.demo_auth_transition(
    'request','user1',NULL,'9000000000019',NULL
  );
  IF v_request->>'taxpayerId' <> 'user19' OR
     v_request->>'payerId' <> 'user1' OR
     v_request->>'status' <> 'PENDING' THEN
    RAISE EXCEPTION 'DEMO_USER19_AUTHORIZATION_TARGET_MISMATCH';
  END IF;
  BEGIN
    PERFORM public.demo_auth_transition(
      'request','user1',NULL,'9000000000099',NULL
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%TIN_NOT_FOUND%' THEN v_rejected := true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'UNLISTED_AUTHORIZATION_TARGET_ACCEPTED';
  END IF;
  RAISE NOTICE 'PASS: user19 authorization 13-digit alias, unlisted TIN denied';
END $walkin_13_auth$;

ROLLBACK;
