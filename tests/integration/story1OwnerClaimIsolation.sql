-- Disposable Supabase SQL only; all Auth, binding and owner-link fixtures rollback.
BEGIN;
DO $verify_grants$
BEGIN
  -- A guessed request UUID must never expose an Office authorization
  -- snapshot through the public Taxpayer Data API.
  IF has_function_privilege('anon',
       'public.demo_auth_public_snapshot(uuid)','EXECUTE')
     OR has_function_privilege('authenticated',
       'public.demo_auth_public_snapshot(uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.demo_auth_public_snapshot(uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'AUTHORIZATION_SNAPSHOT_PUBLIC_LEAK'; END IF;
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
      'payerMode','SELF','payerTin','111111111111',
      'taxpayerTin','111111111111','assessmentYear','2026-27',
      'receiptReference',v_ref,'receiptMobile','01700000000',
      'tokenNumber','WS3-TOKEN-'||v_key::text,
      'gatewayTransactionId','WS3-GW-'||v_key::text,
      'receiptSnapshot',pg_catalog.jsonb_build_object(
        'challanNo',v_ref,'receiptMobile','01700000000',
        'tokenNumber','WS3-TOKEN-'||v_key::text,
        'gatewayTransactionId','WS3-GW-'||v_key::text,
        'paymentCategory','TAX_WITH_RETURN','payerTin','111111111111',
        'taxpayerTin','111111111111','assessmentYear','2026-27','totalAmount',123.45,
        'items',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'headId',125,'totalAmount',123.45))),
      'lines',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'beneficiary','user1','category','TAX_WITH_RETURN','headId',125,
        'assessmentYear','2026-27','amountMinor',12345,'totalAmount',123.45))));
  v_result:=public.taxpay_demo_story1_submit(v_cap,v_payload);
  IF v_result->>'replayed' IS DISTINCT FROM 'false'
  THEN RAISE EXCEPTION 'OWNER_REFERENCE_SOURCE_INSERT_NOT_NEW'; END IF;
  INSERT INTO verified_story_lookup_expected(payment_id,reference,mobile,amount_minor)
  VALUES((v_result->>'id')::uuid,v_ref,'01700000000',12345);
END;
$create_owner_reference_fixture$;

-- A real saved source-payment fixture, not a mocked account-history RPC.
-- This test runs only in disposable local PostgreSQL and the transaction rolls back.
-- The two original allocations deliberately differ by recipient, head and AY.
INSERT INTO public.demo_authorization_requests(id,payer_id,taxpayer_id,status,confirmed_at)
VALUES ('83000000-0000-4000-8000-000000000077','user1','user2','ACTIVE',now());

CREATE TEMP TABLE verified_story_claim_source (
  payment_id uuid NOT NULL,
  source_data jsonb NOT NULL,
  amount_minor bigint NOT NULL
) ON COMMIT DROP;
GRANT SELECT ON verified_story_claim_source TO authenticated;

WITH source AS (
  SELECT gen_random_uuid() id, gen_random_uuid() request_key,
    profile.payment_session_id session_id,
    jsonb_build_object(
      'payerId','user1','payerName','Synthetic owner',
      'lines',jsonb_build_array(
        jsonb_build_object(
          'beneficiary','user1','taxpayerTin','111111111111',
          'taxpayerName','Source recipient A','category','ADVANCE_TAX',
          'headId',68,'assessmentYear','2026-27','amountMinor',1500),
        jsonb_build_object(
          'beneficiary','user2','taxpayerTin','222222222222',
          'taxpayerName','Source recipient B','category','PENALTY',
          'headId',69,'assessmentYear','2025-26','amountMinor',3500,
          'authorizationId','83000000-0000-4000-8000-000000000077')
      )
    ) details
  FROM taxpay_guest_private.demo_profiles profile
  WHERE profile.demo_id='user1'
), stored AS (
  INSERT INTO demo_payment.story_payments
    (id,idempotency_key,session_id,service_code,amount_minor,data,status)
  SELECT id,request_key,session_id,'OTHER_TAX_PAYMENT',5000,
    jsonb_build_object(
      'origin','TAXPAY_UI','idempotencyKey',request_key,
      'sessionId',session_id,'service','OTHER_TAX_PAYMENT',
      'amountMinor',5000,'details',details
    ),'SIMULATED_SUCCESS'
  FROM source
  RETURNING id,data,amount_minor
)
INSERT INTO verified_story_claim_source(payment_id,source_data,amount_minor)
SELECT id,data,amount_minor FROM stored;

