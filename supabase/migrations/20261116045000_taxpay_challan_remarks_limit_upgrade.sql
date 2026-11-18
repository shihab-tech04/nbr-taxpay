-- Additive upgrade for installations that already applied the F178 type-only
-- migration: preserve its trigger, replace only the validation function.
-- Unicode multiline remarks stay unchanged up to 4000 codepoints / 16000 bytes.
BEGIN;
CREATE OR REPLACE FUNCTION demo_payment.validate_challan_remarks_v1()
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
COMMENT ON FUNCTION demo_payment.validate_challan_remarks_v1() IS
 'F178 upgrade: free-text Unicode remarks bounded to 4000 characters and 16000 bytes; original challan JSON and payment allocations remain immutable.';
COMMIT;
