-- Isolated SQL contract test for the TaxPay side of Office correction review.
-- Run only against the disposable Supabase database created by CI.
BEGIN;

DO $correction_privileges$
DECLARE
  v_table text;
  v_privilege text;
BEGIN
  IF has_function_privilege('anon','public.taxpay_correction_my_history(integer)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.taxpay_correction_my_history(integer)','EXECUTE')
     OR has_function_privilege('anon','public.taxpay_correction_internal_claim(integer)','EXECUTE')
     OR has_function_privilege('authenticated','public.taxpay_correction_internal_claim(integer)','EXECUTE')
     OR has_function_privilege('anon','public.taxpay_correction_internal_ack(uuid,uuid,boolean,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.taxpay_correction_internal_ack(uuid,uuid,boolean,text)','EXECUTE')
     OR has_function_privilege('anon','public.taxpay_correction_record_office_decision(jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.taxpay_correction_record_office_decision(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'A public or authenticated role can execute an internal correction RPC';
  END IF;
  IF NOT has_function_privilege('service_role','public.taxpay_correction_internal_claim(integer)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.taxpay_correction_internal_ack(uuid,uuid,boolean,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.taxpay_correction_record_office_decision(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'The service role lacks an intended correction RPC grant';
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'payment_sync.correction_outbox',
    'public.taxpay_correction_review_decisions'
  ] LOOP
    FOREACH v_privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege('anon',v_table,v_privilege)
         OR has_table_privilege('authenticated',v_table,v_privilege) THEN
        RAISE EXCEPTION 'A public or authenticated role has % on private correction table %',
          v_privilege,v_table;
      END IF;
    END LOOP;
  END LOOP;

  IF has_table_privilege('anon','public.taxpay_in_app_notifications','SELECT')
     OR NOT has_table_privilege('authenticated','public.taxpay_in_app_notifications','SELECT')
     OR has_column_privilege('anon','public.taxpay_in_app_notifications','correction_inquiry_id','SELECT')
     OR has_column_privilege('anon','public.taxpay_in_app_notifications','correction_decision_id','SELECT')
     OR NOT has_column_privilege('authenticated','public.taxpay_in_app_notifications','correction_inquiry_id','SELECT')
     OR NOT has_column_privilege('authenticated','public.taxpay_in_app_notifications','correction_decision_id','SELECT') THEN
    RAISE EXCEPTION 'Correction notification read grants do not match the owner-scoped contract';
  END IF;
END;
$correction_privileges$;

CREATE TEMP TABLE correction_bridge_test_state(
  inquiry_id uuid NOT NULL,event_id uuid,claim_token uuid
) ON COMMIT DROP;
GRANT SELECT,INSERT,UPDATE ON correction_bridge_test_state TO authenticated,service_role;

-- Synthetic walk-in parent, inserted before the no-mutation snapshot.
INSERT INTO demo_payment.story_payments(
  id,idempotency_key,session_id,service_code,amount_minor,data,status
) VALUES (
  '80000000-0000-4000-8000-000000000041',
  '80000000-0000-4000-8000-000000000042',
  '80000000-0000-4000-8000-000000000043',
  'OTHER_TAX_PAYMENT',100,
  jsonb_build_object(
    'idempotencyKey','80000000-0000-4000-8000-000000000042',
    'sessionId','80000000-0000-4000-8000-000000000043',
    'service','OTHER_TAX_PAYMENT','amountMinor',100,'origin','TAXPAY_UI',
    'details',jsonb_build_object(
      'payerMode','OTHER','payerTin','909000000030',
      'payerName','Taxpayer Account 30','receiptReference','SYN-REF-003',
      'allocations',jsonb_build_array(
        jsonb_build_object('allocationId','ws3-parent-owner-line',
          'taxpayerTin','909000000030','amountMinor',50),
        jsonb_build_object('allocationId','ws3-verified-other-recipient',
          'taxpayerTin','444444444444','amountMinor',50)),
      'receiptSnapshot',jsonb_build_object(
        'challanNo','SYN-REF-003','payerTin','909000000030',
        'payerName','Taxpayer Account 30'
      )
    )
  ),
  'SIMULATED_SUCCESS'
);

CREATE TEMP TABLE correction_financial_guard(
  relation_name text PRIMARY KEY,row_count bigint NOT NULL,content_digest text NOT NULL
) ON COMMIT DROP;
DO $snapshot_financial$
DECLARE v_relation regclass; v_name text; v_count bigint; v_digest text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'public.taxpay_payment_requests','public.sim_payment_transactions',
    'public.sim_payment_allocations','payment_sync.requests','payment_sync.events',
    'payment_sync.request_mutations','payment_sync.notifications',
    'demo_payment.story_payments','demo_payment.story_notifications'
  ] LOOP
    v_relation := pg_catalog.to_regclass(v_name);
    IF v_relation IS NULL THEN CONTINUE; END IF;
    EXECUTE pg_catalog.format(
      'SELECT count(*)::bigint,pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(row_to_json(t)::text), '''' ORDER BY row_to_json(t)::text),'''')) FROM %s t',
      v_relation
    ) INTO v_count,v_digest;
    INSERT INTO correction_financial_guard VALUES(v_relation::text,v_count,v_digest);
  END LOOP;
