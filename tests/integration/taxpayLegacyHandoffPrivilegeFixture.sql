-- Disposable PG17 fixture ONLY. No connection to hosted Taxpayer or Office.
-- Reproduce the dangerous legacy grant shape: SECURITY DEFINER functions
-- executable by anon/authenticated and NOT by service_role.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE FUNCTION public.taxpay_v11_handoff_get(p_request_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$SELECT '{}'::jsonb$$;
CREATE FUNCTION public.taxpay_v11_handoff_history(p_session_id uuid,p_limit integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$SELECT '{}'::jsonb$$;
CREATE FUNCTION public.taxpay_v11_handoff_notice_read(
 p_session_id uuid,p_notice_id bigint,p_is_read boolean)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT true$$;
CREATE FUNCTION public.taxpay_v11_handoff_notifications(p_session_id uuid,p_limit integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$SELECT '{}'::jsonb$$;
CREATE FUNCTION public.taxpay_v11_handoff_submit(p_input jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$SELECT '{}'::jsonb$$;
CREATE FUNCTION public.taxpay_v11_handoff_summary(p_request_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$SELECT '{}'::jsonb$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon,authenticated;

DO $before$
DECLARE v_signature text; v_oid oid;
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
    IF v_oid IS NULL
       OR NOT has_function_privilege('anon',v_oid,'EXECUTE')
       OR NOT has_function_privilege('authenticated',v_oid,'EXECUTE')
       OR has_function_privilege('service_role',v_oid,'EXECUTE')
    THEN RAISE EXCEPTION 'Invalid baseline fixture grants on %',v_signature;
    END IF;
  END LOOP;
END;
$before$;
