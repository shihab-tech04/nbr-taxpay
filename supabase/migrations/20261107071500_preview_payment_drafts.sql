-- Account-scoped editable preview drafts; separate from real Auth drafts, payments and receipts.
-- Apply with the authorized migration workflow after disposable tests and one pre-release backup.
BEGIN;

CREATE TABLE taxpay_guest_private.preview_payment_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_demo_id text NOT NULL REFERENCES taxpay_guest_private.demo_profiles(demo_id) ON DELETE CASCADE,
  journey text NOT NULL CHECK (journey IN ('guest_payment','travel_tax')),
  form_state jsonb NOT NULL CHECK (jsonb_typeof(form_state) = 'object' AND octet_length(form_state::text) <= 16384 AND form_state->>'schema' = '1' AND form_state->>'journey' = journey),
  version integer NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 2147483647),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX preview_payment_drafts_owner_updated_idx
  ON taxpay_guest_private.preview_payment_drafts(owner_demo_id,updated_at DESC,id);
ALTER TABLE taxpay_guest_private.preview_payment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpay_guest_private.preview_payment_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON taxpay_guest_private.preview_payment_drafts FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE taxpay_guest_private.preview_payment_drafts IS
  'Private fictional account form progress. Not a payment, challan, tax credit or treasury record.';

