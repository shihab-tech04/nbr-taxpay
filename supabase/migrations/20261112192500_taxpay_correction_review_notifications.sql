-- Owner-scoped TaxPay notifications for Office correction review decisions.
-- This extends the existing inbox with correction history references only.
-- It does not change payment, receipt, settlement, or tax-credit records.
BEGIN;

-- Preserve the existing payment notice target and add a distinct correction target.
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

COMMENT ON TABLE public.taxpay_in_app_notifications IS
  'Owner-scoped payment and correction notifications; correction decisions are read-only status events.';
COMMENT ON COLUMN public.taxpay_in_app_notifications.correction_inquiry_id IS
  'Correction history target; populated only for correction review notification events.';
COMMENT ON COLUMN public.taxpay_in_app_notifications.correction_decision_id IS
  'Unique Office decision event associated with a correction notification.';

COMMIT;
