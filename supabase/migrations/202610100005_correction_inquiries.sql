-- COR-001 v1: private evidence-pending inquiry ONLY.
-- Not a financial correction case, no official receipt / ownership proof, no officer approval.
BEGIN;
CREATE TABLE public.taxpay_correction_inquiries (
  inquiry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_reference text NOT NULL
    CHECK (original_reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{5,79}$'),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 1000),
  requested_outcome text NOT NULL CHECK (length(trim(requested_outcome)) BETWEEN 10 AND 600),
  evidence_state text NOT NULL DEFAULT 'PENDING_EVIDENCE'
    CHECK (evidence_state = 'PENDING_EVIDENCE'),
  claimant_verified boolean NOT NULL DEFAULT false CHECK (claimant_verified = false),
  original_receipt_verified boolean NOT NULL DEFAULT false CHECK (original_receipt_verified = false),
  may_change_financial_records boolean NOT NULL DEFAULT false CHECK (may_change_financial_records = false),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.taxpay_correction_inquiries IS
  'Unverified user-supplied correction inquiry; NOT an NBR financial correction, challan, refund or credit';
CREATE INDEX taxpay_correction_inquiries_owner_created_idx
  ON public.taxpay_correction_inquiries (requester_uid,created_at DESC);
ALTER TABLE public.taxpay_correction_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxpay_correction_inquiries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxpay_correction_inquiries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.taxpay_correction_inquiries TO authenticated;
GRANT INSERT (requester_uid, original_reference, reason, requested_outcome)
  ON public.taxpay_correction_inquiries TO authenticated;
CREATE POLICY taxpay_correction_inquiry_select_own
  ON public.taxpay_correction_inquiries FOR SELECT TO authenticated
  USING ((select auth.uid()) = requester_uid);
CREATE POLICY taxpay_correction_inquiry_insert_own
  ON public.taxpay_correction_inquiries FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = requester_uid);
COMMIT;
