-- F-178 / US-181: optional free-text challan remarks on the immutable
-- original Taxpayer payment parent (data.details.challanRemarks).
-- The existing v3 parent JSON, outbox and idempotency key carry this value
-- unmodified; do not introduce a second remarks table or mutate old parents.
BEGIN;
CREATE FUNCTION demo_payment.validate_challan_remarks_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $remarks$
DECLARE v_remarks jsonb;
BEGIN
  IF NEW.data ? 'details'
     AND pg_catalog.jsonb_typeof(NEW.data->'details') = 'object'
     AND (NEW.data->'details') ? 'challanRemarks' THEN
    v_remarks := NEW.data#>'{details,challanRemarks}';
    IF pg_catalog.jsonb_typeof(v_remarks) NOT IN ('string','null') THEN
      RAISE EXCEPTION 'CHALLAN_REMARKS_MUST_BE_TEXT';
    END IF;
    -- Keep free-text remarks genuinely multiline, but bound the immutable
    -- payment envelope for storage/transport. No legacy 20-character ceiling.
    -- PostgreSQL char_length counts Unicode characters (not UTF-8 bytes).
    IF pg_catalog.jsonb_typeof(v_remarks) = 'string' AND (
      pg_catalog.char_length(NEW.data #>> '{details,challanRemarks}') > 4000
      OR pg_catalog.octet_length(NEW.data #>> '{details,challanRemarks}') > 16000
    ) THEN
      RAISE EXCEPTION 'CHALLAN_REMARKS_TOO_LONG';
    END IF;
    -- Do not trim or normalize: preserve newlines, BN/EN Unicode and exact
    -- review/receipt/Office mirror parity; empty and null remain optional.
  END IF;
  RETURN NEW;
END;
$remarks$;
REVOKE ALL ON FUNCTION demo_payment.validate_challan_remarks_v1()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER c_taxpay_challan_remarks_before_insert
 BEFORE INSERT ON demo_payment.story_payments
 FOR EACH ROW EXECUTE FUNCTION demo_payment.validate_challan_remarks_v1();
COMMENT ON FUNCTION demo_payment.validate_challan_remarks_v1() IS
 'F-178: validates optional parent details.challanRemarks as exact multiline Unicode text up to 4000 characters and 16000 bytes, without 20-character truncation. The parent, mirror and Pay Again origin remain immutable.';
COMMIT;
