-- Sohojkor P0 Pay Again: enforce source-parent provenance BEFORE a repeat
-- reaches the original Taxpayer SQL payment, notice or Office outbox.
-- This is an additional guard on the existing immutable Story1 insert path,
-- not a new payment/identity service or a financial settlement transition.
-- The original source receipt and allocations remain stored on their own
-- parent; details.sourcePaymentId is the stable provenance link.
BEGIN;

CREATE FUNCTION demo_payment.check_new_pay_again_source_lineage()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $pay_again_lineage$
DECLARE
  v_source_id text := NEW.data#>>'{details,sourcePaymentId}';
  v_payer text;
  v_profile_session uuid;
  v_original demo_payment.story_payments%ROWTYPE;
  v_new_item jsonb;
  v_original_item jsonb;
  v_new_id text;
  v_original_ref text;
  v_new_ref text;
  v_field text;
BEGIN
  -- Absent source means a first payment; preserve its exact existing path.
  IF v_source_id IS NULL THEN RETURN NEW; END IF;
  IF v_source_id !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'PAY_AGAIN_INVALID_SOURCE_ID';
  END IF;

  v_payer := NEW.data#>>'{details,payerId}';
  -- An arbitrary TIN, payment reference, session UUID, or request body cannot
  -- authorize a repeat. The already-authenticated preview RPC binds the
  -- opaque capability to this server-owned payment session and payer ID.
  IF NEW.data->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
     OR v_payer IS NULL OR NEW.session_id IS NULL
  THEN RAISE EXCEPTION 'PAY_AGAIN_PAYER_REQUIRED'; END IF;
  SELECT p.payment_session_id INTO v_profile_session
  FROM taxpay_guest_private.demo_profiles p
  WHERE p.demo_id=v_payer
    AND p.payment_session_id=NEW.session_id;
  IF v_profile_session IS NULL THEN
    RAISE EXCEPTION 'PAY_AGAIN_PAYER_NOT_BOUND';
  END IF;

  SELECT * INTO v_original FROM demo_payment.story_payments p
  WHERE p.id=v_source_id::uuid;
  IF NOT FOUND OR v_original.id=NEW.id
     OR v_original.status IS DISTINCT FROM 'SIMULATED_SUCCESS'
     OR v_original.data->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
     OR v_original.data#>>'{details,payerId}' IS DISTINCT FROM v_payer
     OR v_original.service_code IS DISTINCT FROM NEW.service_code
  THEN RAISE EXCEPTION 'PAY_AGAIN_SOURCE_NOT_OWNED'; END IF;

  -- Old session links are explicit and identity-scoped. A shared, mixed, or
  -- QA-only historical session never becomes a Pay Again entitlement.
  IF v_original.session_id IS DISTINCT FROM v_profile_session
     AND NOT EXISTS (
       SELECT 1 FROM taxpay_guest_private.demo_story_session_links l
       WHERE l.demo_id=v_payer AND l.legacy_session_id=v_original.session_id
         AND NOT EXISTS (
           SELECT 1 FROM demo_payment.story_payments unverified
           WHERE unverified.session_id=l.legacy_session_id
             AND (
               unverified.data->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
               OR unverified.data#>>'{details,payerId}' IS DISTINCT FROM v_payer
             )
         )
     )
  THEN RAISE EXCEPTION 'PAY_AGAIN_SOURCE_NOT_OWNED'; END IF;

  -- Keep payer identity fixed, but intentionally allow the USER to edit the
  -- new payment's recipients, heads, assessment years and amounts.
  IF NULLIF(pg_catalog.btrim(v_original.data#>>'{details,payerTin}'),'')
       IS NOT NULL
     AND NULLIF(pg_catalog.btrim(NEW.data#>>'{details,payerTin}'),'')
       IS DISTINCT FROM
         NULLIF(pg_catalog.btrim(v_original.data#>>'{details,payerTin}'),'')
  THEN RAISE EXCEPTION 'PAY_AGAIN_PAYER_IDENTITY_CHANGED'; END IF;

  v_original_ref := v_original.data#>>'{details,receiptReference}';
  v_new_ref := NEW.data#>>'{details,receiptReference}';
  IF NEW.idempotency_key IS NOT DISTINCT FROM v_original.idempotency_key
     OR v_new_ref IS DISTINCT FROM 'SIM-'||NEW.idempotency_key::text
     OR v_new_ref IS NOT DISTINCT FROM v_original_ref
     OR NEW.data#>>'{details,receiptSnapshot,challanNo}'
          IS DISTINCT FROM v_new_ref
  THEN RAISE EXCEPTION 'PAY_AGAIN_NEW_RECEIPT_REQUIRED'; END IF;

  -- An edited repeat is a distinct financial event, NOT a replay of the old
  -- allocation or its receipt/certificate. Keep old allocation IDs on the
  -- original source parent so historic history and Office can resolve them.
  IF pg_catalog.jsonb_typeof(NEW.data#>'{details,allocations}')='array'
     AND pg_catalog.jsonb_typeof(v_original.data#>'{details,allocations}')='array'
  THEN
    FOR v_new_item IN SELECT item.value
      FROM pg_catalog.jsonb_array_elements(NEW.data#>'{details,allocations}') item
    LOOP
      v_new_id := v_new_item->>'allocationId';
      FOR v_original_item IN SELECT item.value
        FROM pg_catalog.jsonb_array_elements(
          v_original.data#>'{details,allocations}') item
      LOOP
        IF v_new_id IS NOT NULL AND
           v_new_id IS NOT DISTINCT FROM v_original_item->>'allocationId'
        THEN RAISE EXCEPTION 'PAY_AGAIN_ALLOCATION_ID_REUSED'; END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Optional payment/gateway tokens carried by the current original receipt
  -- must also be regenerated if both source and repeat contain them.
  FOREACH v_field IN ARRAY ARRAY[
    'tokenNumber','gatewayTransactionId','paymentTransactionId','taxEventId'
  ]
  LOOP
    IF NULLIF(v_original.data#>>ARRAY['details','receiptSnapshot',v_field],'') IS NOT NULL
       AND NEW.data#>>ARRAY['details','receiptSnapshot',v_field]
            IS NOT DISTINCT FROM
              v_original.data#>>ARRAY['details','receiptSnapshot',v_field]
    THEN RAISE EXCEPTION 'PAY_AGAIN_SOURCE_TOKEN_REUSED'; END IF;
  END LOOP;

  RETURN NEW;
END;
$pay_again_lineage$;

REVOKE ALL ON FUNCTION demo_payment.check_new_pay_again_source_lineage()
  FROM PUBLIC,anon,authenticated;

-- Stable trigger order: existing "a_" checks validate allocation totals,
-- this "b_" guard validates old-parent ownership and fresh identifiers;
-- existing payment permissions/RLS/idempotency triggers stay in place.
CREATE TRIGGER b_taxpay_pay_again_lineage_before_insert
 BEFORE INSERT ON demo_payment.story_payments
 FOR EACH ROW EXECUTE FUNCTION demo_payment.check_new_pay_again_source_lineage();

COMMENT ON FUNCTION demo_payment.check_new_pay_again_source_lineage() IS
 'Pay Again insert guard: source parent must be in the same capability-bound fictional payer account, optionally recovered via verified single-payer session link; original source stays immutable, repeat allocations and receipt identities must be fresh. No TIN-only ownership or gateway settlement.';

COMMIT;
