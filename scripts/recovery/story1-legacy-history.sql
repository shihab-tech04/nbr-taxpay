-- Historical simulator recovery, reviewed release SQL. Run in one transaction.
-- A read-only archive is not a new story payment or a payment replay.
CREATE TABLE demo_payment.story1_legacy_history (
 id uuid PRIMARY KEY, idempotency_key uuid NOT NULL UNIQUE,
 session_id uuid NOT NULL, service_code text NOT NULL,
 amount_minor bigint NOT NULL CHECK (amount_minor>0),
 data jsonb NOT NULL CHECK (jsonb_typeof(data)='object'),
 status text NOT NULL CHECK (status='SIMULATED_SUCCESS'), created_at timestamptz NOT NULL,
 owner_demo_id text NOT NULL CHECK (owner_demo_id ~ '^user([1-9]|[1-4][0-9]|5[0-5])$'),
 source_project text NOT NULL CHECK (source_project='eyqhoavnitkrajvyqvxn'),
 source_payload_sha256 text NOT NULL CHECK (source_payload_sha256=encode(extensions.digest(convert_to(data::text,'UTF8'),'sha256'),'hex')),
 CHECK (data->>'origin' IS NOT DISTINCT FROM 'TAXPAY_UI'
   AND data#>>'{details,payerId}' IS NOT DISTINCT FROM owner_demo_id
   AND data->>'idempotencyKey' IS NOT DISTINCT FROM idempotency_key::text
   AND data->>'sessionId' IS NOT DISTINCT FROM session_id::text
   AND data->>'service' IS NOT DISTINCT FROM service_code
   AND data->>'amountMinor' IS NOT DISTINCT FROM amount_minor::text
   AND jsonb_typeof(data#>'{details,receiptSnapshot}') IS NOT DISTINCT FROM 'object')
);
ALTER TABLE demo_payment.story1_legacy_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON demo_payment.story1_legacy_history FROM PUBLIC,anon,authenticated,service_role;
-- Reject unverified imports before they can reserve a historical payment ID.
-- The private archive is populated only by an authorized recovery transaction;
-- a payer label alone is not sufficient proof of the current owner session.
CREATE FUNCTION demo_payment.validate_story1_legacy_import()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $import_guard$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM taxpay_guest_private.demo_profiles p
  WHERE p.demo_id=NEW.owner_demo_id AND p.payment_session_id=NEW.session_id) THEN
  RAISE EXCEPTION 'LEGACY_OWNER_SESSION_UNVERIFIED';
 END IF;
 IF EXISTS (SELECT 1 FROM demo_payment.story_payments p
  WHERE p.id=NEW.id OR p.idempotency_key=NEW.idempotency_key) THEN
  RAISE EXCEPTION 'LEGACY_IDENTITY_ALREADY_CURRENT';
 END IF;
 RETURN NEW;
END $import_guard$;
REVOKE ALL ON FUNCTION demo_payment.validate_story1_legacy_import() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aa_taxpay_validate_legacy_import BEFORE INSERT ON demo_payment.story1_legacy_history
 FOR EACH ROW EXECUTE FUNCTION demo_payment.validate_story1_legacy_import();

CREATE VIEW demo_payment.story1_history_source WITH (security_invoker=true) AS
 SELECT id,idempotency_key,session_id,service_code,amount_minor,data,status,created_at FROM demo_payment.story_payments
 UNION ALL
 SELECT h.id,h.idempotency_key,h.session_id,h.service_code,h.amount_minor,h.data,h.status,h.created_at
 FROM demo_payment.story1_legacy_history h
 JOIN taxpay_guest_private.demo_profiles p ON p.demo_id=h.owner_demo_id AND p.payment_session_id=h.session_id
 WHERE NOT EXISTS (SELECT 1 FROM demo_payment.story_payments current_row
  WHERE current_row.id=h.id OR current_row.idempotency_key=h.idempotency_key);
REVOKE ALL ON demo_payment.story1_history_source FROM PUBLIC,anon,authenticated,service_role;

-- Like the existing scoped-fixture migration, update the read source ONLY.
-- Fail closed on an unexpected function, relation count or privilege change.
-- Do not change any capability, expiry, session, payer or lineage predicate.
DO $legacy_history_read$
DECLARE f text; original text; revised text; old_acl aclitem[]; old_owner oid;
 old_config text[]; old_volatile "char"; expected integer; found_count integer;
BEGIN
 FOR f,expected IN SELECT * FROM (VALUES
  ('public.taxpay_demo_story1_session_payments(text,integer,integer)',4),
  ('public.taxpay_demo_story1_session_payment(text,uuid)',2),
  ('public.taxpay_demo_story1_reference_payment(text,text,text)',2),
  ('public.taxpay_demo_story1_history_page(text,text,timestamptz,uuid,integer)',3),
  ('demo_payment.check_new_pay_again_source_lineage()',2)
 ) AS funcs(signature,expected_count)
 LOOP
  SELECT pg_get_functiondef(oid),proacl,proowner,proconfig,provolatile
    INTO original,old_acl,old_owner,old_config,old_volatile
    FROM pg_proc WHERE oid=f::regprocedure AND prosecdef;
  IF original IS NULL OR strpos(original,'story1_history_source')>0 THEN
   RAISE EXCEPTION 'LEGACY_HISTORY_UNEXPECTED_BASELINE:%',f;
  END IF;
  SELECT count(*) INTO found_count FROM regexp_matches(original,
   'from[[:space:]]+demo_payment[.]story_payments([[:space:]]|$)','gi');
  IF found_count<>expected THEN RAISE EXCEPTION 'LEGACY_HISTORY_RELATION_COUNT:%:%',f,found_count; END IF;
  revised:=regexp_replace(original,'from[[:space:]]+demo_payment[.]story_payments([[:space:]]|$)',
   'FROM demo_payment.story1_history_source\1','gi');
  IF f='public.taxpay_demo_story1_history_page(text,text,timestamptz,uuid,integer)' THEN
   -- Do not reveal legacy beneficiary allocations under a new profile mapping.
   IF strpos(revised,'and (p_before_created_at is null or')=0 THEN
    RAISE EXCEPTION 'LEGACY_HISTORY_CURSOR_BASELINE_MISMATCH';
   END IF;
   revised:=replace(revised,'and (p_before_created_at is null or',
    'and (p_view=''payer'' OR EXISTS (SELECT 1 FROM demo_payment.story_payments current_row WHERE current_row.id=x.id)) and (p_before_created_at is null or');
  END IF;
  EXECUTE revised;
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=f::regprocedure AND prosecdef
    AND proacl IS NOT DISTINCT FROM old_acl AND proowner=old_owner
    AND proconfig IS NOT DISTINCT FROM old_config AND provolatile=old_volatile) THEN
   RAISE EXCEPTION 'LEGACY_HISTORY_SECURITY_CHANGED:%',f;
  END IF;
 END LOOP;
END $legacy_history_read$;

-- Guard the existing source table against a duplicate historical ID or key.
CREATE FUNCTION demo_payment.reject_archived_story1_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $guard$
BEGIN
 IF EXISTS(SELECT 1 FROM demo_payment.story1_legacy_history h
  WHERE h.id=NEW.id OR h.idempotency_key=NEW.idempotency_key) THEN
  RAISE EXCEPTION 'LEGACY_PAYMENT_READ_ONLY';
 END IF;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION demo_payment.reject_archived_story1_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aa_taxpay_legacy_identity_guard BEFORE INSERT ON demo_payment.story_payments
 FOR EACH ROW EXECUTE FUNCTION demo_payment.reject_archived_story1_identity();
