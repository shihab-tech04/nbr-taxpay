-- TaxPay CAT-009: review-only, append-only source-change proposals.
-- Proposals can NEVER approve law, create a government economic code, or execute a payment.
-- An authenticated application account is NOT a legal/revenue officer identity.
BEGIN;
CREATE TABLE public.taxpay_head_change_proposals (
  proposal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  source_head_id integer NOT NULL,
  source_document_sha256 text NOT NULL
    CHECK (source_document_sha256 ~ '^[a-f0-9]{64}$'),
  proposed_patch jsonb NOT NULL
    CHECK (jsonb_typeof(proposed_patch) = 'object'
      AND proposed_patch <> '{}'::jsonb
      AND octet_length(proposed_patch::text) <= 16384),
  submission_reason text NOT NULL
    CHECK (length(trim(submission_reason)) BETWEEN 10 AND 1000),
  proposal_state text NOT NULL DEFAULT 'PROPOSED_UNVERIFIED'
    CHECK (proposal_state = 'PROPOSED_UNVERIFIED'),
  financial_execution_enabled boolean NOT NULL DEFAULT false
    CHECK (financial_execution_enabled = false),
  authority_reviewed boolean NOT NULL DEFAULT false
    CHECK (authority_reviewed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_key,source_head_id)
    REFERENCES public.taxpay_head_source_candidates(source_key,source_head_id)
    ON DELETE RESTRICT
);
COMMENT ON TABLE public.taxpay_head_change_proposals IS
  'Private review-only proposals for controlled v11 head records. NO tax law approval, ACS mapping, officer authorization or financial execution.';
CREATE INDEX taxpay_head_proposal_owner_idx
  ON public.taxpay_head_change_proposals(proposer_uid,created_at DESC);
CREATE INDEX taxpay_head_proposal_source_idx
  ON public.taxpay_head_change_proposals(source_key,source_head_id);
ALTER TABLE public.taxpay_head_change_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxpay_head_change_proposals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxpay_head_change_proposals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.taxpay_head_change_proposals TO authenticated;
GRANT INSERT (proposer_uid,source_key,source_head_id,source_document_sha256,
  proposed_patch,submission_reason) ON public.taxpay_head_change_proposals TO authenticated;
CREATE POLICY taxpay_proposal_select_own ON public.taxpay_head_change_proposals
  FOR SELECT TO authenticated USING ((select auth.uid()) = proposer_uid);
CREATE POLICY taxpay_proposal_insert_own ON public.taxpay_head_change_proposals
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = proposer_uid);
COMMIT;
