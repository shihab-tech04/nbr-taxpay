-- Unsigned payment-form draft lifecycle in disposable Taxpayer SQL only.
-- Every session/draft is rolled back; never creates a paid parent or receipt.
BEGIN;
DO $unsigned_guest_draft$
DECLARE
  owner_hash text := encode(extensions.digest(extensions.gen_random_bytes(32),'sha256'),'hex');
  outsider_hash text := encode(extensions.digest(extensions.gen_random_bytes(32),'sha256'),'hex');
  session_id uuid;
  outsider_session_id uuid;
  old_payment_count bigint;
  old_notice_count bigint;
  old_outbox_count bigint;
  created jsonb;
  current_row jsonb;
  result jsonb;
  draft_id uuid;
  rejected boolean;
BEGIN
  IF has_function_privilege('anon',
       'public.taxpay_guest_payment_form_drafts(text,text,uuid,text,jsonb,integer)','EXECUTE')
    OR has_function_privilege('authenticated',
       'public.taxpay_guest_payment_form_drafts(text,text,uuid,text,jsonb,integer)','EXECUTE')
    OR NOT has_function_privilege('service_role',
       'public.taxpay_guest_payment_form_drafts(text,text,uuid,text,jsonb,integer)','EXECUTE')
    OR has_table_privilege('anon','taxpay_guest_private.guest_payment_form_drafts','SELECT')
  THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_DIRECT_DATA_API_ACCESS'; END IF;

  INSERT INTO taxpay_guest_private.sessions(capability_hash)
    VALUES(owner_hash) RETURNING id INTO session_id;
  INSERT INTO taxpay_guest_private.sessions(capability_hash)
    VALUES(outsider_hash) RETURNING id INTO outsider_session_id;
  SELECT count(*) INTO old_payment_count FROM demo_payment.story_payments;
  SELECT count(*) INTO old_notice_count FROM demo_payment.story_notifications;
  SELECT count(*) INTO old_outbox_count FROM demo_payment.mirror_outbox;

  created:=public.taxpay_guest_payment_form_drafts(owner_hash,'create',NULL,
    'OTHER_TAX_PAYMENT',
    '{"assessmentYear":"2025-26","beneficiaries":[{"tin":"111111111111","headId":8,"amountMinor":1500}],"editState":"incomplete"}');
  draft_id:=(created->>'id')::uuid;
  IF created->>'service' IS DISTINCT FROM 'OTHER_TAX_PAYMENT'
    OR created->>'revision' IS DISTINCT FROM '1'
    OR created->'form_payload'->>'assessmentYear' IS DISTINCT FROM '2025-26'
    OR (SELECT session_id FROM taxpay_guest_private.guest_payment_form_drafts
        WHERE id=draft_id) IS DISTINCT FROM session_id
  THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_CREATE_OR_OWNER_FAILED'; END IF;
  result:=public.taxpay_guest_payment_form_drafts(owner_hash,'list');
  IF jsonb_array_length(result)<>1 OR result->0->>'id' IS DISTINCT FROM draft_id::text
  THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_LIST_FAILED'; END IF;
  result:=public.taxpay_guest_payment_form_drafts(outsider_hash,'list');
  IF jsonb_array_length(result)<>0 THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_LIST_PRIVACY_FAILED'; END IF;
  rejected:=false;
  BEGIN
    PERFORM public.taxpay_guest_payment_form_drafts(outsider_hash,'get',draft_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='DRAFT_NOT_FOUND' THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_OTHER_GUEST_READ_ALLOWED'; END IF;

  result:=public.taxpay_guest_payment_form_drafts(owner_hash,'update',draft_id,
    'OTHER_TAX_PAYMENT',
    '{"assessmentYear":"2025-26","beneficiaries":[{"tin":"111111111111","headId":8,"amountMinor":2000}],"editState":"resumed"}',1);
  IF result->>'revision' IS DISTINCT FROM '2'
    OR result->'form_payload'->>'editState' IS DISTINCT FROM 'resumed'
  THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_UPDATE_FAILED'; END IF;
  rejected:=false;
  BEGIN
    PERFORM public.taxpay_guest_payment_form_drafts(owner_hash,'update',draft_id,
      'OTHER_TAX_PAYMENT','{"overwrite":true}',1);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='DRAFT_CONFLICT' THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_STALE_REVISION_ACCEPTED'; END IF;
  rejected:=false;
  BEGIN
    PERFORM public.taxpay_guest_payment_form_drafts(outsider_hash,'delete',draft_id,
      NULL,NULL,2);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='DRAFT_CONFLICT' THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_OTHER_GUEST_DELETE_ALLOWED'; END IF;

  -- Existing capability reopens after simulated browser refresh without Auth.
  current_row:=public.taxpay_guest_payment_form_drafts(owner_hash,'get',draft_id);
  IF current_row->>'revision' IS DISTINCT FROM '2'
    OR current_row->'form_payload'->>'editState' IS DISTINCT FROM 'resumed'
  THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_REFRESH_RECOVERY_FAILED'; END IF;
  result:=public.taxpay_guest_payment_form_drafts(owner_hash,'delete',draft_id,
    NULL,NULL,2);
  IF result->>'deleted' IS DISTINCT FROM draft_id::text
    OR jsonb_array_length(public.taxpay_guest_payment_form_drafts(owner_hash,'list'))<>0
  THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_DELETE_FAILED'; END IF;

  -- Session expiry remains authoritative; no draft is usable after expiry.
  UPDATE taxpay_guest_private.sessions
    SET expires_at=now()-interval '1 second' WHERE id=outsider_session_id;
  rejected:=false;
  BEGIN
    PERFORM public.taxpay_guest_payment_form_drafts(outsider_hash,'list');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='GUEST_SESSION_UNAVAILABLE' THEN rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'EXPIRED_GUEST_DRAFT_SESSION_ALLOWED'; END IF;
  IF (SELECT count(*) FROM demo_payment.story_payments)<>old_payment_count
     OR (SELECT count(*) FROM demo_payment.story_notifications)<>old_notice_count
     OR (SELECT count(*) FROM demo_payment.mirror_outbox)<>old_outbox_count
  THEN RAISE EXCEPTION 'UNSIGNED_DRAFT_CREATED_FINANCIAL_OR_NOTICE_RECORD'; END IF;
  RAISE NOTICE 'PASS: unsigned guest session-scoped create/list/get/update/delete, revision conflict, isolation, expiry, refresh and zero payment/notice/outbox rows';
END;
$unsigned_guest_draft$;
ROLLBACK;
