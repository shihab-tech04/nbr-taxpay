-- WS3 / simulation-only security boundary: retire public direct execution of
-- historical v11 handoff RPCs. These SECURITY DEFINER routines accept only a
-- caller-supplied request/session UUID and do not authenticate an owner.
-- The current authorized Story1 guest/payment Edge route is a different API.
-- No payment rows, user accounts, RLS policies, triggers or Office database
-- objects are changed. Apply through protected WS5 release after backups.
--
-- Positive server-side compatibility: explicitly retain service_role EXECUTE,
-- so a future authenticated server adapter can call these routines without
-- exposing them through the browser's publishable key.
--
-- Rollback only after an approved replacement caller-authorization design;
-- do NOT blindly restore public EXECUTE in production.
BEGIN;

DO $preflight$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.taxpay_v11_handoff_get(uuid)',
    'public.taxpay_v11_handoff_history(uuid,integer)',
    'public.taxpay_v11_handoff_notice_read(uuid,bigint,boolean)',
    'public.taxpay_v11_handoff_notifications(uuid,integer)',
    'public.taxpay_v11_handoff_submit(jsonb)',
    'public.taxpay_v11_handoff_summary(uuid)'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NULL THEN
      RAISE EXCEPTION 'LEGACY_HANDOFF_RPC_CONTRACT_MISSING: %', v_signature;
    END IF;
  END LOOP;
END;
$preflight$;

REVOKE ALL ON FUNCTION public.taxpay_v11_handoff_get(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.taxpay_v11_handoff_history(uuid,integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.taxpay_v11_handoff_notice_read(uuid,bigint,boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.taxpay_v11_handoff_notifications(uuid,integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.taxpay_v11_handoff_submit(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.taxpay_v11_handoff_summary(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.taxpay_v11_handoff_get(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_v11_handoff_history(uuid,integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_v11_handoff_notice_read(uuid,bigint,boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_v11_handoff_notifications(uuid,integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_v11_handoff_submit(jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_v11_handoff_summary(uuid)
  TO service_role;

COMMIT;
