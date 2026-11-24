-- Disposable test: actor lookup is bound to a freshly opened demo-profile
-- session, not the client-provided user ID or the public PostgREST role.
BEGIN;
DO $test$
DECLARE
  v_hash text;
  v_bad boolean := false;
BEGIN
  IF has_function_privilege('anon','public.demo_auth_list(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.demo_auth_list(text)','EXECUTE')
    OR has_function_privilege('anon','public.demo_auth_transition(text,text,uuid,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.demo_auth_transition(text,text,uuid,text,text)','EXECUTE')
    OR has_function_privilege('anon','public.taxpay_demo_authorization_actor(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.taxpay_demo_authorization_actor(text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'PUBLIC_DEMO_CONSENT_RPC_STILL_EXPOSED';
  END IF;
  IF NOT has_function_privilege('service_role','public.demo_auth_list(text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.demo_auth_transition(text,text,uuid,text,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.taxpay_demo_authorization_actor(text)','EXECUTE')
  THEN
    RAISE EXCEPTION 'EDGE_SERVICE_ROLE_LOST_DEMO_CONSENT_ACCESS';
  END IF;
  PERFORM public.taxpay_demo_profile_login('user1','user1');
  SELECT encode(extensions.digest(pg_catalog.convert_to(p.capability_token,'UTF8'),'sha256'),'hex')
    INTO v_hash FROM taxpay_guest_private.demo_profiles p WHERE p.demo_id='user1';
  IF public.taxpay_demo_authorization_actor(v_hash) <> 'user1' THEN
    RAISE EXCEPTION 'CAPABILITY_NOT_BOUND_TO_VERIFIED_DEMO_ACTOR';
  END IF;
  BEGIN
    PERFORM public.taxpay_demo_authorization_actor(repeat('0',64));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%INVALID_CAPABILITY%' OR SQLERRM LIKE '%INVALID_DEMO_PROFILE%' OR
       SQLERRM LIKE '%GUEST_SESSION_UNAVAILABLE%' THEN
      v_bad:=true;
    ELSE RAISE; END IF;
  END;
  IF NOT v_bad THEN RAISE EXCEPTION 'FORGED_CAPABILITY_ACCEPTED'; END IF;
  RAISE NOTICE 'PASS: active capability required; spoofed actor and public consent SQL RPC barred';
END $test$;
ROLLBACK;
