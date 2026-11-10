-- SECURITY: A browser-provided payment session is not proof of account ownership.
-- Reuse the existing, approver-verified sim_payment_account_bindings rather than
-- inventing another authentication or identity link. Historical rows remain intact.
CREATE OR REPLACE FUNCTION public.taxpay_claim_story1_session(p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $taxpay_verified_claim$
DECLARE
  v_uid uuid := auth.uid();
  v_demo_id text;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL OR p_session_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATED_SESSION_REQUIRED';
  END IF;

  -- Auth identity alone, a TIN, or knowledge of a session UUID never conveys
  -- entitlement. The existing profile-to-account link is assigned by an
  -- authorized approver to an email-confirmed Auth account.
  SELECT b.user_id INTO v_demo_id
  FROM public.sim_payment_account_bindings b
  JOIN taxpay_guest_private.demo_profiles profile
    ON profile.demo_id = b.user_id
   AND profile.payment_session_id = p_session_id
  WHERE b.owner_uid = v_uid;

  IF v_demo_id IS NULL THEN
    -- Unlinked/guest sessions cannot be claimed by a signed-in account. Keep
    -- history reads usable for accounts with no eligible records, and never
    -- change or reassign an existing ownership link.
    RETURN 0;
  END IF;

  -- Existing synthetic fixture history can share one session UUID across
  -- different payers. Never claim those unrelated rows, but do not make a
  -- legitimate owner's matching payments inaccessible because they exist.
  -- Exact per-row payer and origin checks below are the security boundary.

  INSERT INTO public.taxpay_story1_payment_owners(payment_id, owner_uid)
  SELECT payment.id, v_uid
  FROM demo_payment.story_payments payment
  WHERE payment.session_id = p_session_id
    AND payment.status = 'SIMULATED_SUCCESS'
    AND payment.data->>'origin' = 'TAXPAY_UI'
    AND payment.data->'details'->>'payerId' = v_demo_id
  ON CONFLICT (payment_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$taxpay_verified_claim$;

-- Keep the existing authenticated caller contract, but remove anonymous RPC
-- execution that has no valid account ownership use case.
REVOKE ALL ON FUNCTION public.taxpay_claim_story1_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.taxpay_claim_story1_session(uuid) TO authenticated;
