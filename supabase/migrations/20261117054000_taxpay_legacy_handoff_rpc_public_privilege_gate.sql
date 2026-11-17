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

DO $restrict_historical_handoff$
DECLARE
  v_signature text;
  v_present integer := 0;
  v_expected constant text[] := ARRAY[
    'public.taxpay_v11_handoff_get(uuid)',
    'public.taxpay_v11_handoff_history(uuid,integer)',
    'public.taxpay_v11_handoff_notice_read(uuid,bigint,boolean)',
    'public.taxpay_v11_handoff_notifications(uuid,integer)',
    'public.taxpay_v11_handoff_submit(jsonb)',
    'public.taxpay_v11_handoff_summary(uuid)'
  ];
BEGIN
  -- A clean disposable Supabase project never installed the historical v11
  -- synthetic handoff. Do not manufacture obsolete functions or users.
  -- Existing Original/V2 production projects have all six and must be locked.
  FOREACH v_signature IN ARRAY v_expected LOOP
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      v_present := v_present + 1;
    END IF;
  END LOOP;

  IF v_present = 0 THEN
    RAISE NOTICE 'LEGACY_HANDOFF_NOT_INSTALLED: no public RPCs to restrict';
  ELSIF v_present <> array_length(v_expected,1) THEN
    -- A partial legacy contract means drift. Never grant or revoke against a
    -- guessed schema; stop the release before touching any existing function.
    RAISE EXCEPTION 'LEGACY_HANDOFF_PARTIAL_CONTRACT: % of % RPCs installed',
      v_present, array_length(v_expected,1);
  ELSE
    -- All signatures below are fixed internal literals, never user input.
    FOREACH v_signature IN ARRAY v_expected LOOP
      EXECUTE format(
        'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO service_role', v_signature);
    END LOOP;
  END IF;
END;
$restrict_historical_handoff$;

COMMIT;
