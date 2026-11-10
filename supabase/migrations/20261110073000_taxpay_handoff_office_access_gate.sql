-- Secure synthetic Office handoff surfaces against anonymous impersonation.
-- Existing public guest submit, history, summary and notices stay unchanged.
-- These three RPCs may only be invoked by a verified backend until the
-- cross-project Office identity/role contract is implemented and tested.
-- Do not grant EXECUTE back to anon/authenticated to make an API 403 disappear.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.taxpay_v11_handoff_office_inbox(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.taxpay_v11_handoff_office_action(uuid,text,text,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.taxpay_v11_handoff_finish(uuid,text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_v11_handoff_office_inbox(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_v11_handoff_office_action(uuid,text,text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_v11_handoff_finish(uuid,text,text,uuid) TO service_role;
COMMIT;
