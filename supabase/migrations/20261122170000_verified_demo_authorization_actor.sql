-- P0: fictional demo consent must be bound to the same server-issued
-- short-lived session capability used by preview profile/beneficiary SQL.
-- Never trust a userN actor query string or client-selected identity.
-- Real Supabase Auth/financial payment rules are unchanged.
CREATE OR REPLACE FUNCTION public.taxpay_demo_authorization_actor(
  p_capability_hash text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $auth$
DECLARE v_actor text;
BEGIN
  IF p_capability_hash IS NULL OR
     p_capability_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_PROFILE_CAPABILITY';
  END IF;
  -- Enforce the live session expiration/revocation contract; a detached hash
  -- or an arbitrarily selected actor never authorizes an inbox or transition.
  PERFORM taxpay_guest_private.touch_session(p_capability_hash);
  SELECT p.demo_id INTO v_actor
  FROM taxpay_guest_private.demo_profiles p
  WHERE encode(extensions.digest(pg_catalog.convert_to(p.capability_token,'UTF8'),'sha256'),'hex')
    = p_capability_hash;
  IF v_actor IS NULL OR v_actor !~ '^user([1-9]|[12][0-9]|30)$' THEN
    RAISE EXCEPTION 'INVALID_DEMO_AUTHORIZATION_ACTOR';
  END IF;
  RETURN v_actor;
END;
$auth$;
REVOKE ALL ON FUNCTION public.taxpay_demo_authorization_actor(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_demo_authorization_actor(text)
  TO service_role;

-- Old direct PostgREST RPCs expose consent codes and allow an unauthenticated
-- caller to impersonate any chosen fictional actor. All access now enters
-- through the Edge's verified actor/session proof, then service-role SQL.
REVOKE ALL ON FUNCTION public.demo_auth_list(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_auth_list(text) TO service_role;
REVOKE ALL ON FUNCTION public.demo_auth_transition(text,text,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_auth_transition(text,text,uuid,text,text)
  TO service_role;

-- Preserve the existing 30 approved selectable UI demo actors. The 55-row
-- SQL simulation fixture is a separate catalog, not implicit authorization.
-- Preserve public.demo_auth_can_pay internal SQL checks and Office signed proof.
