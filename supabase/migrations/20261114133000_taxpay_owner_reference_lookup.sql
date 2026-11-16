-- F-129 / US-050: O(1)-request signed-in owner reference lookup against
-- the ORIGINAL Taxpayer SQL. Never treat a challan, mobile or UUID as proof.
-- Exact record shape matches taxpay_my_story1_payments; no write, claim or
-- session transfer, no Office global read, no anonymous execution.
BEGIN;
CREATE OR REPLACE FUNCTION public.taxpay_my_story1_payment_by_reference(
  p_reference text, p_receipt_mobile text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $owner_reference_lookup$
DECLARE
  v_uid uuid;
  v_ref text;
  v_mobile text;
  v_rows jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'SIGN_IN_REQUIRED'; END IF;
  v_ref := pg_catalog.upper(pg_catalog.btrim(p_reference));
  IF v_ref IS NULL OR pg_catalog.length(v_ref)=0 OR pg_catalog.length(v_ref)>200
  THEN RAISE EXCEPTION 'INVALID_PAYMENT_REFERENCE'; END IF;
  v_mobile := NULLIF(pg_catalog.btrim(p_receipt_mobile),'');
  IF v_mobile IS NOT NULL AND v_mobile !~ '^01[0-9]{9}$'
  THEN RAISE EXCEPTION 'INVALID_RECEIPT_MOBILE'; END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',q.id,'service',q.service_code,'amountMinor',q.amount_minor,
    'status',q.status,'createdAt',q.created_at,
    'details',COALESCE(q.data->'details','{}'::jsonb)
  )),'[]'::jsonb) INTO v_rows
  FROM (
    SELECT p.id,p.service_code,p.amount_minor,p.status,p.created_at,p.data
    FROM public.taxpay_story1_payment_owners o
    JOIN demo_payment.story_payments p ON p.id=o.payment_id
    WHERE o.owner_uid=v_uid
      AND (
        pg_catalog.upper(p.id::text)=v_ref
        OR pg_catalog.upper('SK-PC-'||p.id::text)=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(p.data#>>'{details,receiptReference}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(p.data#>>'{details,tokenNumber}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(p.data#>>'{details,gatewayTransactionId}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(p.data#>>'{details,receiptSnapshot,challanNo}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(p.data#>>'{details,receiptSnapshot,tokenNumber}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(p.data#>>'{details,receiptSnapshot,gatewayTransactionId}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(p.data#>>'{details,receiptSnapshot,paymentTransactionId}'))=v_ref
      )
      AND (v_mobile IS NULL OR
        COALESCE(
          NULLIF(p.data#>>'{details,receiptSnapshot,receiptMobile}',''),
          p.data#>>'{details,receiptMobile}',''
        )=v_mobile)
    LIMIT 2
  ) q;
  IF pg_catalog.jsonb_array_length(v_rows)>1
  THEN RAISE EXCEPTION 'AMBIGUOUS_PAYMENT_REFERENCE'; END IF;
  RETURN v_rows->0;
END;
$owner_reference_lookup$;

REVOKE ALL ON FUNCTION public.taxpay_my_story1_payment_by_reference(text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.taxpay_my_story1_payment_by_reference(text,text)
  TO authenticated;
COMMIT;
