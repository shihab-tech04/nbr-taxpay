-- Rollback-only SQL acceptance for signed-in form-draft persistence.
-- Runs in disposable local Supabase only. Nothing in production is modified.
BEGIN;

DO $draft$
DECLARE
  a jsonb;
  b jsonb;
  hash_a text;
  hash_b text;
  created jsonb;
  updated jsonb;
  restored jsonb;
  listed jsonb;
  id uuid;
  before_count integer;
BEGIN
  IF has_table_privilege('anon', 'public.taxpay_account_payment_form_drafts', 'SELECT')
     OR has_table_privilege('anon', 'public.taxpay_account_payment_form_drafts', 'INSERT')
     OR has_table_privilege('anon', 'taxpay_guest_private.demo_payment_form_drafts', 'SELECT')
     OR has_function_privilege('anon',
          'public.taxpay_demo_payment_form_drafts(text,text,uuid,text,jsonb,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated',
          'public.taxpay_demo_payment_form_drafts(text,text,uuid,text,jsonb,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role',
          'public.taxpay_demo_payment_form_drafts(text,text,uuid,text,jsonb,integer)', 'EXECUTE')
     OR (SELECT count(*) FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'taxpay_account_payment_form_drafts') <> 4
  THEN
    RAISE EXCEPTION 'Draft service exposure or Auth RLS policy contract was weakened';
  END IF;

  a := public.taxpay_demo_profile_login('user9', 'user9');
  b := public.taxpay_demo_profile_login('user10', 'user10');
  hash_a := encode(extensions.digest(convert_to(a->>'capability','UTF8'),'sha256'),'hex');
  hash_b := encode(extensions.digest(convert_to(b->>'capability','UTF8'),'sha256'),'hex');
  IF hash_a = hash_b THEN RAISE EXCEPTION 'Two preview accounts share the same capability'; END IF;

  created := public.taxpay_demo_payment_form_drafts(
    hash_a, 'create', NULL, 'TRAVEL_TAX',
    '{"schemaVersion":1,"step":1,"mode":"LAND","port":"Benapole","destination":"India","travelDate":"","phone":"01700000000","passengers":[{"id":"first","name":"Rollback only","passport":"","birthDate":"1992-04-18","nationality":"BD"},{"id":"second","name":"Rollback passenger two","passport":"","birthDate":"1988-11-10","nationality":"BD"}]}'::jsonb,
    NULL
  );
  id := (created->>'id')::uuid;
  IF id IS NULL OR created->>'service' <> 'TRAVEL_TAX'
     OR (created->>'revision')::integer <> 1
     OR created->'form_payload'->>'step' <> '1'
     OR created->'form_payload'->>'mode' <> 'LAND'
     OR created->'form_payload'->>'port' <> 'Benapole'
     OR created->'form_payload'->>'destination' <> 'India'
     OR jsonb_array_length(created->'form_payload'->'passengers') <> 2
     OR created->'form_payload'->'passengers'->1->>'name' <> 'Rollback passenger two' THEN
    RAISE EXCEPTION 'Travel Tax draft did not preserve exact safe step, route and passenger list';
  END IF;

  restored := public.taxpay_demo_payment_form_drafts(hash_a, 'get', id);
  IF restored IS DISTINCT FROM created THEN
    RAISE EXCEPTION 'Preview draft could not be rehydrated by a new same-owner request';
  END IF;

  listed := public.taxpay_demo_payment_form_drafts(hash_b, 'list', NULL, 'TRAVEL_TAX');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(listed) item(value)
      WHERE item.value->>'id' = id::text) THEN
    RAISE EXCEPTION 'Other preview account read another owner draft';
  END IF;

  BEGIN
    PERFORM public.taxpay_demo_payment_form_drafts(hash_b, 'get', id);
    RAISE EXCEPTION 'Cross-account draft read succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%DRAFT_NOT_FOUND%' THEN RAISE; END IF;
  END;

  updated := public.taxpay_demo_payment_form_drafts(
    hash_a,'update',id,'TRAVEL_TAX',
    '{"schemaVersion":1,"passengers":[{"name":"Rollback changed","passport":""}]}'::jsonb,1
  );
  IF (updated->>'revision')::integer <> 2
     OR updated->'form_payload'->'passengers'->0->>'name' <> 'Rollback changed'
  THEN RAISE EXCEPTION 'Draft update or optimistic revision failed'; END IF;

  BEGIN
    PERFORM public.taxpay_demo_payment_form_drafts(
      hash_a,'update',id,'TRAVEL_TAX','{"schemaVersion":1}'::jsonb,1
    );
    RAISE EXCEPTION 'Stale draft overwrite succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%DRAFT_CONFLICT%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.taxpay_demo_payment_form_drafts(hash_b,'delete',id,NULL,NULL,2);
    RAISE EXCEPTION 'Cross-account draft deletion succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%DRAFT_CONFLICT%' THEN RAISE; END IF;
  END;

  restored := public.taxpay_demo_payment_form_drafts(hash_a,'get',id);
  IF restored->>'id' IS DISTINCT FROM id::text
     OR restored->'form_payload'->'passengers'->0->>'name' <> 'Rollback changed'
  THEN RAISE EXCEPTION 'Cross-account attempt damaged owner draft'; END IF;

  restored := public.taxpay_demo_payment_form_drafts(hash_a,'delete',id,NULL,NULL,2);
  IF restored->>'deleted' IS DISTINCT FROM id::text THEN
    RAISE EXCEPTION 'Owner delete was not acknowledged';
  END IF;

  listed := public.taxpay_demo_payment_form_drafts(hash_a,'list',NULL,'TRAVEL_TAX');
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(listed) item(value)
      WHERE item.value->>'id' = id::text) THEN
    RAISE EXCEPTION 'Deleted draft remained visible';
  END IF;
  RAISE NOTICE 'PASS: owner-scoped create, read, list, conflict, update, delete and other-account isolation';
