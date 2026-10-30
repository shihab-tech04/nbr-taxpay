-- TaxPay correction inquiry transport and Office review readback.
-- This connects the existing evidence-pending inquiry to the existing HMAC
-- bridges. It never changes receipts, payment requests, tax credits or ledgers.
BEGIN;

-- payment_sync is present on hosted TaxPay. Creating the private schema here
-- also keeps clean local migration resets deterministic.
CREATE SCHEMA IF NOT EXISTS payment_sync;
REVOKE ALL ON SCHEMA payment_sync FROM PUBLIC,anon,authenticated;

ALTER TABLE public.taxpay_correction_inquiries
  ADD COLUMN office_review_state text NOT NULL DEFAULT 'PENDING_OFFICER'
    CHECK (office_review_state IN (
      'PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED',
      'APPROVER_CLOSED','REJECTED')),
  ADD COLUMN office_review_revision integer NOT NULL DEFAULT 1
    CHECK (office_review_revision >= 1),
  ADD COLUMN office_review_updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE payment_sync.correction_outbox (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL,
  event_payload jsonb NOT NULL CHECK (pg_catalog.jsonb_typeof(event_payload) = 'object'),
  target text NOT NULL DEFAULT 'OFFICE_SQL' CHECK (target = 'OFFICE_SQL'),
  delivery_state text NOT NULL DEFAULT 'PENDING'
    CHECK (delivery_state IN ('PENDING','IN_FLIGHT','ACKNOWLEDGED','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  claim_token uuid,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inquiry_id)
);
CREATE INDEX correction_outbox_ready_idx
  ON payment_sync.correction_outbox(delivery_state,next_attempt_at,created_at);
ALTER TABLE payment_sync.correction_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sync.correction_outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON payment_sync.correction_outbox FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.taxpay_enqueue_correction_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  INSERT INTO payment_sync.correction_outbox(inquiry_id,event_payload)
  VALUES (NEW.inquiry_id, pg_catalog.jsonb_build_object(
    'originalReference',NEW.original_reference,
    'reason',NEW.reason,
    'requestedOutcome',NEW.requested_outcome,
    'evidenceState',NEW.evidence_state,
    'claimantVerified',NEW.claimant_verified,
    'originalReceiptVerified',NEW.original_receipt_verified,
    'mayChangeFinancialRecords',NEW.may_change_financial_records,
    'changeKind',NEW.change_kind,
    'oldValue',NEW.old_value,
    'newValue',NEW.new_value,
    'createdAt',NEW.created_at
  ));
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.taxpay_enqueue_correction_submission() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER taxpay_correction_enqueue_after_insert
  AFTER INSERT ON public.taxpay_correction_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.taxpay_enqueue_correction_submission();

-- Reuse the deployed dispatcher wake-up and one-minute retry job. The
-- correction outbox remains separate from payment_sync.events, whose FK points
-- to payment requests and therefore cannot represent correction inquiries.
CREATE OR REPLACE FUNCTION payment_sync.wake_bridge() RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_self_url text;
DECLARE v_dispatch_token text;
DECLARE v_enabled boolean;
DECLARE v_has_payment boolean := false;
DECLARE v_has_correction boolean := false;
DECLARE v_job bigint;
BEGIN
  IF pg_catalog.to_regclass('payment_sync.bridge_config') IS NULL THEN RETURN NULL; END IF;
  EXECUTE 'SELECT self_url,dispatch_token,enabled FROM payment_sync.bridge_config WHERE singleton'
    INTO v_self_url,v_dispatch_token,v_enabled;
  IF NOT FOUND OR NOT coalesce(v_enabled,false) THEN RETURN NULL; END IF;
  IF pg_catalog.to_regclass('payment_sync.outbox') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM payment_sync.outbox
      WHERE delivery_state<>''ACKNOWLEDGED'' AND next_attempt_at<=now())'
      INTO v_has_payment;
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM payment_sync.correction_outbox
    WHERE delivery_state<>''ACKNOWLEDGED'' AND next_attempt_at<=now())'
    INTO v_has_correction;
  IF NOT v_has_payment AND NOT v_has_correction THEN
    RETURN NULL;
  END IF;
  EXECUTE 'SELECT net.http_post(url:=$1,
    body:=$2,headers:=$3,timeout_milliseconds:=15000)'
    INTO v_job USING v_self_url,
      pg_catalog.jsonb_build_object('mode','dispatch','token',v_dispatch_token),
      '{"Content-Type":"application/json"}'::jsonb;
  RETURN v_job;
END;
$function$;

