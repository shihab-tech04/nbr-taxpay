-- Preserve the exact TaxPay payment parent on correction inquiries.
-- Parent linkage is owner-verified; claimant, receipt and financial decisions remain pending.
BEGIN;

ALTER TABLE public.taxpay_correction_inquiries
  ADD COLUMN original_payment_id uuid
    REFERENCES demo_payment.story_payments(id),
  ADD COLUMN original_payment_kind text;

ALTER TABLE public.taxpay_correction_inquiries
  ADD CONSTRAINT taxpay_correction_parent_pair_check CHECK (
    (original_payment_id IS NULL AND original_payment_kind IS NULL)
    OR
    (original_payment_id IS NOT NULL
      AND original_payment_kind = 'TAXPAY_STORY_PAYMENT')
  ) NOT VALID;
ALTER TABLE public.taxpay_correction_inquiries
  VALIDATE CONSTRAINT taxpay_correction_parent_pair_check;

CREATE INDEX taxpay_correction_inquiries_parent_idx
  ON public.taxpay_correction_inquiries(original_payment_id)
  WHERE original_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.taxpay_bind_correction_parent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_match_count bigint;
  v_parent uuid;
BEGIN
  IF v_actor IS NULL OR NEW.requester_uid IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'AUTHENTICATED_REQUESTER_REQUIRED';
  END IF;

  SELECT count(*),
         (pg_catalog.array_agg(p.id ORDER BY p.created_at DESC,p.id DESC))[1]
    INTO v_match_count,v_parent
  FROM demo_payment.story_payments p
  JOIN public.taxpay_story1_payment_owners owner_link
    ON owner_link.payment_id=p.id
  WHERE owner_link.owner_uid=v_actor
    AND p.status='SIMULATED_SUCCESS'
    AND p.data->>'origin'='TAXPAY_UI'
    AND (
      p.id::text=NEW.original_reference
      OR p.data->>'receiptReference'=NEW.original_reference
      OR p.data->'receiptReference'->>'value'=NEW.original_reference
      OR p.data->'details'->>'receiptReference'=NEW.original_reference
      OR p.data->'details'->'receiptSnapshot'->>'challanNo'=NEW.original_reference
      OR p.data->'receiptSnapshot'->>'challanNo'=NEW.original_reference
    );

  IF v_match_count<>1 OR v_parent IS NULL THEN
    RAISE EXCEPTION 'CORRECTION_ORIGINAL_PAYMENT_NOT_LINKED';
  END IF;
  IF NEW.original_payment_id IS NOT NULL
     AND NEW.original_payment_id IS DISTINCT FROM v_parent THEN
    RAISE EXCEPTION 'CORRECTION_ORIGINAL_PAYMENT_MISMATCH';
  END IF;
  IF NEW.original_payment_kind IS NOT NULL
     AND NEW.original_payment_kind IS DISTINCT FROM 'TAXPAY_STORY_PAYMENT' THEN
    RAISE EXCEPTION 'CORRECTION_ORIGINAL_PAYMENT_KIND_INVALID';
  END IF;

  NEW.original_payment_id:=v_parent;
  NEW.original_payment_kind:='TAXPAY_STORY_PAYMENT';
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.taxpay_bind_correction_parent()
  FROM PUBLIC,anon,authenticated;

CREATE TRIGGER taxpay_correction_bind_parent_before_insert
  BEFORE INSERT ON public.taxpay_correction_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.taxpay_bind_correction_parent();

CREATE OR REPLACE FUNCTION public.taxpay_enqueue_correction_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  INSERT INTO payment_sync.correction_outbox(inquiry_id,event_payload)
  VALUES (NEW.inquiry_id, pg_catalog.jsonb_build_object(
    'originalReference',NEW.original_reference,
    'originalPaymentId',NEW.original_payment_id,
    'originalPaymentKind',NEW.original_payment_kind,
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
REVOKE ALL ON FUNCTION public.taxpay_enqueue_correction_submission()
  FROM PUBLIC,anon,authenticated;

COMMENT ON COLUMN public.taxpay_correction_inquiries.original_payment_id IS
  'Exact TaxPay demo story payment parent resolved against the authenticated owner link; nullable only for preserved legacy inquiries.';
COMMENT ON COLUMN public.taxpay_correction_inquiries.original_payment_kind IS
  'Typed source parent for the separate Office mirror; new inquiries use TAXPAY_STORY_PAYMENT.';
COMMENT ON FUNCTION public.taxpay_bind_correction_parent() IS
  'Binds a new correction inquiry to exactly one already owner-linked TaxPay story payment; typed TIN or arbitrary reference does not establish ownership.';

COMMIT;