END $draft$;

-- Auth-backed signed-in draft acceptance. This uses disposable synthetic Auth users
-- and exercises the table's actual RLS and revision trigger under authenticated role.
-- It does not create a payment/receipt and rolls back with the preview checks above.
INSERT INTO auth.users(id,instance_id,aud,role,email,email_confirmed_at,created_at,updated_at)
VALUES
 ('86000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','draft-owner-a@example.invalid',now(),now(),now()),
 ('86000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','draft-owner-b@example.invalid',now(),now(),now());

CREATE TEMP TABLE auth_draft_fixture (id uuid NOT NULL, owner_a uuid NOT NULL, owner_b uuid NOT NULL)
  ON COMMIT DROP;
CREATE TEMP TABLE auth_draft_payment_count (row_count bigint NOT NULL) ON COMMIT DROP;
INSERT INTO auth_draft_payment_count SELECT count(*) FROM public.sim_payment_transactions;
GRANT SELECT,INSERT ON auth_draft_fixture TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','86000000-0000-4000-8000-000000000001',true);
WITH inserted AS (
  INSERT INTO public.taxpay_account_payment_form_drafts(owner_uid,service,form_payload)
  VALUES(
    '86000000-0000-4000-8000-000000000001','OTHER_TAX_PAYMENT',
    '{"schemaVersion":1,"paymentHead":"68A","amount":"1250","assessmentYear":"2026-27"}'::jsonb
  )
  RETURNING id
)
INSERT INTO auth_draft_fixture(id,owner_a,owner_b)
SELECT id,'86000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000002'
FROM inserted;

DO $auth_draft_owner$
DECLARE
  v_id uuid;
  v_revision integer;
  v_payload jsonb;
  v_rows integer;
