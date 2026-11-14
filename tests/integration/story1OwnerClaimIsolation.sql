-- Disposable Supabase SQL only; all Auth, binding and owner-link fixtures rollback.
BEGIN;
DO $verify_grants$
BEGIN
  IF has_function_privilege('anon','public.taxpay_claim_story1_session(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'CLAIM_ANONYMOUS_EXECUTE_NOT_REVOKED';
  END IF;
  IF NOT has_function_privilege('authenticated','public.taxpay_claim_story1_session(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'CLAIM_AUTHENTICATED_EXECUTE_MISSING';
  END IF;
  IF has_function_privilege('anon',
      'public.taxpay_my_story1_payment_by_reference(text,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated',
      'public.taxpay_my_story1_payment_by_reference(text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'OWNER_LOOKUP_GRANTS_INCORRECT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM taxpay_guest_private.demo_profiles WHERE demo_id='user1') THEN
    RAISE EXCEPTION 'CLAIM_DEMO_PROFILE_FIXTURE_MISSING';
  END IF;
END $verify_grants$;

INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at)
VALUES
 ('83000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','verified-owner-claim@example.invalid',now(),now(),now()),
 ('83000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','unrelated-claim@example.invalid',now(),now(),now());

INSERT INTO public.sim_payment_account_bindings(user_id,owner_uid,assigned_by)
VALUES('user1','83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001');

-- Persist a fictional original SQL payment only inside this rolled-back
-- acceptance transaction; claim from the real signed-in demo owner mapping.
CREATE TEMP TABLE verified_story_lookup_expected(
  payment_id uuid NOT NULL, reference text NOT NULL, mobile text NOT NULL,
  amount_minor bigint NOT NULL
) ON COMMIT DROP;
GRANT SELECT ON verified_story_lookup_expected TO authenticated;
DO $create_owner_reference_fixture$
DECLARE
  v_login jsonb; v_cap text; v_session uuid;
  v_key uuid := pg_catalog.gen_random_uuid(); v_ref text;
  v_result jsonb; v_payload jsonb;
BEGIN
  v_login:=public.taxpay_demo_profile_login('user1','user1');
  v_cap:=pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(v_login->>'capability','UTF8'),'sha256'),'hex');
  v_session:=(v_login->>'paymentSessionId')::uuid;
  v_ref:='WS3-REF-'||v_key::text;
  v_payload:=pg_catalog.jsonb_build_object(
    'origin','TAXPAY_UI','service','TAX_WITH_RETURN','amountMinor',12345,
    'sessionId',v_session,'idempotencyKey',v_key,
    'details',pg_catalog.jsonb_build_object(
      'payerId','user1','payerName','WS3 disposable owner',
      'receiptReference',v_ref,'receiptMobile','01700000000',
      'tokenNumber','WS3-TOKEN-'||v_key::text,
      'gatewayTransactionId','WS3-GW-'||v_key::text,
      'receiptSnapshot',pg_catalog.jsonb_build_object(
        'challanNo',v_ref,'receiptMobile','01700000000',
        'tokenNumber','WS3-TOKEN-'||v_key::text,
        'gatewayTransactionId','WS3-GW-'||v_key::text),
      'lines',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'beneficiary','user1','category','TAX_WITH_RETURN',
        'assessmentYear','2026-27','amountMinor',12345))));
  v_result:=public.taxpay_demo_story1_submit(v_cap,v_payload);
  IF v_result->>'replayed' IS DISTINCT FROM 'false'
  THEN RAISE EXCEPTION 'OWNER_REFERENCE_SOURCE_INSERT_NOT_NEW'; END IF;
  INSERT INTO verified_story_lookup_expected(payment_id,reference,mobile,amount_minor)
  VALUES((v_result->>'id')::uuid,v_ref,'01700000000',12345);
END;
$create_owner_reference_fixture$;

CREATE TEMP TABLE verified_story_claim_expected (expected integer NOT NULL) ON COMMIT DROP;
INSERT INTO verified_story_claim_expected(expected)
SELECT COUNT(*) FROM demo_payment.story_payments p
WHERE p.session_id=(SELECT payment_session_id FROM taxpay_guest_private.demo_profiles WHERE demo_id='user1')
 AND p.status='SIMULATED_SUCCESS'
 AND p.data->>'origin'='TAXPAY_UI'
 AND p.data->'details'->>'payerId'='user1'
 AND NOT EXISTS (SELECT 1 FROM public.taxpay_story1_payment_owners o WHERE o.payment_id=p.id);

