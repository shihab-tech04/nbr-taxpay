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