CREATE OR REPLACE FUNCTION payment_sync.wake_on_correction_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  PERFORM payment_sync.wake_bridge();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION payment_sync.wake_on_correction_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER taxpay_correction_wake_after_insert
  AFTER INSERT ON payment_sync.correction_outbox
  FOR EACH ROW EXECUTE FUNCTION payment_sync.wake_on_correction_insert();

CREATE TABLE public.taxpay_correction_review_decisions (
  message_id uuid PRIMARY KEY,
  inquiry_id uuid NOT NULL REFERENCES public.taxpay_correction_inquiries(inquiry_id),
  idempotency_key uuid NOT NULL,
  payload_fingerprint text NOT NULL CHECK (payload_fingerprint ~ '^[0-9a-f]{32}$'),
  officer_uid uuid NOT NULL,
  officer_role text NOT NULL CHECK (officer_role IN ('MAKER','REVIEWER','APPROVER')),
  action_code text NOT NULL CHECK (action_code IN (
    'MAKER_ACKNOWLEDGE','REVIEWER_VERIFY','APPROVER_CLOSE','REJECT')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 1000),
  previous_state text NOT NULL CHECK (previous_state IN (
    'PENDING_OFFICER','MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED')),
  next_state text NOT NULL CHECK (next_state IN (
    'MAKER_ACKNOWLEDGED','REVIEWER_VERIFIED','APPROVER_CLOSED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inquiry_id,officer_uid,idempotency_key)
);
CREATE INDEX taxpay_correction_review_decisions_recent_idx
  ON public.taxpay_correction_review_decisions(inquiry_id,created_at DESC);
ALTER TABLE public.taxpay_correction_review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxpay_correction_review_decisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxpay_correction_review_decisions FROM PUBLIC,anon,authenticated;

-- Extend the existing taxpayer inbox with a second, explicit correction target.
-- Existing payment notices keep their request/event foreign keys and owner RLS.
ALTER TABLE public.taxpay_in_app_notifications
  ALTER COLUMN request_id DROP NOT NULL,
  ALTER COLUMN event_id DROP NOT NULL,
  ADD COLUMN correction_inquiry_id uuid
    REFERENCES public.taxpay_correction_inquiries(inquiry_id),
  ADD COLUMN correction_decision_id uuid
    REFERENCES public.taxpay_correction_review_decisions(message_id),
  ADD CONSTRAINT taxpay_notifications_one_target_check CHECK (
    (request_id IS NOT NULL AND event_id IS NOT NULL
      AND correction_inquiry_id IS NULL AND correction_decision_id IS NULL)
    OR
    (request_id IS NULL AND event_id IS NULL
      AND correction_inquiry_id IS NOT NULL AND correction_decision_id IS NOT NULL)
  ) NOT VALID;
ALTER TABLE public.taxpay_in_app_notifications
  VALIDATE CONSTRAINT taxpay_notifications_one_target_check;
GRANT SELECT (correction_inquiry_id,correction_decision_id)
  ON TABLE public.taxpay_in_app_notifications TO authenticated;
CREATE UNIQUE INDEX taxpay_notifications_correction_decision_unique_idx
  ON public.taxpay_in_app_notifications(recipient_uid,correction_decision_id)
  WHERE correction_decision_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.taxpay_notify_correction_review_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_recipient uuid; v_message_code text;
BEGIN
  v_message_code := CASE NEW.action_code
    WHEN 'MAKER_ACKNOWLEDGE' THEN 'CORRECTION_MAKER_ACKNOWLEDGED'
    WHEN 'REVIEWER_VERIFY' THEN 'CORRECTION_REVIEWER_VERIFIED'
    WHEN 'APPROVER_CLOSE' THEN 'CORRECTION_APPROVER_CLOSED'
    WHEN 'REJECT' THEN 'CORRECTION_REJECTED'
    ELSE NULL END;
  IF v_message_code IS NULL THEN RAISE EXCEPTION 'Unknown correction notification action'; END IF;
  SELECT i.requester_uid INTO v_recipient
    FROM public.taxpay_correction_inquiries i WHERE i.inquiry_id=NEW.inquiry_id;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Correction notification owner not found'; END IF;
  INSERT INTO public.taxpay_in_app_notifications(
    recipient_uid,request_id,event_id,message_code,is_read,
    correction_inquiry_id,correction_decision_id)
  VALUES(v_recipient,NULL,NULL,v_message_code,false,NEW.inquiry_id,NEW.message_id)
  ON CONFLICT (recipient_uid,correction_decision_id)
    WHERE correction_decision_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.taxpay_notify_correction_review_decision()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER taxpay_correction_decision_notify_after_insert
  AFTER INSERT ON public.taxpay_correction_review_decisions
  FOR EACH ROW EXECUTE FUNCTION public.taxpay_notify_correction_review_decision();

CREATE OR REPLACE FUNCTION public.taxpay_correction_internal_claim(p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_result jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid batch size';
  END IF;
  WITH ready AS (
    SELECT o.event_id FROM payment_sync.correction_outbox o
    WHERE o.delivery_state <> 'ACKNOWLEDGED' AND o.next_attempt_at <= now()
    ORDER BY o.created_at,o.event_id LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE payment_sync.correction_outbox o SET delivery_state='IN_FLIGHT',
      attempts=o.attempts+1,next_attempt_at=now()+interval '2 minutes',
      claim_token=gen_random_uuid()
    FROM ready WHERE o.event_id=ready.event_id
    RETURNING o.event_id,o.claim_token,o.inquiry_id,o.event_payload,o.created_at
  )
  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'claimToken',c.claim_token,
    'event',pg_catalog.jsonb_build_object(
      'schemaVersion','1.0.0','eventId',c.event_id,'requestId',c.inquiry_id,
      'origin','TAXPAY_SQL','eventType','CORRECTION_SUBMITTED','revision',1,
      'occurredAt',c.created_at,'payload',c.event_payload))),'[]'::jsonb)
    INTO v_result FROM claimed c;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.taxpay_correction_internal_ack(
  p_event_id uuid,p_claim_token uuid,p_success boolean,p_error text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_updated uuid;
BEGIN
  IF p_success IS NULL THEN RAISE EXCEPTION 'Delivery result required'; END IF;
  UPDATE payment_sync.correction_outbox SET
    delivery_state=CASE WHEN p_success THEN 'ACKNOWLEDGED' ELSE 'FAILED' END,
    acknowledged_at=CASE WHEN p_success THEN now() ELSE NULL END,
    last_error=CASE WHEN p_success THEN NULL ELSE left(coalesce(p_error,'Delivery failed'),500) END,
    next_attempt_at=CASE WHEN p_success THEN next_attempt_at
      ELSE now()+pg_catalog.make_interval(secs=>least(3600,5*(2^least(attempts,9))::integer)) END,
    claim_token=NULL
  WHERE event_id=p_event_id AND claim_token=p_claim_token AND delivery_state='IN_FLIGHT'
  RETURNING event_id INTO v_updated;
  IF v_updated IS NULL THEN RAISE EXCEPTION 'Unknown or stale correction delivery claim'; END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.taxpay_correction_record_office_decision(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_message uuid; v_inquiry uuid; v_actor uuid; v_idempotency uuid;
  v_role text; v_action text; v_reason text; v_expected text;
  v_fingerprint text; v_old_state text; v_new_state text; v_revision integer;
  v_previous public.taxpay_correction_review_decisions%ROWTYPE;
BEGIN
  IF p_command IS NULL OR pg_catalog.jsonb_typeof(p_command) IS DISTINCT FROM 'object'
     OR pg_catalog.octet_length(p_command::text) > 12000
     OR p_command->>'schemaVersion' IS DISTINCT FROM '1.0.0'
     OR p_command->>'commandType' IS DISTINCT FROM 'CORRECTION_REVIEW'
     OR p_command->>'origin' IS DISTINCT FROM 'OFFICE_SQL' THEN
    RAISE EXCEPTION 'Invalid correction review command';
  END IF;
  IF coalesce(p_command->>'messageId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR coalesce(p_command->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR coalesce(p_command->>'officerUid','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR coalesce(p_command->>'idempotencyKey','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid correction review identifiers';
  END IF;

  v_message := (p_command->>'messageId')::uuid;
  v_inquiry := (p_command->>'requestId')::uuid;
  v_actor := (p_command->>'officerUid')::uuid;
  v_idempotency := (p_command->>'idempotencyKey')::uuid;
  v_role := p_command->>'officerRole';
  v_action := p_command->>'action';
  v_reason := nullif(pg_catalog.btrim(p_command->>'reason'),'');
  v_expected := p_command->>'expectedReviewState';
  v_fingerprint := pg_catalog.md5(p_command::text);

  IF v_role IS NULL OR v_action IS NULL OR v_reason IS NULL OR
     v_role NOT IN ('MAKER','REVIEWER','APPROVER') OR
     NOT ((v_action='MAKER_ACKNOWLEDGE' AND v_role='MAKER') OR
          (v_action='REVIEWER_VERIFY' AND v_role='REVIEWER') OR
          (v_action='APPROVER_CLOSE' AND v_role='APPROVER') OR
          (v_action='REJECT' AND v_role IN ('REVIEWER','APPROVER'))) OR
     length(v_reason) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'Invalid correction review action';
  END IF;

  SELECT * INTO v_previous FROM public.taxpay_correction_review_decisions
    WHERE message_id=v_message;
  IF FOUND THEN
    IF v_previous.payload_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Conflicting correction review replay';
    END IF;
    RETURN pg_catalog.jsonb_build_object('messageId',v_message,'stored',true,
      'duplicate',true,'reviewState',v_previous.next_state);
  END IF;

  SELECT office_review_state,office_review_revision
    INTO v_old_state,v_revision FROM public.taxpay_correction_inquiries
    WHERE inquiry_id=v_inquiry FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Correction inquiry not found'; END IF;
  IF v_expected IS DISTINCT FROM v_old_state THEN
    RAISE EXCEPTION 'Correction review state changed';
  END IF;

  v_new_state := CASE v_action
    WHEN 'MAKER_ACKNOWLEDGE' THEN 'MAKER_ACKNOWLEDGED'
    WHEN 'REVIEWER_VERIFY' THEN 'REVIEWER_VERIFIED'
    WHEN 'APPROVER_CLOSE' THEN 'APPROVER_CLOSED'
    ELSE 'REJECTED' END;
  IF (v_action='MAKER_ACKNOWLEDGE' AND v_old_state<>'PENDING_OFFICER') OR
     (v_action='REVIEWER_VERIFY' AND v_old_state<>'MAKER_ACKNOWLEDGED') OR
     (v_action='APPROVER_CLOSE' AND v_old_state<>'REVIEWER_VERIFIED') OR
     v_old_state IN ('APPROVER_CLOSED','REJECTED') THEN
    RAISE EXCEPTION 'Correction review sequence mismatch';
  END IF;
  IF (v_action='REVIEWER_VERIFY' AND EXISTS (
        SELECT 1 FROM public.taxpay_correction_review_decisions d
        WHERE d.inquiry_id=v_inquiry AND d.action_code='MAKER_ACKNOWLEDGE'
          AND d.officer_uid=v_actor)) OR
     (v_action='APPROVER_CLOSE' AND EXISTS (
        SELECT 1 FROM public.taxpay_correction_review_decisions d
        WHERE d.inquiry_id=v_inquiry
          AND d.action_code IN ('MAKER_ACKNOWLEDGE','REVIEWER_VERIFY')
          AND d.officer_uid=v_actor)) OR
     (v_action='REJECT' AND EXISTS (
        SELECT 1 FROM public.taxpay_correction_review_decisions d
        WHERE d.inquiry_id=v_inquiry AND d.officer_uid=v_actor)) THEN
    RAISE EXCEPTION 'Correction reviewers must be separate officers';
  END IF;

  INSERT INTO public.taxpay_correction_review_decisions(
    message_id,inquiry_id,idempotency_key,payload_fingerprint,officer_uid,
    officer_role,action_code,reason,previous_state,next_state)
  VALUES(v_message,v_inquiry,v_idempotency,v_fingerprint,v_actor,
    v_role,v_action,v_reason,v_old_state,v_new_state);
  UPDATE public.taxpay_correction_inquiries SET
    office_review_state=v_new_state,
    office_review_revision=v_revision+1,
    office_review_updated_at=now()
  WHERE inquiry_id=v_inquiry;

  RETURN pg_catalog.jsonb_build_object('messageId',v_message,'stored',true,
    'duplicate',false,'reviewState',v_new_state,'revision',v_revision+1);
END;
$function$;

REVOKE ALL ON FUNCTION public.taxpay_correction_internal_claim(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.taxpay_correction_internal_ack(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.taxpay_correction_record_office_decision(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_correction_internal_claim(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_correction_internal_ack(uuid,uuid,boolean,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxpay_correction_record_office_decision(jsonb) TO service_role;

COMMENT ON COLUMN public.taxpay_correction_inquiries.office_review_state IS
  'Office review status only; it does not authorize or perform a financial correction.';
COMMENT ON TABLE public.taxpay_correction_review_decisions IS
  'Signed Office review decisions for an unverified inquiry; no payment, challan, receipt or tax-credit mutation.';
COMMENT ON TABLE payment_sync.correction_outbox IS
  'Durable TaxPay-to-Office delivery queue for correction inquiries, separate from payment requests.';
COMMENT ON TABLE public.taxpay_in_app_notifications IS
  'Owner-scoped payment and correction notifications; correction decisions are read-only status events.';
COMMENT ON COLUMN public.taxpay_in_app_notifications.correction_inquiry_id IS
  'Correction history target; populated only for correction review notification events.';
COMMENT ON COLUMN public.taxpay_in_app_notifications.correction_decision_id IS
  'Unique Office decision event associated with a correction notification.';
COMMIT;
