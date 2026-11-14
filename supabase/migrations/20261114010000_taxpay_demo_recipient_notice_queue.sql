-- F-013/US-004: persisted received-payment notices for fictional preview
-- profiles only. Uses the pre-existing server-issued demo capability.
-- This is not an Auth identity, official tax credit, or settlement record.
BEGIN;
CREATE TABLE taxpay_guest_private.demo_received_payment_notice_ack (
  demo_id text NOT NULL REFERENCES taxpay_guest_private.demo_profiles(demo_id)
    ON DELETE CASCADE,
  event_id text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 200),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (demo_id,event_id)
);
ALTER TABLE taxpay_guest_private.demo_received_payment_notice_ack ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpay_guest_private.demo_received_payment_notice_ack FORCE ROW LEVEL SECURITY;
REVOKE ALL ON taxpay_guest_private.demo_received_payment_notice_ack
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.taxpay_demo_received_payment_notices(
  p_capability_hash text,
  p_action text DEFAULT 'list',
  p_event_id text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $notices$
DECLARE
  v_demo text;
  v_number integer;
  v_tin12 text;
  v_tin13 text;
  v_registered_tin text;
  v_events jsonb;
  v_list jsonb;
  v_count integer;
  v_ack_at timestamptz;
BEGIN
  IF p_capability_hash IS NULL OR p_capability_hash !~ '^[0-9a-f]{64}$'
     OR p_action NOT IN ('list','unread','ack')
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'INVALID_NOTICE_REQUEST'; END IF;
  PERFORM taxpay_guest_private.touch_session(p_capability_hash);
  SELECT demo_id INTO v_demo FROM taxpay_guest_private.demo_profiles
   WHERE encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')
      =p_capability_hash;
  IF v_demo IS NULL THEN RAISE EXCEPTION 'INVALID_DEMO_PROFILE'; END IF;
  v_number := substring(v_demo from 5)::integer;
  v_tin12 := CASE WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,12)
    WHEN v_number=10 THEN repeat('0',12)
    ELSE '9090000000'||lpad(v_number::text,2,'0') END;
  v_tin13 := CASE WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,13)
    WHEN v_number=10 THEN '1010101010101'
    ELSE '90000000000'||lpad(v_number::text,2,'0') END;
  SELECT tin INTO v_registered_tin
    FROM public.taxpay_taxpayer_registration_profiles
    WHERE account_id=v_demo;

  -- Source rows are immutable payments, never inferred from a browser-supplied
  -- TIN. The paying session must belong to its existing demo payer; links
  -- recovered from legacy sessions are accepted only when every row is owned.
  WITH valid_parents AS (
    SELECT p.* FROM demo_payment.story_payments p
    JOIN taxpay_guest_private.demo_profiles payer
      ON payer.demo_id=p.data->'details'->>'payerId'
    WHERE p.status='SIMULATED_SUCCESS' AND p.data->>'origin'='TAXPAY_UI'
      AND (payer.payment_session_id=p.session_id OR EXISTS (
        SELECT 1 FROM taxpay_guest_private.demo_story_session_links link
        WHERE link.demo_id=payer.demo_id AND link.legacy_session_id=p.session_id
          AND NOT EXISTS (
            SELECT 1 FROM demo_payment.story_payments unverified
            WHERE unverified.session_id=link.legacy_session_id
              AND (unverified.data->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
                OR unverified.data->'details'->>'payerId' IS DISTINCT FROM payer.demo_id)
          )
      ))
  ),
  eligible AS (
    SELECT p.id::text||':allocation:'||a.ordinality::text AS event_id,
      a.value->>'allocationId' AS allocation_id,
      p.id AS payment_id,p.created_at,
      coalesce(nullif(p.data->'details'->>'receiptReference',''),
        p.data->'details'->'receiptSnapshot'->>'challanNo') AS receipt_reference,
      a.value->>'taxpayerTin' AS recipient_tin,
      a.value->>'headId' AS head_id,
      coalesce(a.value->>'serviceCode',p.service_code) AS service_code,
      a.value->>'assessmentYear' AS assessment_year,
      (a.value->>'amountMinor')::bigint AS amount_minor
    FROM valid_parents p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.data->'details'->'allocations')='array'
        THEN p.data->'details'->'allocations' ELSE '[]'::jsonb END
    ) WITH ORDINALITY a(value,ordinality)
    WHERE a.value->>'taxpayerTin' IN (v_tin12,v_tin13,v_registered_tin)
      AND a.value->>'amountMinor' ~ '^[1-9][0-9]{0,11}$'
      AND coalesce(a.value->>'assessmentYear','')<>''
    UNION ALL
    SELECT p.id::text||':legacy:'||l.ordinality::text AS event_id,
      NULL::text AS allocation_id,p.id,p.created_at,
      coalesce(nullif(p.data->'details'->>'receiptReference',''),
        p.data->'details'->'receiptSnapshot'->>'challanNo'),
      NULL::text AS recipient_tin,l.value->>'headId',
      p.service_code,l.value->>'assessmentYear',
      (l.value->>'amountMinor')::bigint AS amount_minor
    FROM valid_parents p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.data->'details'->'lines')='array'
        THEN p.data->'details'->'lines' ELSE '[]'::jsonb END
    ) WITH ORDINALITY l(value,ordinality)
    WHERE jsonb_typeof(p.data->'details'->'allocations') IS DISTINCT FROM 'array'
      AND l.value->>'beneficiary'=v_demo
      AND l.value->>'amountMinor' ~ '^[1-9][0-9]{0,11}$'
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'eventId',e.event_id,'paymentId',e.payment_id,
      'allocationId',e.allocation_id,'receiptReference',e.receipt_reference,
      'recipientTin',e.recipient_tin,'headId',e.head_id,
      'serviceCode',e.service_code,'assessmentYear',e.assessment_year,
      'amountMinor',e.amount_minor,'createdAt',e.created_at)
    ORDER BY e.created_at,e.payment_id,e.event_id
  ),'[]'::jsonb) INTO v_events FROM eligible e;

  IF p_action='ack' THEN
    IF p_event_id IS NULL OR length(p_event_id)>200 OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_events) AS event(value)
      WHERE event.value->>'eventId'=p_event_id
    ) THEN RAISE EXCEPTION 'NOTICE_NOT_FOUND'; END IF;
    INSERT INTO taxpay_guest_private.demo_received_payment_notice_ack
      (demo_id,event_id) VALUES (v_demo,p_event_id)
      ON CONFLICT (demo_id,event_id) DO NOTHING;
    SELECT acknowledged_at INTO v_ack_at
      FROM taxpay_guest_private.demo_received_payment_notice_ack
      WHERE demo_id=v_demo AND event_id=p_event_id;
    RETURN jsonb_build_object(
      'eventId',p_event_id,'isRead',true,'acknowledgedAt',v_ack_at
    );
  END IF;
  SELECT count(*) INTO v_count FROM jsonb_array_elements(v_events) AS event(value)
   LEFT JOIN taxpay_guest_private.demo_received_payment_notice_ack ack
    ON ack.demo_id=v_demo AND ack.event_id=event.value->>'eventId'
   WHERE p_action='list' OR ack.event_id IS NULL;
  SELECT coalesce(jsonb_agg(p.item ORDER BY p.ordinal),'[]'::jsonb)
    INTO v_list FROM (
    SELECT event.value ||
      jsonb_build_object('isRead',ack.acknowledged_at IS NOT NULL,
        'acknowledgedAt',ack.acknowledged_at) AS item,event.ordinality AS ordinal
    FROM jsonb_array_elements(v_events) WITH ORDINALITY AS event(value,ordinality)
    LEFT JOIN taxpay_guest_private.demo_received_payment_notice_ack ack
      ON ack.demo_id=v_demo AND ack.event_id=event.value->>'eventId'
    WHERE p_action='list' OR ack.event_id IS NULL
    ORDER BY event.ordinality
    OFFSET p_offset LIMIT p_limit
  ) p;
  RETURN jsonb_build_object('items',v_list,'total',v_count,
    'hasMore',v_count>p_offset+p_limit,'offset',p_offset,'limit',p_limit);
END;
$notices$;

REVOKE ALL ON FUNCTION public.taxpay_demo_received_payment_notices(
  text,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_demo_received_payment_notices(
  text,text,text,integer,integer) TO service_role;
COMMIT;