DO $source_fixture$
BEGIN
  IF (SELECT count(*) FROM verified_story_claim_source) <> 1 THEN
    RAISE EXCEPTION 'SOURCE_HISTORY_FIXTURE_NOT_INSERTED';
  END IF;
END $source_fixture$;
-- Pay Again from the original recorded SQL payment: verify that the same
-- genuine local Supabase Auth UID can claim and read BOTH immutable parents
-- after a new browser session, without an old guest capability or typed TIN.
CREATE TEMP TABLE verified_pay_again_expected(
 payment_id uuid NOT NULL,source_payment_id uuid NOT NULL,
 reference text NOT NULL
) ON COMMIT DROP;
GRANT SELECT ON verified_pay_again_expected TO authenticated;
DO $create_owned_repeat$
DECLARE
  v_original demo_payment.story_payments%ROWTYPE;
  v_login jsonb;
  v_cap text;
  v_new_key uuid:=pg_catalog.gen_random_uuid();
  v_new_ref text:='SIM-'||v_new_key::text;
  v_payload jsonb;
  v_repeat jsonb;
BEGIN
  SELECT * INTO v_original FROM demo_payment.story_payments
  WHERE id=(SELECT payment_id FROM verified_story_lookup_expected);
  IF NOT FOUND THEN RAISE EXCEPTION 'PAY_AGAIN_ORIGINAL_SOURCE_NOT_FOUND'; END IF;
  v_login:=public.taxpay_demo_profile_login('user1','user1');
  v_cap:=pg_catalog.encode(extensions.digest(
     pg_catalog.convert_to(v_login->>'capability','UTF8'),'sha256'),'hex');
  v_payload:=pg_catalog.jsonb_set(v_original.data,'{idempotencyKey}',
    pg_catalog.to_jsonb(v_new_key::text));
  v_payload:=pg_catalog.jsonb_set(v_payload,'{details,sourcePaymentId}',
    pg_catalog.to_jsonb(v_original.id::text),true);
  v_payload:=pg_catalog.jsonb_set(v_payload,'{details,receiptReference}',
    pg_catalog.to_jsonb(v_new_ref),true);
  v_payload:=pg_catalog.jsonb_set(v_payload,'{details,receiptSnapshot,challanNo}',
    pg_catalog.to_jsonb(v_new_ref),true);
  v_payload:=pg_catalog.jsonb_set(v_payload,'{details,receiptSnapshot,tokenNumber}',
    pg_catalog.to_jsonb('WS3-NEW-TOKEN-'||v_new_key::text),true);
  v_payload:=pg_catalog.jsonb_set(v_payload,'{details,receiptSnapshot,gatewayTransactionId}',
    pg_catalog.to_jsonb('WS3-NEW-GW-'||v_new_key::text),true);
  v_payload:=pg_catalog.jsonb_set(v_payload,'{details,tokenNumber}',
    pg_catalog.to_jsonb('WS3-NEW-TOKEN-'||v_new_key::text),true);
  v_payload:=pg_catalog.jsonb_set(v_payload,'{details,gatewayTransactionId}',
    pg_catalog.to_jsonb('WS3-NEW-GW-'||v_new_key::text),true);
  v_repeat:=public.taxpay_demo_story1_submit(v_cap,v_payload);
  IF v_repeat->>'replayed' IS DISTINCT FROM 'false' OR
     v_repeat->>'id' IS NOT DISTINCT FROM v_original.id::text
  THEN RAISE EXCEPTION 'PAY_AGAIN_VERIFIED_OWNER_REPEAT_FAILED'; END IF;
  IF (SELECT data FROM demo_payment.story_payments WHERE id=v_original.id)
     IS DISTINCT FROM v_original.data
  THEN RAISE EXCEPTION 'PAY_AGAIN_ORIGINAL_FINANCIAL_RECORD_MUTATED'; END IF;
  INSERT INTO verified_pay_again_expected
  VALUES((v_repeat->>'id')::uuid,v_original.id,v_new_ref);
