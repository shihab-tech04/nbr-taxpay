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
    '{"schemaVersion":1,"passengers":[{"name":"Rollback only","passport":""}],"phone":"01700000000"}'::jsonb,
    NULL
  );
  id := (created->>'id')::uuid;
  IF id IS NULL OR created->>'service' <> 'TRAVEL_TAX'
     OR (created->>'revision')::integer <> 1 THEN
    RAISE EXCEPTION 'Preview draft creation did not return exact persisted identity';
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

ROLLBACK;
