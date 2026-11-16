-- Phase 7: Auth-owned received-payment notices.
-- Reuses the existing approver-assigned sim_payment_account_bindings; a typed
-- TIN, preview capability, or email alone never grants payment visibility.
-- Recorded story payments are NOT proof of payment settlement or tax credit.
BEGIN;

CREATE TABLE IF NOT EXISTS taxpay_guest_private.account_received_payment_notice_ack (
  owner_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 200),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_uid,event_id)
);
ALTER TABLE taxpay_guest_private.account_received_payment_notice_ack ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpay_guest_private.account_received_payment_notice_ack FORCE ROW LEVEL SECURITY;
REVOKE ALL ON taxpay_guest_private.account_received_payment_notice_ack
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.taxpay_account_received_payment_notices(
  p_action text DEFAULT 'unread',
  p_event_id text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $received$
DECLARE
  v_actor uuid := auth.uid();
  v_events jsonb;
  v_page jsonb;
  v_total integer;
  v_ack timestamptz;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id=v_actor
      AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'AUTHENTICATED_VERIFIED_USER_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('list','unread','ack')
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'INVALID_NOTICE_REQUEST'; END IF;

  -- Return only immutable source allocations that match the APPROVER-BOUND
  -- registered TIN for this exact Auth UID. Never accept a client TIN or
  -- browser-owned payer session as proof of recipient identity.
  WITH verified_tins AS (
    SELECT DISTINCT profile.tin, binding.user_id
    FROM public.sim_payment_account_bindings binding
    JOIN public.taxpay_taxpayer_registration_profiles profile
      ON profile.account_id=binding.user_id
    WHERE binding.owner_uid=v_actor
      AND profile.tin ~ '^[0-9]{12,13}$'
  ), eligible AS (
    SELECT DISTINCT p.id, p.created_at, p.service_code,
      a.ordinality,
      a.value->>'allocationId' AS allocation_id,
      coalesce(nullif(p.data->'details'->>'receiptReference',''),
        p.data->'details'->'receiptSnapshot'->>'challanNo') AS receipt_reference,
      a.value->>'headId' AS head_id,
      a.value->>'assessmentYear' AS assessment_year,
      (a.value->>'amountMinor')::bigint AS amount_minor
    FROM demo_payment.story_payments p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.data->'details'->'allocations')='array'
        THEN p.data->'details'->'allocations'
        ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS a(value,ordinality)
    JOIN verified_tins bound
      ON bound.tin=a.value->>'taxpayerTin'
    WHERE p.status='SIMULATED_SUCCESS'
      AND p.data->>'origin'='TAXPAY_UI'
      AND p.data->'details'->>'payerId' IS DISTINCT FROM bound.user_id
      AND length(coalesce(a.value->>'allocationId','')) BETWEEN 1 AND 128
      AND a.value->>'amountMinor' ~ '^[1-9][0-9]{0,11}$'
      AND coalesce(a.value->>'assessmentYear','')<>''
  ), notices AS (
    SELECT e.id::text||':allocation:'||e.ordinality::text AS event_id,
      e.id, e.created_at, e.service_code, e.allocation_id,
      e.receipt_reference, e.head_id, e.assessment_year, e.amount_minor
    FROM eligible e
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'eventId',n.event_id,'paymentId',n.id,
      'allocationId',n.allocation_id,'recipientTin',NULL,
      'receiptReference',n.receipt_reference,
      'serviceCode',n.service_code,'headId',n.head_id,
      'assessmentYear',n.assessment_year,
      'amountMinor',n.amount_minor,'createdAt',n.created_at,
      'recordState','RECORDED_NOT_CONFIRMED_TAX_CREDIT'
    )
    ORDER BY n.created_at,n.id,n.event_id
  ),'[]'::jsonb) INTO v_events
  FROM notices n;

  IF p_action='ack' THEN
    IF p_event_id IS NULL OR length(p_event_id)>200 OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_events) AS item(value)
      WHERE item.value->>'eventId'=p_event_id
    ) THEN RAISE EXCEPTION 'NOTICE_NOT_FOUND' USING ERRCODE='42501'; END IF;
    INSERT INTO taxpay_guest_private.account_received_payment_notice_ack(owner_uid,event_id)
      VALUES(v_actor,p_event_id)
      ON CONFLICT(owner_uid,event_id) DO NOTHING;
    SELECT acknowledged_at INTO v_ack
      FROM taxpay_guest_private.account_received_payment_notice_ack
      WHERE owner_uid=v_actor AND event_id=p_event_id;
    RETURN jsonb_build_object('eventId',p_event_id,'isRead',true,'acknowledgedAt',v_ack);
  END IF;

  SELECT count(*) INTO v_total
  FROM jsonb_array_elements(v_events) AS item(value)
  LEFT JOIN taxpay_guest_private.account_received_payment_notice_ack ack
    ON ack.owner_uid=v_actor AND ack.event_id=item.value->>'eventId'
  WHERE p_action='list' OR ack.event_id IS NULL;

  SELECT coalesce(jsonb_agg(selected.item ORDER BY selected.ordinal),'[]'::jsonb)
    INTO v_page FROM (
    SELECT item.value||jsonb_build_object('isRead',ack.acknowledged_at IS NOT NULL,
      'acknowledgedAt',ack.acknowledged_at) AS item,
      item.ordinality AS ordinal
    FROM jsonb_array_elements(v_events) WITH ORDINALITY item(value,ordinality)
    LEFT JOIN taxpay_guest_private.account_received_payment_notice_ack ack
      ON ack.owner_uid=v_actor AND ack.event_id=item.value->>'eventId'
    WHERE p_action='list' OR ack.event_id IS NULL
    ORDER BY item.ordinality OFFSET p_offset LIMIT p_limit
  ) selected;
  RETURN jsonb_build_object('items',v_page,'total',v_total,
    'hasMore',v_total>p_offset+p_limit,'offset',p_offset,'limit',p_limit);
END;
$received$;

REVOKE ALL ON FUNCTION public.taxpay_account_received_payment_notices(text,text,integer,integer)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_account_received_payment_notices(text,text,integer,integer)
  TO authenticated;
COMMENT ON FUNCTION public.taxpay_account_received_payment_notices(text,text,integer,integer) IS
  'Authenticated, confirmed and approver-bound recipients only. Recorded non-self source allocations, no settlement or tax credit assertion, owner-specific idempotent ACK.';
COMMIT;