END;
$create_owned_repeat$;

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
  IF public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_pay_again_expected),NULL) IS NOT NULL
  THEN RAISE EXCEPTION 'OTHER_AUTH_ACCOUNT_PAY_AGAIN_EXPOSED'; END IF;

  IF EXISTS (
    SELECT 1 FROM verified_story_claim_source source,
      LATERAL jsonb_array_elements(
        public.taxpay_my_story1_payments(1,100)->'items'
      ) item(value)
    WHERE item.value->>'id'=source.payment_id::text
  ) THEN
    RAISE EXCEPTION 'UNRELATED_AUTH_ACCOUNT_READ_SOURCE_HISTORY';
  END IF;
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
       (SELECT reference FROM verified_pay_again_expected),NULL)->>'id'
         IS DISTINCT FROM (SELECT payment_id::text FROM verified_pay_again_expected)
     OR public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_pay_again_expected),NULL)
          #>>'{details,sourcePaymentId}'
         IS DISTINCT FROM (SELECT source_payment_id::text FROM verified_pay_again_expected)
     OR public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_pay_again_expected),NULL)->>'certificateReference'
         IS DISTINCT FROM 'SK-PC-'||
           (SELECT payment_id::text FROM verified_pay_again_expected)
  THEN RAISE EXCEPTION 'AUTH_OWNER_REPEAT_HISTORY_LINEAGE_MISMATCH'; END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       (SELECT payment_id::text FROM verified_story_lookup_expected),NULL)->>'amountMinor'
         IS DISTINCT FROM '12345'
  THEN RAISE EXCEPTION 'OWNER_UUID_PAYMENT_AMOUNT_CHANGED'; END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       'SK-PC-'||(SELECT payment_id::text FROM verified_story_lookup_expected),NULL)->>'id'
         IS DISTINCT FROM (SELECT payment_id::text FROM verified_story_lookup_expected)
  THEN RAISE EXCEPTION 'OWNER_CERTIFICATE_REFERENCE_NOT_FOUND'; END IF;
  IF public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_story_lookup_expected),NULL)->>'receiptReference'
         IS DISTINCT FROM (SELECT reference FROM verified_story_lookup_expected)
     OR public.taxpay_my_story1_payment_by_reference(
       (SELECT reference FROM verified_story_lookup_expected),NULL)->>'certificateReference'
         IS DISTINCT FROM 'SK-PC-'||
           (SELECT payment_id::text FROM verified_story_lookup_expected)
  THEN RAISE EXCEPTION 'OWNER_RECEIPT_CERTIFICATE_REFERENCE_MISMATCH'; END IF;
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

  IF NOT EXISTS (
    SELECT 1
    FROM verified_story_claim_source source,
      LATERAL jsonb_array_elements(
        public.taxpay_my_story1_payments(1,100)->'items'
      ) item(value)
    WHERE item.value->>'id'=source.payment_id::text
      AND item.value->>'status'='SIMULATED_SUCCESS'
      AND item.value->>'service'='OTHER_TAX_PAYMENT'
      AND (item.value->>'amountMinor')::bigint=source.amount_minor
      AND item.value->'details'=source.source_data->'details'
      AND jsonb_array_length(item.value->'details'->'lines')=2
      AND (
        SELECT sum((part.value->>'amountMinor')::bigint)
        FROM jsonb_array_elements(item.value->'details'->'lines') part(value)
      )=source.amount_minor
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(item.value->'details'->'lines') part(value)
        WHERE part.value->>'beneficiary'='user1'
          AND part.value->>'taxpayerTin'='111111111111'
          AND part.value->>'category'='ADVANCE_TAX'
          AND part.value->>'assessmentYear'='2026-27'
          AND (part.value->>'amountMinor')::bigint=1500
      )
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(item.value->'details'->'lines') part(value)
        WHERE part.value->>'beneficiary'='user2'
          AND part.value->>'taxpayerTin'='222222222222'
          AND part.value->>'category'='PENALTY'
          AND part.value->>'assessmentYear'='2025-26'
          AND (part.value->>'amountMinor')::bigint=3500
      )
  ) THEN
    RAISE EXCEPTION 'ORIGINAL_MULTI_RECIPIENT_SOURCE_READBACK_MISMATCH';
  END IF;
END $verified$;
RESET ROLE;

DO $assert_isolation$
BEGIN
  IF EXISTS (
    SELECT 1 FROM verified_story_claim_source source
    JOIN demo_payment.story_payments payment ON payment.id=source.payment_id
    WHERE payment.amount_minor<>source.amount_minor
       OR payment.data IS DISTINCT FROM source.source_data
  ) THEN RAISE EXCEPTION 'OWNER_CLAIM_MODIFIED_ORIGINAL_SOURCE_PAYMENT'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM verified_story_claim_source source
    JOIN public.taxpay_story1_payment_owners link ON link.payment_id=source.payment_id
    WHERE link.owner_uid='83000000-0000-4000-8000-000000000001'
  ) THEN RAISE EXCEPTION 'ORIGINAL_SOURCE_PAYMENT_OWNER_LINK_MISSING'; END IF;
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
