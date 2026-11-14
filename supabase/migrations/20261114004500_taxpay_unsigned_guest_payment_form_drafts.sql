-- Unsigned payment-form drafts: reuse the EXISTING opaque guest session.
-- No Auth identity, payment parent, receipt, certificate, or Office mirror is created.
BEGIN;

CREATE TABLE taxpay_guest_private.guest_payment_form_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES taxpay_guest_private.sessions(id) ON DELETE CASCADE,
  service text NOT NULL CHECK (service IN (
    'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
    'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX'
  )),
  form_payload jsonb NOT NULL
    CHECK (jsonb_typeof(form_payload) = 'object' AND octet_length(form_payload::text) <= 64000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 2147483646),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guest_payment_form_drafts_session_recent
  ON taxpay_guest_private.guest_payment_form_drafts (session_id,updated_at DESC,id);
ALTER TABLE taxpay_guest_private.guest_payment_form_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpay_guest_private.guest_payment_form_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON taxpay_guest_private.guest_payment_form_drafts
  FROM PUBLIC,anon,authenticated,service_role;

-- Trusted Edge service role only. The request body cannot choose a session or
-- owner: SHA-256 capability is derived from the EXISTING browser header.
CREATE FUNCTION public.taxpay_guest_payment_form_drafts(
  p_capability_hash text,p_action text,p_draft_id uuid DEFAULT NULL,
  p_service text DEFAULT NULL,p_payload jsonb DEFAULT NULL,
  p_revision integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, taxpay_guest_private
AS $draft$
DECLARE
  v_session uuid;
  v_row taxpay_guest_private.guest_payment_form_drafts%rowtype;
BEGIN
  IF p_capability_hash IS NULL OR p_capability_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_CAPABILITY';
  END IF;
  -- Applies the existing expiry, rotation and revocation lifecycle.
  v_session := taxpay_guest_private.touch_session(p_capability_hash);
  IF p_action = 'list' THEN
    RETURN coalesce((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.updated_at DESC,x.id)
      FROM (
        SELECT id,service,form_payload,revision,created_at,updated_at
        FROM taxpay_guest_private.guest_payment_form_drafts
        WHERE session_id=v_session AND (p_service IS NULL OR service=p_service)
        ORDER BY updated_at DESC,id LIMIT 100
      ) x
    ),'[]'::jsonb);
  ELSIF p_action = 'get' THEN
    SELECT * INTO v_row FROM taxpay_guest_private.guest_payment_form_drafts
      WHERE id=p_draft_id AND session_id=v_session;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_NOT_FOUND'; END IF;
  ELSIF p_action IN ('create','update') THEN
    IF p_service IS NULL OR p_service NOT IN (
      'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
      'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX'
    ) OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
      OR octet_length(p_payload::text)>64000 THEN
      RAISE EXCEPTION 'INVALID_DRAFT_PAYLOAD';
    END IF;
    IF p_action='create' THEN
      IF p_draft_id IS NOT NULL OR p_revision IS NOT NULL THEN
        RAISE EXCEPTION 'INVALID_DRAFT_PAYLOAD';
      END IF;
      INSERT INTO taxpay_guest_private.guest_payment_form_drafts
        (session_id,service,form_payload) VALUES (v_session,p_service,p_payload)
        RETURNING * INTO v_row;
    ELSE
      IF p_draft_id IS NULL OR p_revision IS NULL OR p_revision<1 THEN
        RAISE EXCEPTION 'DRAFT_CONFLICT';
      END IF;
      UPDATE taxpay_guest_private.guest_payment_form_drafts
        SET form_payload=p_payload,revision=revision+1,updated_at=now()
        WHERE id=p_draft_id AND session_id=v_session
          AND service=p_service AND revision=p_revision
          AND revision<2147483646
        RETURNING * INTO v_row;
      IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
    END IF;
  ELSIF p_action='delete' THEN
    IF p_draft_id IS NULL OR p_revision IS NULL OR p_revision<1 THEN
      RAISE EXCEPTION 'DRAFT_CONFLICT';
    END IF;
    DELETE FROM taxpay_guest_private.guest_payment_form_drafts
      WHERE id=p_draft_id AND session_id=v_session AND revision=p_revision
      RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
    RETURN jsonb_build_object('deleted',v_row.id);
  ELSE
    RAISE EXCEPTION 'INVALID_DRAFT_ACTION';
  END IF;
  RETURN jsonb_build_object('id',v_row.id,'service',v_row.service,
    'form_payload',v_row.form_payload,'revision',v_row.revision,
    'created_at',v_row.created_at,'updated_at',v_row.updated_at);
END;
$draft$;

REVOKE ALL ON FUNCTION public.taxpay_guest_payment_form_drafts(
  text,text,uuid,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_guest_payment_form_drafts(
  text,text,uuid,text,jsonb,integer) TO service_role;
COMMENT ON TABLE taxpay_guest_private.guest_payment_form_drafts IS
  'Unsigned session-scoped editable form state only; no payment, receipt or Office financial record.';
COMMIT;