END;
$snapshot_financial$;

INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at)
VALUES
  ('80000000-0000-4000-8000-000000000001','correction-bridge-test@example.invalid','{}'::jsonb,now()),
  ('80000000-0000-4000-8000-000000000002','correction-outsider-test@example.invalid','{}'::jsonb,now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sim_payment_users(id) VALUES ('user30'),('user31')
ON CONFLICT (id) DO NOTHING;
INSERT INTO taxpay_guest_private.demo_profiles(demo_id,payment_session_id)
VALUES ('user30','80000000-0000-4000-8000-000000000043')
ON CONFLICT (demo_id) DO UPDATE SET payment_session_id=EXCLUDED.payment_session_id;
-- A distinct verified recipient is bound to user31, not to the payer user30.
-- Only disposable fixture identities are used; never copy this to hosted SQL.
INSERT INTO public.taxpay_taxpayer_registration_profiles(account_id,tin,profile)
VALUES ('user31','444444444444',
  jsonb_build_object('tin','444444444444','taxpayerName','WS3 recipient 31')
  || (SELECT jsonb_object_agg(field,'') FROM unnest(ARRAY[
      'source','sourceUpdatedAt','taxpayerStatus','tinType','tinSubtype',
      'registeredOn','userType','localTaxpayer','previousTin','taxesCircle',
      'taxesZone','taxesRange','district','country','registeredAddress',
      'currentAddress','mobileNumber','emailAddress','certificateIssuedOn',
      'certificateLastUpdatedOn','issuingOfficer','taxOfficeAddress',
      'taxOfficePhone','lastLoginAt']) AS fields(field))
) ON CONFLICT(account_id) DO NOTHING;

INSERT INTO public.sim_payment_account_bindings(user_id,owner_uid,assigned_by)
VALUES ('user30','80000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001')
ON CONFLICT (user_id) DO UPDATE SET
  owner_uid=EXCLUDED.owner_uid,assigned_by=EXCLUDED.assigned_by;
INSERT INTO public.sim_payment_account_bindings(user_id,owner_uid,assigned_by)
VALUES ('user31','80000000-0000-4000-8000-000000000002',
  '80000000-0000-4000-8000-000000000002')
ON CONFLICT(user_id) DO UPDATE SET
  owner_uid=EXCLUDED.owner_uid,assigned_by=EXCLUDED.assigned_by;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
DO $walkin_claim$
DECLARE v_claimed integer;
BEGIN
  v_claimed := public.taxpay_claim_walkin_payer_payments();
  IF v_claimed<>1 THEN
    RAISE EXCEPTION 'The verified bound account did not claim its synthetic walk-in payment';
  END IF;
END;
$walkin_claim$;
WITH inserted AS (
  INSERT INTO public.taxpay_correction_inquiries
    (requester_uid,original_reference,reason,requested_outcome,evidence_note,change_kind,old_value,new_value)
  VALUES
    ('80000000-0000-4000-8000-000000000001','SYN-REF-003',
     'Synthetic evidence-pending review request','Review this synthetic payment reference',
     E'বাংলা সহায়ক প্রমাণ\\nOffice intake details longer than twenty characters',
     'CIRCLE','Circle A','Circle B')
  RETURNING inquiry_id
)
INSERT INTO correction_bridge_test_state SELECT inquiry_id FROM inserted;

DO $owner_initial$
DECLARE v_count integer; v_state text; v_revision integer; v_parent uuid; v_kind text;
BEGIN
  SELECT count(*),min(office_review_state),min(office_review_revision),
         min(original_payment_id::text)::uuid,min(original_payment_kind)
    INTO v_count,v_state,v_revision,v_parent,v_kind
    FROM public.taxpay_correction_inquiries
    WHERE inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state);
  IF v_count<>1 OR v_state IS DISTINCT FROM 'PENDING_OFFICER' OR v_revision<>1
     OR v_parent IS DISTINCT FROM '80000000-0000-4000-8000-000000000041'
     OR v_kind IS DISTINCT FROM 'TAXPAY_STORY_PAYMENT' THEN
    RAISE EXCEPTION 'Initial owner correction status or original payment parent link failed';
  END IF;
