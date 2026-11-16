-- WS3 / P1: authorization snapshots are internal Taxpayer->Office mirror
-- readbacks. A UUID alone never confers an authorization or identity right.
-- All existing guest authorization entry/confirmation paths stay unchanged.
BEGIN;
DO $authorization_snapshot_exists$
BEGIN
  IF to_regprocedure('public.demo_auth_public_snapshot(uuid)') IS NULL THEN
    RAISE EXCEPTION 'AUTHORIZATION_SNAPSHOT_RPC_MISSING';
  END IF;
END;
$authorization_snapshot_exists$;

REVOKE ALL ON FUNCTION public.demo_auth_public_snapshot(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_auth_public_snapshot(uuid)
  TO service_role;

DO $authorization_snapshot_private$
BEGIN
  IF has_function_privilege('anon',
       'public.demo_auth_public_snapshot(uuid)','EXECUTE')
     OR has_function_privilege('authenticated',
       'public.demo_auth_public_snapshot(uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.demo_auth_public_snapshot(uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'AUTHORIZATION_SNAPSHOT_MUST_BE_SERVICE_ONLY'; END IF;
END;
$authorization_snapshot_private$;
COMMIT;
