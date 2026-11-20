-- Run after applying the WS3 historical-handoff privilege migration
-- in an isolated PostgreSQL 17 fixture, then separately as read-only
-- verification in Original and V2 after WS5's protected migration.
-- No user data, transactions, Auth or Office tables are touched.
DO $acceptance$
DECLARE
  v_signature text;
  v_oid oid;
  v_role text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.taxpay_v11_handoff_get(uuid)',
    'public.taxpay_v11_handoff_history(uuid,integer)',
    'public.taxpay_v11_handoff_notice_read(uuid,bigint,boolean)',
    'public.taxpay_v11_handoff_notifications(uuid,integer)',
    'public.taxpay_v11_handoff_submit(jsonb)',
    'public.taxpay_v11_handoff_summary(uuid)'
  ] LOOP
    v_oid := to_regprocedure(v_signature)::oid;
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'Missing expected RPC: %',v_signature;
    END IF;
    IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid=v_oid) THEN
      RAISE EXCEPTION 'Unexpected handoff security mode: %',v_signature;
    END IF;

    FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_function_privilege(v_role,v_oid,'EXECUTE') THEN
        RAISE EXCEPTION 'PUBLIC_HANDOFF_RPC_EXECUTION_EXPOSED: % by %',
          v_signature,v_role;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('service_role',v_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'SERVER_HANDOFF_RPC_EXECUTION_MISSING: %',v_signature;
    END IF;
  END LOOP;
END;
$acceptance$;

-- Verify service_role retains the protected server-only call route in the
-- isolated fixture. Do not execute any function with production identifiers.
SET ROLE service_role;
SELECT public.taxpay_v11_handoff_get('00000000-0000-0000-0000-000000000000'::uuid);
RESET ROLE;