END;
$owner_initial$;

SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
DO $outsider_parent$
DECLARE v_visible integer;
BEGIN
  SELECT count(*) INTO v_visible FROM public.taxpay_correction_inquiries
    WHERE inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state);
  IF v_visible<>0 THEN RAISE EXCEPTION 'Unrelated account read a correction inquiry'; END IF;
  BEGIN
    INSERT INTO public.taxpay_correction_inquiries(
      requester_uid,original_reference,reason,requested_outcome
    ) VALUES (
      '80000000-0000-4000-8000-000000000002','909000000030',
      'Synthetic unlinked TIN attempt','Review must not infer payment ownership from a typed TIN'
    );
    RAISE EXCEPTION 'TEST_UNEXPECTED_UNLINKED_CORRECTION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='TEST_UNEXPECTED_UNLINKED_CORRECTION' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%CORRECTION_ORIGINAL_PAYMENT_NOT_LINKED%' THEN RAISE; END IF;
  END;
END;
$outsider_parent$;
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);


-- Continue the same original, owner-verified disposable fixture with direct decisions.
RESET ROLE;
INSERT INTO taxpay_guest_private.story_correction_requests(
 id,demo_id,payment_id,request_key,original_reference,current_year,proposed_year,current_circle,proposed_circle,current_head,proposed_head,reason)
VALUES
 ('90000000-0000-4000-8000-000000000001','user1',NULL,'90000000-0000-4000-8000-000000000011','DEMO-DIRECT-APPROVE','2025-2026','2026-2027','Circle A','Circle A','HEAD-A','HEAD-A','Disposable historical request'),
 ('90000000-0000-4000-8000-000000000002','user1',NULL,'90000000-0000-4000-8000-000000000012','DEMO-DIRECT-REJECT','2025-2026','2026-2027','Circle A','Circle A','HEAD-A','HEAD-A','Disposable historical request');
SET LOCAL ROLE service_role;
DO $direct$
DECLARE cmd jsonb; got jsonb; replay jsonb; id uuid; x record;
BEGIN
 SELECT inquiry_id INTO id FROM correction_bridge_test_state;
 cmd:=jsonb_build_object('schemaVersion','1.0.0','commandType','CORRECTION_REVIEW','origin','OFFICE_SQL','messageId','90000000-0000-4000-8000-000000000021','requestId',id,'officerUid','90000000-0000-4000-8000-000000000099','officerRole','SUPER_ADMIN','action','APPROVE','idempotencyKey','90000000-0000-4000-8000-000000000031','reason','Verified correction in disposable fixture','expectedReviewState','PENDING_OFFICER','occurredAt',now());
 BEGIN
  PERFORM public.taxpay_correction_record_office_decision(cmd||'{"officerRole":"MAKER","action":"MAKER_ACKNOWLEDGE"}');
  RAISE EXCEPTION 'TEST_UNEXPECTED_LEGACY_ACTION';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM IS DISTINCT FROM 'Invalid correction review action' THEN RAISE; END IF;
 END;
 got:=public.taxpay_correction_record_office_decision(cmd);
 replay:=public.taxpay_correction_record_office_decision(cmd);
 IF got->>'reviewState' IS DISTINCT FROM 'APPROVED' OR replay->>'duplicate' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Direct authenticated approval/replay failed'; END IF;
 BEGIN
  PERFORM public.taxpay_correction_record_office_decision(cmd||'{"reason":"Conflicting direct replay"}');
  RAISE EXCEPTION 'TEST_UNEXPECTED_CONFLICTING_REPLAY';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM IS DISTINCT FROM 'Conflicting correction review replay' THEN RAISE; END IF;
 END;
 FOR x IN SELECT * FROM (VALUES
 ('90000000-0000-4000-8000-000000000001'::uuid,'90000000-0000-4000-8000-000000000022'::uuid,'APPROVE','APPROVED'),
 ('90000000-0000-4000-8000-000000000002'::uuid,'90000000-0000-4000-8000-000000000023'::uuid,'REJECT','REJECTED')) q(request_id,message_id,action,expected)
 LOOP
  cmd:=jsonb_build_object('schemaVersion','1.0.0','commandType','CORRECTION_REVIEW','origin','OFFICE_SQL','messageId',x.message_id,'requestId',x.request_id,'officerUid','90000000-0000-4000-8000-000000000099','officerRole','SUPER_ADMIN','action',x.action,'idempotencyKey',x.message_id,'reason','Verified disposable correction decision','expectedReviewState','PENDING_OFFICER','occurredAt',now(),'sourceProject','v2','simulationOnly',true);
  got:=public.taxpay_demo_correction_office_decision(cmd);
  replay:=public.taxpay_demo_correction_office_decision(cmd);
  IF got->>'reviewState' IS DISTINCT FROM x.expected OR replay IS DISTINCT FROM got THEN RAISE EXCEPTION 'Direct simulation decision/replay failed'; END IF;
 END LOOP;