BEGIN
  SELECT id INTO v_id FROM auth_draft_fixture;
  SELECT revision,form_payload INTO v_revision,v_payload
    FROM public.taxpay_account_payment_form_drafts WHERE id=v_id;
  IF v_revision IS DISTINCT FROM 1
     OR v_payload IS DISTINCT FROM '{"schemaVersion":1,"paymentHead":"68A","amount":"1250","assessmentYear":"2026-27"}'::jsonb
  THEN RAISE EXCEPTION 'SIGNED_IN_DRAFT_CREATE_READBACK_MISMATCH'; END IF;

  UPDATE public.taxpay_account_payment_form_drafts
    SET form_payload='{"schemaVersion":1,"paymentHead":"68B","amount":"1500","assessmentYear":"2026-27"}'::jsonb
    WHERE id=v_id AND revision=1;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'SIGNED_IN_DRAFT_OWNER_UPDATE_FAILED'; END IF;

  UPDATE public.taxpay_account_payment_form_drafts
    SET form_payload='{"schemaVersion":1,"paymentHead":"STALE"}'::jsonb
    WHERE id=v_id AND revision=1;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'SIGNED_IN_DRAFT_STALE_REVISION_OVERWROTE_OWNER'; END IF;

  SELECT revision,form_payload INTO v_revision,v_payload
    FROM public.taxpay_account_payment_form_drafts WHERE id=v_id;
  IF v_revision IS DISTINCT FROM 2
     OR v_payload IS DISTINCT FROM '{"schemaVersion":1,"paymentHead":"68B","amount":"1500","assessmentYear":"2026-27"}'::jsonb
  THEN RAISE EXCEPTION 'SIGNED_IN_DRAFT_REVISION_TRIGGER_OR_READBACK_FAILED'; END IF;
END $auth_draft_owner$;

SELECT set_config('request.jwt.claim.sub','86000000-0000-4000-8000-000000000002',true);
DO $auth_draft_isolation$
DECLARE
  v_id uuid;
  v_visible integer;
  v_rows integer;
BEGIN
  SELECT id INTO v_id FROM auth_draft_fixture;
  SELECT count(*) INTO v_visible FROM public.taxpay_account_payment_form_drafts WHERE id=v_id;
  IF v_visible <> 0 THEN RAISE EXCEPTION 'SIGNED_IN_DRAFT_CROSSACCOUNT_READ_SUCCEEDED'; END IF;

  UPDATE public.taxpay_account_payment_form_drafts
    SET form_payload='{"schemaVersion":1,"paymentHead":"FORGED"}'::jsonb WHERE id=v_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'SIGNED_IN_DRAFT_CROSSACCOUNT_UPDATE_SUCCEEDED'; END IF;

  DELETE FROM public.taxpay_account_payment_form_drafts WHERE id=v_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN RAISE EXCEPTION 'SIGNED_IN_DRAFT_CROSSACCOUNT_DELETE_SUCCEEDED'; END IF;

  BEGIN
    INSERT INTO public.taxpay_account_payment_form_drafts(owner_uid,service,form_payload)
    VALUES('86000000-0000-4000-8000-000000000001','OTHER_TAX_PAYMENT','{"forged":true}'::jsonb);
    RAISE EXCEPTION 'SIGNED_IN_DRAFT_FORGED_OWNER_INSERT_SUCCEEDED';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $auth_draft_isolation$;
RESET ROLE;

DO $auth_draft_final$
DECLARE
  v_id uuid;
  v_revision integer;
  v_payload jsonb;
BEGIN
  SELECT id INTO v_id FROM auth_draft_fixture;
  SELECT revision,form_payload INTO v_revision,v_payload
    FROM public.taxpay_account_payment_form_drafts WHERE id=v_id;
  IF v_revision IS DISTINCT FROM 2
     OR v_payload IS DISTINCT FROM '{"schemaVersion":1,"paymentHead":"68B","amount":"1500","assessmentYear":"2026-27"}'::jsonb
  THEN RAISE EXCEPTION 'SIGNED_IN_DRAFT_OWNER_DATA_CHANGED_BY_OTHER_ACCOUNT'; END IF;
  IF (SELECT count(*) FROM public.sim_payment_transactions)
     IS DISTINCT FROM (SELECT row_count FROM auth_draft_payment_count)
  THEN RAISE EXCEPTION 'SIGNED_IN_DRAFT_CREATED_OR_CHANGED_PAYMENT_TRANSACTION'; END IF;
  RAISE NOTICE 'PASS: signed-in Auth draft create/read/update, revision conflict, owner-only RLS, forged-owner denial, and no payment transaction';
END $auth_draft_final$;

ROLLBACK;
