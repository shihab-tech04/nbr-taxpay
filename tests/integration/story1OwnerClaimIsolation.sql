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
