-- Restrict synthetic Office handoff RPCs when installed in the hosted project.
-- Local disposable Supabase omits these historical prototype-only functions.
-- The migration must not break local Auth/RLS/payment tests on an absent RPC.
-- Public guest submission, history and notices keep their existing grants.
DO $restrict_office_handoff$
DECLARE
  signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.taxpay_v11_handoff_office_inbox(integer)',
    'public.taxpay_v11_handoff_office_action(uuid,text,text,text,text,uuid)',
    'public.taxpay_v11_handoff_finish(uuid,text,text,uuid)'
  ] LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || signature
        || ' FROM PUBLIC, anon, authenticated';
      EXECUTE 'GRANT EXECUTE ON FUNCTION ' || signature
        || ' TO service_role';
    END IF;
  END LOOP;
END;
$restrict_office_handoff$;