CREATE TEMP TABLE verified_story_claim_session (session_id uuid NOT NULL) ON COMMIT DROP;
GRANT SELECT ON verified_story_claim_session TO authenticated;
GRANT SELECT ON verified_story_claim_expected TO authenticated;
INSERT INTO verified_story_claim_session
SELECT payment_session_id FROM taxpay_guest_private.demo_profiles WHERE demo_id='user1';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','83000000-0000-4000-8000-000000000002',true);
DO $unrelated$
DECLARE v_session uuid;
BEGIN
  SELECT session_id INTO v_session FROM verified_story_claim_session;
  IF public.taxpay_claim_story1_session(v_session) <> 0 THEN
    RAISE EXCEPTION 'UNRELATED_AUTH_ACCOUNT_CLAIMED_SESSION';
  END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_story_lookup_expected),NULL) IS NOT NULL
  THEN RAISE EXCEPTION 'OTHER_ACCOUNT_REFERENCE_DATA_EXPOSED'; END IF;

END $unrelated$;

SELECT set_config('request.jwt.claim.sub','83000000-0000-4000-8000-000000000001',true);
DO $verified$
DECLARE v_session uuid; v_claimed integer;
BEGIN
  SELECT session_id INTO v_session FROM verified_story_claim_session;
  v_claimed := public.taxpay_claim_story1_session(v_session);
  IF v_claimed IS DISTINCT FROM (SELECT expected FROM verified_story_claim_expected) THEN
    RAISE EXCEPTION 'VERIFIED_AUTH_OWNER_CLAIM_COUNT_MISMATCH';
  END IF;
  IF public.taxpay_claim_story1_session(v_session) <> 0 THEN
    RAISE EXCEPTION 'OWNER_CLAIM_IDEMPOTENCY_FAILED';
  END IF;
  -- A new authenticated browser session needs no old guest session/capability
  -- to read its *already claimed* original payment; wrong owner and wrong
  -- receipt mobile must never match.
  IF public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_story_lookup_expected),NULL)->>'id'
         IS DISTINCT FROM (SELECT payment_id::text FROM verified_story_lookup_expected)
  THEN RAISE EXCEPTION 'OWNER_REFERENCE_LOOKUP_FAILED'; END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       (SELECT payment_id::text FROM verified_story_lookup_expected),NULL)->>'amountMinor'
         IS DISTINCT FROM '12345'
  THEN RAISE EXCEPTION 'OWNER_UUID_PAYMENT_AMOUNT_CHANGED'; END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       'SK-PC-'||(SELECT payment_id::text FROM verified_story_lookup_expected),NULL)->>'id'
         IS DISTINCT FROM (SELECT payment_id::text FROM verified_story_lookup_expected)
  THEN RAISE EXCEPTION 'OWNER_CERTIFICATE_REFERENCE_NOT_FOUND'; END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_story_lookup_expected),'01799999999') IS NOT NULL
  THEN RAISE EXCEPTION 'OWNER_WRONG_MOBILE_RETURNED_PAYMENT'; END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       'NOT-A-SAVED-REFERENCE',NULL) IS NOT NULL
  THEN RAISE EXCEPTION 'OWNER_UNKNOWN_REFERENCE_MATCHED'; END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_story_lookup_expected),'01700000000')->>'id'
         IS DISTINCT FROM (SELECT payment_id::text FROM verified_story_lookup_expected)
  THEN RAISE EXCEPTION 'OWNER_RECEIPT_MOBILE_MATCH_FAILED'; END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_story_lookup_expected),NULL)
     IS DISTINCT FROM public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_story_lookup_expected),NULL)
  THEN RAISE EXCEPTION 'OWNER_RETRY_READ_CHANGED'; END IF;


END $verified$;
RESET ROLE;

DO $assert_isolation$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.taxpay_story1_payment_owners o
    JOIN demo_payment.story_payments p ON p.id=o.payment_id
    WHERE o.owner_uid='83000000-0000-4000-8000-000000000001'
      AND (p.data->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
        OR p.data->'details'->>'payerId' IS DISTINCT FROM 'user1')
  ) THEN RAISE EXCEPTION 'UNRELATED_PAYMENT_ATTACHED_TO_AUTH_ACCOUNT'; END IF;
  IF EXISTS (SELECT 1 FROM public.taxpay_story1_payment_owners o
             WHERE o.owner_uid='83000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'UNRELATED_AUTH_ACCOUNT_OWNERSHIP_CREATED'; END IF;
END $assert_isolation$;
ROLLBACK;
