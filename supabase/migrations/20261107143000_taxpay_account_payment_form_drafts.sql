-- Account-scoped payment-form drafts. These are NOT completed payments or tax credits.
-- Reuses existing Supabase Auth owner/RLS and the existing stable preview-profile capability.
-- Independently auditable; no destructive modification to existing planning drafts.
BEGIN;

CREATE TABLE IF NOT EXISTS public.taxpay_account_payment_form_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service text NOT NULL CHECK (service IN (
    'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
    'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX'
  )),
  form_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(form_payload) = 'object' AND octet_length(form_payload::text) <= 64000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 2147483646),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.taxpay_account_payment_form_drafts
  IS 'Unsubmitted application form state only. Never payment instructions, claims, receipts, or settlement.';
CREATE INDEX IF NOT EXISTS taxpay_account_form_drafts_owner_recent
  ON public.taxpay_account_payment_form_drafts (owner_uid, updated_at DESC);

ALTER TABLE public.taxpay_account_payment_form_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxpay_account_payment_form_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxpay_account_payment_form_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.taxpay_account_payment_form_drafts TO authenticated;
GRANT INSERT (owner_uid,service,form_payload) ON public.taxpay_account_payment_form_drafts TO authenticated;
GRANT UPDATE (form_payload) ON public.taxpay_account_payment_form_drafts TO authenticated;

CREATE POLICY taxpay_form_draft_select_own ON public.taxpay_account_payment_form_drafts
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_uid);
CREATE POLICY taxpay_form_draft_insert_own ON public.taxpay_account_payment_form_drafts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_uid);
CREATE POLICY taxpay_form_draft_update_own ON public.taxpay_account_payment_form_drafts
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = owner_uid)
  WITH CHECK ((SELECT auth.uid()) = owner_uid);
CREATE POLICY taxpay_form_draft_delete_own ON public.taxpay_account_payment_form_drafts
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = owner_uid);

CREATE OR REPLACE FUNCTION public.taxpay_account_form_draft_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $revision$
BEGIN
  IF NEW.owner_uid IS DISTINCT FROM OLD.owner_uid
     OR NEW.service IS DISTINCT FROM OLD.service
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'DRAFT_OWNER_OR_SERVICE_IMMUTABLE';
  END IF;
  NEW.revision := OLD.revision + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$revision$;
REVOKE ALL ON FUNCTION public.taxpay_account_form_draft_revision() FROM PUBLIC, anon;
CREATE TRIGGER taxpay_account_form_draft_revision_trigger
  BEFORE UPDATE ON public.taxpay_account_payment_form_drafts
  FOR EACH ROW EXECUTE FUNCTION public.taxpay_account_form_draft_revision();

-- Preview identities are deliberately separate from Supabase Auth and never receive
-- authenticated RLS access or other users' form drafts.
CREATE TABLE IF NOT EXISTS taxpay_guest_private.demo_payment_form_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id text NOT NULL REFERENCES taxpay_guest_private.demo_profiles(demo_id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS taxpay_demo_form_drafts_owner_recent
  ON taxpay_guest_private.demo_payment_form_drafts (demo_id, updated_at DESC);
ALTER TABLE taxpay_guest_private.demo_payment_form_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpay_guest_private.demo_payment_form_drafts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON taxpay_guest_private.demo_payment_form_drafts FROM PUBLIC,anon,authenticated;

-- This API is callable by the trusted Edge service_role ONLY. The Edge function
-- derives SHA-256 from the existing opaque capability header, not from user body JSON.
CREATE OR REPLACE FUNCTION public.taxpay_demo_payment_form_drafts(
  p_capability_hash text, p_action text, p_draft_id uuid DEFAULT NULL,
  p_service text DEFAULT NULL, p_payload jsonb DEFAULT NULL,
  p_revision integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, taxpay_guest_private, extensions
AS $draft$
DECLARE
  v_owner text;
  v_row taxpay_guest_private.demo_payment_form_drafts%rowtype;
  v_result jsonb;
BEGIN
  IF p_capability_hash IS NULL OR p_capability_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_CAPABILITY';
  END IF;
  -- Preserve existing session validity/revocation semantics.
  PERFORM taxpay_guest_private.touch_session(p_capability_hash);
  SELECT demo_id INTO v_owner
    FROM taxpay_guest_private.demo_profiles
    WHERE encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex') = p_capability_hash;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'INVALID_CAPABILITY'; END IF;

  IF p_action = 'list' THEN
    RETURN COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.updated_at DESC, t.id)
      FROM (
        SELECT id, service, form_payload, revision, created_at, updated_at
        FROM taxpay_guest_private.demo_payment_form_drafts
        WHERE demo_id = v_owner
          AND (p_service IS NULL OR service = p_service)
        ORDER BY updated_at DESC, id LIMIT 100
      ) t
    ), '[]'::jsonb);
  ELSIF p_action = 'get' THEN
    SELECT * INTO v_row FROM taxpay_guest_private.demo_payment_form_drafts
      WHERE id = p_draft_id AND demo_id = v_owner;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_NOT_FOUND'; END IF;
    RETURN jsonb_build_object('id',v_row.id,'service',v_row.service,
      'form_payload',v_row.form_payload,'revision',v_row.revision,
      'created_at',v_row.created_at,'updated_at',v_row.updated_at);
  ELSIF p_action IN ('create','update') THEN
    IF p_service IS NULL OR p_service NOT IN (
      'TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
      'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT','TRAVEL_TAX'
    ) OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
      OR octet_length(p_payload::text) > 64000 THEN
      RAISE EXCEPTION 'INVALID_DRAFT_PAYLOAD';
    END IF;
    IF p_action = 'create' THEN
      INSERT INTO taxpay_guest_private.demo_payment_form_drafts
        (demo_id,service,form_payload) VALUES (v_owner,p_service,p_payload)
        RETURNING * INTO v_row;
    ELSE
      IF p_draft_id IS NULL OR p_revision IS NULL OR p_revision < 1 THEN
        RAISE EXCEPTION 'DRAFT_CONFLICT';
      END IF;
      UPDATE taxpay_guest_private.demo_payment_form_drafts
        SET form_payload = p_payload, revision = revision + 1, updated_at = now()
        WHERE id = p_draft_id AND demo_id = v_owner
          AND service = p_service AND revision = p_revision
        RETURNING * INTO v_row;
      IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
    END IF;
    RETURN jsonb_build_object('id',v_row.id,'service',v_row.service,
      'form_payload',v_row.form_payload,'revision',v_row.revision,
      'created_at',v_row.created_at,'updated_at',v_row.updated_at);
  ELSIF p_action = 'delete' THEN
    IF p_draft_id IS NULL OR p_revision IS NULL THEN
      RAISE EXCEPTION 'DRAFT_CONFLICT';
    END IF;
    DELETE FROM taxpay_guest_private.demo_payment_form_drafts
      WHERE demo_id = v_owner AND id = p_draft_id AND revision = p_revision
      RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
    RETURN jsonb_build_object('deleted',v_row.id);
  ELSE
    RAISE EXCEPTION 'INVALID_DRAFT_ACTION';
  END IF;
END;
$draft$;
REVOKE ALL ON FUNCTION public.taxpay_demo_payment_form_drafts(text,text,uuid,text,jsonb,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_demo_payment_form_drafts(text,text,uuid,text,jsonb,integer)
  TO service_role;

COMMIT;