END;
$direct$;
RESET ROLE;
DO $verify$
DECLARE x record; n bigint; d text; id uuid;
BEGIN
 SELECT inquiry_id INTO id FROM correction_bridge_test_state;
 IF (SELECT count(*) FROM public.taxpay_correction_review_decisions WHERE inquiry_id=id)<>1 OR
    (SELECT office_review_state FROM public.taxpay_correction_inquiries WHERE inquiry_id=id) IS DISTINCT FROM 'APPROVED' THEN RAISE EXCEPTION 'Authenticated direct decision persistence failed'; END IF;
 IF (SELECT count(*) FROM public.taxpay_in_app_notifications WHERE correction_inquiry_id=id AND message_code='CORRECTION_APPROVED')<>1 THEN RAISE EXCEPTION 'Approval notice missing or duplicated'; END IF;
 IF (SELECT count(*) FROM taxpay_guest_private.story_correction_decisions WHERE request_id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002'))<>2 THEN RAISE EXCEPTION 'Simulation decision replay duplicated'; END IF;
 IF (SELECT count(*) FROM taxpay_guest_private.story_correction_notice_events WHERE request_id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002') AND code IN ('APPROVED','REJECTED'))<>2 THEN RAISE EXCEPTION 'Simulation decision notice missing'; END IF;
 FOR x IN SELECT * FROM correction_financial_guard LOOP
  EXECUTE format('SELECT count(*)::bigint,pg_catalog.md5(coalesce(pg_catalog.string_agg(pg_catalog.md5(row_to_json(t)::text), '''' ORDER BY row_to_json(t)::text),'''')) FROM %s t',x.relation_name) INTO n,d;
  IF n IS DISTINCT FROM x.row_count OR d IS DISTINCT FROM x.content_digest THEN RAISE EXCEPTION 'Original financial records changed: %',x.relation_name; END IF;
 END LOOP;
END;
$verify$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
DO $owner_boundary$
BEGIN
 IF EXISTS(SELECT 1 FROM public.taxpay_correction_inquiries WHERE inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state)) THEN RAISE EXCEPTION 'Unrelated account saw direct decision'; END IF;
 IF EXISTS(SELECT 1 FROM public.taxpay_in_app_notifications WHERE correction_inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state)) THEN RAISE EXCEPTION 'Unrelated account saw direct notice'; END IF;
END;
$owner_boundary$;
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
DO $owner_readback$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.taxpay_correction_inquiries WHERE inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state) AND office_review_state='APPROVED') THEN RAISE EXCEPTION 'Owner did not see direct approval'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.taxpay_in_app_notifications WHERE correction_inquiry_id=(SELECT inquiry_id FROM correction_bridge_test_state) AND message_code='CORRECTION_APPROVED') THEN RAISE EXCEPTION 'Owner did not see approval notice'; END IF;
END;
$owner_readback$;
ROLLBACK;
