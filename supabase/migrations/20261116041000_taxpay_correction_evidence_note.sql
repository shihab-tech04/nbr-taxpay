-- Phase 6: preserve the approved Office supporting-evidence field with every
-- new authenticated Taxpayer correction inquiry. Old requests remain readable.
-- Evidence is descriptive only; it never changes payment/credit state.
BEGIN;
ALTER TABLE public.taxpay_correction_inquiries
  ADD COLUMN evidence_note text;
ALTER TABLE public.taxpay_correction_inquiries
  ADD CONSTRAINT taxpay_correction_evidence_note_size_check
  CHECK (evidence_note IS NULL OR
         (pg_catalog.char_length(evidence_note)<=2000 AND
          pg_catalog.octet_length(evidence_note)<=8000)) NOT VALID;
ALTER TABLE public.taxpay_correction_inquiries
  VALIDATE CONSTRAINT taxpay_correction_evidence_note_size_check;
GRANT INSERT(evidence_note) ON public.taxpay_correction_inquiries TO authenticated;

CREATE OR REPLACE FUNCTION public.taxpay_enqueue_correction_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  INSERT INTO payment_sync.correction_outbox(inquiry_id,event_payload)
  VALUES (NEW.inquiry_id, pg_catalog.jsonb_build_object(
    'originalReference',NEW.original_reference,
    'originalPaymentId',NEW.original_payment_id,
    'originalPaymentKind',NEW.original_payment_kind,
    'targetAllocationId',NEW.target_allocation_id,
    'caseKind',NEW.case_kind,
    'reason',NEW.reason,
    'evidenceNote',NEW.evidence_note,
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
REVOKE ALL ON FUNCTION public.taxpay_enqueue_correction_submission()
  FROM PUBLIC,anon,authenticated;
COMMENT ON COLUMN public.taxpay_correction_inquiries.evidence_note IS
  'Taxpayer-supplied supporting evidence notes, max 2000 Unicode characters; unverified, mirrored for Office review without changing original payment.';
COMMIT;
