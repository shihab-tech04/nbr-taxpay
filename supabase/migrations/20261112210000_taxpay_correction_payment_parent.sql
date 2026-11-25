-- Preserve the exact TaxPay payment parent on correction inquiries.
-- Parent linkage is owner-verified; claimant, receipt and financial decisions remain pending.
BEGIN;

-- Distinguish an allegation about an unsolicited payment from a correction
-- proposal, without interpreting the allegation as a reversal or ownership.
-- Existing cases retain the original CORRECTION_REVIEW classification.
ALTER TABLE public.taxpay_correction_inquiries
  ADD COLUMN case_kind text NOT NULL DEFAULT 'CORRECTION_REVIEW';
ALTER TABLE public.taxpay_correction_inquiries
  ADD CONSTRAINT taxpay_correction_case_kind_check
  CHECK (case_kind IN ('CORRECTION_REVIEW','UNSOLICITED_PAYMENT_REPORT')) NOT VALID;
ALTER TABLE public.taxpay_correction_inquiries
  VALIDATE CONSTRAINT taxpay_correction_case_kind_check;

-- Reuse the existing authenticated requester RLS; no anonymous permission.
GRANT INSERT (case_kind), SELECT (case_kind)
  ON TABLE public.taxpay_correction_inquiries TO authenticated;

-- A beneficiary may request review only for a unique allocation matching
-- an existing verified account/TIN binding; arbitrary typed TIN is insufficient.
ALTER TABLE public.taxpay_correction_inquiries
  ADD COLUMN target_allocation_id text;
ALTER TABLE public.taxpay_correction_inquiries
  ADD CONSTRAINT taxpay_correction_target_allocation_id_check CHECK (
    target_allocation_id IS NULL OR
    (length(target_allocation_id) BETWEEN 1 AND 128 AND
      target_allocation_id = pg_catalog.btrim(target_allocation_id))
  ) NOT VALID;
ALTER TABLE public.taxpay_correction_inquiries
  VALIDATE CONSTRAINT taxpay_correction_target_allocation_id_check;
GRANT INSERT (target_allocation_id), SELECT (target_allocation_id)
  ON TABLE public.taxpay_correction_inquiries TO authenticated;

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
  v_allocation_matches bigint;
BEGIN
  IF v_actor IS NULL OR NEW.requester_uid IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'AUTHENTICATED_REQUESTER_REQUIRED';
  END IF;

  SELECT count(*),
         (pg_catalog.array_agg(p.id ORDER BY p.created_at DESC,p.id DESC))[1]
    INTO v_match_count,v_parent
  FROM demo_payment.story_payments p
  WHERE p.status='SIMULATED_SUCCESS'
    AND p.data->>'origin'='TAXPAY_UI'
    AND (
      EXISTS (SELECT 1 FROM public.taxpay_story1_payment_owners owner_link
        WHERE owner_link.payment_id=p.id AND owner_link.owner_uid=v_actor)
      OR (
        NEW.target_allocation_id IS NOT NULL AND
        EXISTS (
          SELECT 1
          FROM public.sim_payment_account_bindings b
          JOIN public.taxpay_taxpayer_registration_profiles profile
            ON profile.account_id=b.user_id
          CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
            CASE WHEN pg_catalog.jsonb_typeof(p.data#>'{details,allocations}')='array'
            THEN p.data#>'{details,allocations}' ELSE '[]'::jsonb END
          ) AS alloc(line)
          WHERE b.owner_uid=v_actor
            AND alloc.line->>'allocationId'=NEW.target_allocation_id
            AND alloc.line->>'taxpayerTin'=profile.tin
        )
      )
    )
    AND (
      p.id::text=NEW.original_reference
      OR p.data->'details'->>'receiptReference'=NEW.original_reference
      OR p.data->'details'->'receiptSnapshot'->>'challanNo'=NEW.original_reference
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
  IF NEW.target_allocation_id IS NOT NULL THEN
    SELECT count(*) INTO v_allocation_matches
    FROM demo_payment.story_payments p
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(p.data#>'{details,allocations}')='array'
      THEN p.data#>'{details,allocations}' ELSE '[]'::jsonb END
    ) AS alloc(line)
    WHERE p.id=v_parent AND alloc.line->>'allocationId'=NEW.target_allocation_id;
    IF v_allocation_matches<>1 THEN
      RAISE EXCEPTION 'CORRECTION_TARGET_ALLOCATION_INVALID';
    END IF;
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
    'targetAllocationId',NEW.target_allocation_id,
    'caseKind',NEW.case_kind,
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

COMMENT ON COLUMN public.taxpay_correction_inquiries.target_allocation_id IS
  'Optional exact source allocation ID. A non-payer requester must have a verified account TIN matching this allocation; never infer ownership from a typed TIN.';
COMMENT ON COLUMN public.taxpay_correction_inquiries.case_kind IS
  'Owner-verified correction review versus unsolicited-payment allegation; neither category changes financial records.';
COMMENT ON COLUMN public.taxpay_correction_inquiries.original_payment_id IS
  'Exact TaxPay demo story payment parent resolved against the authenticated owner link; nullable only for preserved legacy inquiries.';
COMMENT ON COLUMN public.taxpay_correction_inquiries.original_payment_kind IS
  'Typed source parent for the separate Office mirror; new inquiries use TAXPAY_STORY_PAYMENT.';
COMMENT ON FUNCTION public.taxpay_bind_correction_parent() IS
  'Binds an owner payment or one exact allocation matching an existing verified account/TIN binding; typed TIN, request reference, or actor claim alone never establishes entitlement.';

COMMIT;
