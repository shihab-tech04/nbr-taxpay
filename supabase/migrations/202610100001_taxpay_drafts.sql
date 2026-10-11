-- TaxPay independent foundation migration.
-- Apply ONLY to a newly approved dedicated TaxPay Supabase project.
-- This schema creates NO legal/payment/treasury settlement or taxpayer credit.
BEGIN;

CREATE TABLE public.taxpay_payment_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('TAX_LIABILITY_PAYMENT','WITHHOLDING_TAX_DEPOSIT')),
  category text NOT NULL CHECK (category IN ('TAX_WITH_RETURN','ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT')),
  assessment_year text NOT NULL CHECK (assessment_year ~ '^20[0-9]{2}-[0-9]{2}$'),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 99999999999999),
  memo text CHECK (length(memo) <= 300),
  record_status text NOT NULL DEFAULT 'DRAFT' CHECK (record_status = 'DRAFT'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT taxpay_draft_purpose_category CHECK (
    (purpose = 'WITHHOLDING_TAX_DEPOSIT' AND category = 'SOURCE_TAX_DEPOSIT')
    OR (purpose = 'TAX_LIABILITY_PAYMENT' AND category <> 'SOURCE_TAX_DEPOSIT')
  )
);

COMMENT ON TABLE public.taxpay_payment_drafts IS 'Private planning drafts; not payment intents sent to ACS; no taxpayer identity or tax credit entitlement';
CREATE INDEX taxpay_payment_drafts_owner_date_idx ON public.taxpay_payment_drafts (owner_uid,created_at DESC);

ALTER TABLE public.taxpay_payment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxpay_payment_drafts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.taxpay_payment_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.taxpay_payment_drafts TO authenticated;
GRANT INSERT (owner_uid,purpose,category,assessment_year,amount_minor,memo) ON public.taxpay_payment_drafts TO authenticated;

CREATE POLICY taxpay_drafts_select_own ON public.taxpay_payment_drafts
  FOR SELECT TO authenticated USING ((select auth.uid()) = owner_uid);
CREATE POLICY taxpay_drafts_insert_own ON public.taxpay_payment_drafts
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = owner_uid);
CREATE POLICY taxpay_drafts_delete_own ON public.taxpay_payment_drafts
  FOR DELETE TO authenticated USING ((select auth.uid()) = owner_uid);

COMMIT;
