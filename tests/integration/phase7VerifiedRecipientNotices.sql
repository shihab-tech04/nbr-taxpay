\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA demo_payment;
CREATE SCHEMA taxpay_guest_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS 'SELECT NULLIF(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz
);
CREATE TABLE public.sim_payment_account_bindings (
  user_id text PRIMARY KEY, owner_uid uuid NOT NULL
);
CREATE TABLE public.taxpay_taxpayer_registration_profiles (
  account_id text PRIMARY KEY, tin text NOT NULL
);
CREATE TABLE demo_payment.story_payments (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL,
  service_code text NOT NULL,
  status text NOT NULL,
  data jsonb NOT NULL
);
INSERT INTO auth.users(id,email_confirmed_at) VALUES
 ('11111111-1111-4111-8111-111111111111',now()),
 ('22222222-2222-4222-8222-222222222222',now()),
 ('33333333-3333-4333-8333-333333333333',NULL),
 ('44444444-4444-4444-8444-444444444444',now());
INSERT INTO public.sim_payment_account_bindings(user_id,owner_uid) VALUES
 ('recipientA','11111111-1111-4111-8111-111111111111'),
 ('recipientB','22222222-2222-4222-8222-222222222222'),
 ('recipientC','33333333-3333-4333-8333-333333333333');
INSERT INTO public.taxpay_taxpayer_registration_profiles(account_id,tin) VALUES
 ('recipientA','111111111111'),
 ('recipientB','222222222222'),
 ('recipientC','333333333333');
INSERT INTO demo_payment.story_payments(id,created_at,service_code,status,data) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-11-16 00:00:00+00','OTHER_TAX_PAYMENT','SIMULATED_SUCCESS',
  '{"origin":"TAXPAY_UI","details":{"payerId":"payer","receiptReference":"REF-2026-001","allocations":[{"allocationId":"al-A","taxpayerTin":"111111111111","headId":"10","assessmentYear":"2026-27","amountMinor":1000},{"allocationId":"al-B","taxpayerTin":"222222222222","headId":"20","assessmentYear":"2025-26","amountMinor":2000},{"allocationId":"al-C","taxpayerTin":"333333333333","headId":"30","assessmentYear":"2026-27","amountMinor":3000}]}}'::jsonb),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-11-16 01:00:00+00','OTHER_TAX_PAYMENT','SIMULATED_SUCCESS',
  '{"origin":"TAXPAY_UI","details":{"payerId":"recipientA","receiptReference":"REF-SELF","allocations":[{"allocationId":"al-self","taxpayerTin":"111111111111","headId":"10","assessmentYear":"2026-27","amountMinor":1000}]}}'::jsonb),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','2026-11-16 02:00:00+00','OTHER_TAX_PAYMENT','FAILED',
  '{"origin":"TAXPAY_UI","details":{"payerId":"payer","allocations":[{"allocationId":"al-fail","taxpayerTin":"111111111111","headId":"10","assessmentYear":"2026-27","amountMinor":9000}]}}'::jsonb),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','2026-11-16 03:00:00+00','OTHER_TAX_PAYMENT','SIMULATED_SUCCESS',
  '{"origin":"BACKOFFICE","details":{"payerId":"payer","allocations":[{"allocationId":"al-not-source","taxpayerTin":"111111111111","headId":"10","assessmentYear":"2026-27","amountMinor":9000}]}}'::jsonb);
COMMIT;
\i supabase/migrations/20261116070000_taxpay_verified_recipient_notices.sql
DO $test$
DECLARE
 v jsonb; evt text; ok boolean;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 v:=public.taxpay_account_received_payment_notices('unread');
 IF (v->>'total')::integer<>1 OR jsonb_array_length(v->'items')<>1 THEN
  RAISE EXCEPTION 'Owner A should see exactly one non-self eligible allocation: %',v; END IF;
 IF v->'items'->0->>'allocationId'<>'al-A' OR
    v->'items'->0->>'recipientTin' IS NOT NULL OR
    v->'items'->0->>'recordState'<>'RECORDED_NOT_CONFIRMED_TAX_CREDIT' THEN
   RAISE EXCEPTION 'Recipient allocation, masking or credit provenance mismatch: %',v; END IF;
 evt:=v->'items'->0->>'eventId';
 IF (public.taxpay_account_received_payment_notices('ack',evt)->>'isRead')::boolean IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Owner acknowledgment did not persist'; END IF;
 v:=public.taxpay_account_received_payment_notices('unread');
 IF (v->>'total')::integer<>0 THEN RAISE EXCEPTION 'Acknowledged notice not removed from unread list'; END IF;
 v:=public.taxpay_account_received_payment_notices('list');
 IF (v->>'total')::integer<>1 OR
    (v->'items'->0->>'isRead')::boolean IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Owner list does not retain read event'; END IF;
 PERFORM set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
 v:=public.taxpay_account_received_payment_notices('unread');
 IF (v->>'total')::integer<>1 OR v->'items'->0->>'allocationId'<>'al-B'
 THEN RAISE EXCEPTION 'Owner B should see only B, unaffected by A acknowledgment: %',v; END IF;
 ok:=false;
 BEGIN PERFORM public.taxpay_account_received_payment_notices('ack',evt);
 EXCEPTION WHEN SQLSTATE '42501' THEN ok:=true; END;
 IF NOT ok THEN RAISE EXCEPTION 'Cross-owner event ACK was accepted'; END IF;
 PERFORM set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
 v:=public.taxpay_account_received_payment_notices('unread');
 IF (v->>'total')::integer<>0 THEN RAISE EXCEPTION 'Unbound UID saw notice'; END IF;
 PERFORM set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
 ok:=false;
 BEGIN PERFORM public.taxpay_account_received_payment_notices('unread');
 EXCEPTION WHEN SQLSTATE '42501' THEN ok:=true; END;
 IF NOT ok THEN RAISE EXCEPTION 'Unconfirmed user was accepted'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 ok:=false;
 BEGIN PERFORM public.taxpay_account_received_payment_notices('unread');
 EXCEPTION WHEN SQLSTATE '42501' THEN ok:=true; END;
 IF NOT ok THEN RAISE EXCEPTION 'Unauthenticated request was accepted'; END IF;
 IF has_function_privilege('anon','public.taxpay_account_received_payment_notices(text,text,integer,integer)','EXECUTE')
    OR has_table_privilege('authenticated','taxpay_guest_private.account_received_payment_notice_ack','SELECT')
 THEN RAISE EXCEPTION 'Anonymous execution or direct ACK read granted'; END IF;
 RAISE NOTICE 'PASS: owner scope, unbound fail-close, read persistence, non-self records, provenance, account isolation and permissions';
END $test$;