-- Only the existing trusted Edge gateway may invoke this capability-checked RPC.
CREATE FUNCTION public.taxpay_demo_payment_drafts(
  p_capability_hash text,
  p_action text,
  p_draft_id uuid DEFAULT NULL,
  p_journey text DEFAULT NULL,
  p_form_state jsonb DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, taxpay_guest_private, extensions
AS $function$
DECLARE
  v_demo_id text;
  v_row taxpay_guest_private.preview_payment_drafts%ROWTYPE;
  v_result jsonb;
  v_allowed_keys text[];
BEGIN
  IF p_capability_hash IS NULL OR p_capability_hash !~ '^[0-9a-f]{64}$'
    THEN RAISE EXCEPTION 'INVALID_CAPABILITY'; END IF;

  -- Existing session authority: no client-provided demo ID can select a draft owner.
  PERFORM taxpay_guest_private.touch_session(p_capability_hash);
  SELECT demo_id INTO v_demo_id
    FROM taxpay_guest_private.demo_profiles
    WHERE encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex') = p_capability_hash
    FOR UPDATE;
  IF v_demo_id IS NULL THEN RAISE EXCEPTION 'INVALID_CAPABILITY'; END IF;

  IF p_action = 'list' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',id,'journey',journey,'category',COALESCE(form_state->>'category','TRAVEL_TAX'),
      'step',form_state->'step','version',version,'updatedAt',updated_at
    ) ORDER BY updated_at DESC,id), '[]'::jsonb) INTO v_result
    FROM taxpay_guest_private.preview_payment_drafts
    WHERE owner_demo_id=v_demo_id;
    RETURN v_result;
  END IF;

  IF p_action='get' THEN
    SELECT * INTO v_row FROM taxpay_guest_private.preview_payment_drafts
      WHERE id=p_draft_id AND owner_demo_id=v_demo_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_NOT_FOUND'; END IF;
    RETURN jsonb_build_object('id',v_row.id,'journey',v_row.journey,
      'formState',v_row.form_state,'version',v_row.version,'updatedAt',v_row.updated_at);
  END IF;

  IF p_action IN ('create','update') THEN
    IF p_journey NOT IN ('guest_payment','travel_tax')
      OR p_form_state IS NULL OR jsonb_typeof(p_form_state) IS DISTINCT FROM 'object'
      OR octet_length(p_form_state::text) > 16384
      OR p_form_state->>'schema' IS DISTINCT FROM '1'
      OR p_form_state->>'journey' IS DISTINCT FROM p_journey
    THEN RAISE EXCEPTION 'INVALID_DRAFT_STATE'; END IF;
    v_allowed_keys := CASE p_journey
      WHEN 'guest_payment' THEN ARRAY[
        'schema','journey','step','forSelf','tin','payerName','otherTaxpayerName',
        'additionalTaxpayers','otherTaxLines','phone','receiptEmail','assessmentYear',
        'noticeReference','incomeTaxType','category','selectedHeadIds','amountInputs',
        'paymentChannel','methodGroup','paymentMethod'
      ]
      ELSE ARRAY[
        'schema','journey','step','mode','port','waterPort','destination','travelDate',
        'passengers','phone','paymentChannel','methodGroup','paymentMethod'
      ] END;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_form_state) AS k
               WHERE NOT(k = ANY(v_allowed_keys)))
      OR (p_form_state->>'step') !~ '^[0123]
  END IF;

  IF p_action='create' THEN
    IF p_draft_id IS NOT NULL OR p_expected_version IS NOT NULL
      THEN RAISE EXCEPTION 'INVALID_DRAFT_REQUEST'; END IF;
    IF (SELECT count(*) FROM taxpay_guest_private.preview_payment_drafts
        WHERE owner_demo_id=v_demo_id) >= 30
      THEN RAISE EXCEPTION 'DRAFT_LIMIT_REACHED'; END IF;
    INSERT INTO taxpay_guest_private.preview_payment_drafts
      (owner_demo_id,journey,form_state)
      VALUES (v_demo_id,p_journey,p_form_state)
      RETURNING * INTO v_row;
  ELSIF p_action='update' THEN
    IF p_draft_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1
      THEN RAISE EXCEPTION 'INVALID_DRAFT_REQUEST'; END IF;
    UPDATE taxpay_guest_private.preview_payment_drafts
      SET form_state=p_form_state, version=version+1,updated_at=now()
      WHERE id=p_draft_id AND owner_demo_id=v_demo_id AND version=p_expected_version
        AND version<2147483647
      RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
  ELSIF p_action='delete' THEN
    IF p_draft_id IS NULL OR p_expected_version IS NULL
      THEN RAISE EXCEPTION 'INVALID_DRAFT_REQUEST'; END IF;
    DELETE FROM taxpay_guest_private.preview_payment_drafts
      WHERE id=p_draft_id AND owner_demo_id=v_demo_id AND version=p_expected_version
      RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
    RETURN jsonb_build_object('id',v_row.id,'deleted',true);
  ELSE
    RAISE EXCEPTION 'INVALID_DRAFT_REQUEST';
  END IF;

  RETURN jsonb_build_object('id',v_row.id,'journey',v_row.journey,
    'formState',v_row.form_state,'version',v_row.version,'updatedAt',v_row.updated_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.taxpay_demo_payment_drafts(text,text,uuid,text,jsonb,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_demo_payment_drafts(text,text,uuid,text,jsonb,integer)
  TO service_role;
COMMIT;

      OR jsonb_typeof(p_form_state->'step') IS DISTINCT FROM 'number'
      OR (p_journey='guest_payment' AND (p_form_state->>'step') NOT IN ('1','2','3'))
      OR (p_journey='travel_tax' AND jsonb_typeof(p_form_state->'passengers') IS DISTINCT FROM 'array')
    THEN RAISE EXCEPTION 'INVALID_DRAFT_STATE'; END IF;
  END IF;

  IF p_action='create' THEN
    IF p_draft_id IS NOT NULL OR p_expected_version IS NOT NULL
      THEN RAISE EXCEPTION 'INVALID_DRAFT_REQUEST'; END IF;
    IF (SELECT count(*) FROM taxpay_guest_private.preview_payment_drafts
        WHERE owner_demo_id=v_demo_id) >= 30
      THEN RAISE EXCEPTION 'DRAFT_LIMIT_REACHED'; END IF;
    INSERT INTO taxpay_guest_private.preview_payment_drafts
      (owner_demo_id,journey,form_state)
      VALUES (v_demo_id,p_journey,p_form_state)
      RETURNING * INTO v_row;
  ELSIF p_action='update' THEN
    IF p_draft_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 1
      THEN RAISE EXCEPTION 'INVALID_DRAFT_REQUEST'; END IF;
    UPDATE taxpay_guest_private.preview_payment_drafts
      SET form_state=p_form_state, version=version+1,updated_at=now()
      WHERE id=p_draft_id AND owner_demo_id=v_demo_id AND version=p_expected_version
        AND version<2147483647
      RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
  ELSIF p_action='delete' THEN
    IF p_draft_id IS NULL OR p_expected_version IS NULL
      THEN RAISE EXCEPTION 'INVALID_DRAFT_REQUEST'; END IF;
    DELETE FROM taxpay_guest_private.preview_payment_drafts
      WHERE id=p_draft_id AND owner_demo_id=v_demo_id AND version=p_expected_version
      RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
    RETURN jsonb_build_object('id',v_row.id,'deleted',true);
  ELSE
    RAISE EXCEPTION 'INVALID_DRAFT_REQUEST';
  END IF;

  RETURN jsonb_build_object('id',v_row.id,'journey',v_row.journey,
    'formState',v_row.form_state,'version',v_row.version,'updatedAt',v_row.updated_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.taxpay_demo_payment_drafts(text,text,uuid,text,jsonb,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_demo_payment_drafts(text,text,uuid,text,jsonb,integer)
  TO service_role;
COMMIT;
