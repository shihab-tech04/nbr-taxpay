-- Sohojkor F-129 / US-050: strictly profile-capability-scoped reference
-- readback for confirmed synthetic Taxpayer SQL payments. A reference, mobile
-- or prior session UUID ALONE never grants access to any payment.
-- Preserve existing explicit, read-only legacy session recovery and per-row
-- payer checks; no changes to Office, Auth, payment or receipt rows.
BEGIN;

CREATE OR REPLACE FUNCTION public.taxpay_demo_story1_reference_payment(
  p_capability_hash text, p_reference text, p_receipt_mobile text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $guest_reference_readback$
DECLARE
  v_demo text;
  v_session uuid;
  v_ref text;
  v_mobile text;
  v_found jsonb;
BEGIN
  IF p_capability_hash IS NULL
     OR p_capability_hash !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'INVALID_CAPABILITY'; END IF;
  v_ref := pg_catalog.upper(pg_catalog.btrim(p_reference));
  IF v_ref IS NULL OR pg_catalog.length(v_ref)=0
     OR pg_catalog.length(v_ref)>200
  THEN RAISE EXCEPTION 'INVALID_REFERENCE'; END IF;
  v_mobile := NULLIF(pg_catalog.btrim(p_receipt_mobile),'');
  IF v_mobile IS NOT NULL AND v_mobile !~ '^01[0-9]{9}$'
  THEN RAISE EXCEPTION 'INVALID_RECEIPT_MOBILE'; END IF;

  -- Reuse the existing expiry/revocation and opaque capability checks.
  -- Its session update is the same existing profile-read behavior.
  PERFORM taxpay_guest_private.touch_session(p_capability_hash);
  SELECT d.demo_id,d.payment_session_id INTO v_demo,v_session
    FROM taxpay_guest_private.demo_profiles d
   WHERE pg_catalog.encode(extensions.digest(
     pg_catalog.convert_to(d.capability_token,'UTF8'),'sha256'),'hex')
     = p_capability_hash;
  IF v_demo IS NULL THEN RAISE EXCEPTION 'INVALID_DEMO_PROFILE'; END IF;

  SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',p.id,'service',p.service_code,'amountMinor',p.amount_minor,
    'status',p.status,'createdAt',p.created_at,
    'details',COALESCE(p.data->'details','{}'::jsonb)
  )) INTO v_found
  FROM (
    SELECT x.id,x.service_code,x.amount_minor,x.status,x.created_at,x.data
    FROM demo_payment.story_payments x
    WHERE x.status='SIMULATED_SUCCESS'
      AND x.data->>'origin'='TAXPAY_UI'
      AND x.data#>>'{details,payerId}'=v_demo
      AND (
        x.session_id=v_session
        OR EXISTS (
          SELECT 1 FROM taxpay_guest_private.demo_story_session_links l
          WHERE l.demo_id=v_demo AND l.legacy_session_id=x.session_id
            AND NOT EXISTS (
              SELECT 1 FROM demo_payment.story_payments unsafe
              WHERE unsafe.session_id=l.legacy_session_id
                AND (
                  unsafe.data->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
                  OR unsafe.data#>>'{details,payerId}' IS DISTINCT FROM v_demo
                )
            )
        )
      )
      AND (
        pg_catalog.upper(x.id::text)=v_ref
        OR pg_catalog.upper('SK-PC-'||x.id::text)=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(x.data#>>'{details,receiptReference}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(x.data#>>'{details,tokenNumber}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(x.data#>>'{details,gatewayTransactionId}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(x.data#>>'{details,receiptSnapshot,challanNo}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(x.data#>>'{details,receiptSnapshot,tokenNumber}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(x.data#>>'{details,receiptSnapshot,gatewayTransactionId}'))=v_ref
        OR pg_catalog.upper(pg_catalog.btrim(x.data#>>'{details,receiptSnapshot,paymentTransactionId}'))=v_ref
      )
      AND (
        v_mobile IS NULL OR COALESCE(
          NULLIF(x.data#>>'{details,receiptSnapshot,receiptMobile}',''),
          x.data#>>'{details,receiptMobile}',''
        )=v_mobile
      )
    LIMIT 2
  ) p;
  IF pg_catalog.jsonb_array_length(COALESCE(v_found,'[]'::jsonb))>1
  THEN RAISE EXCEPTION 'AMBIGUOUS_PAYMENT_REFERENCE'; END IF;
  RETURN v_found->0;
END;
$guest_reference_readback$;

REVOKE ALL ON FUNCTION public.taxpay_demo_story1_reference_payment(text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_demo_story1_reference_payment(text,text,text)
  TO service_role;
COMMIT;
