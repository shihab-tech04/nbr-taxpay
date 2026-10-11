-- Allow a taxpayer to resume and edit only their own private planning draft.
-- No payment, settlement, refund, receipt, or taxpayer-credit operation is added.
BEGIN;

GRANT UPDATE (purpose, category, assessment_year, amount_minor, memo)
  ON public.taxpay_payment_drafts TO authenticated;

CREATE POLICY taxpay_drafts_update_own ON public.taxpay_payment_drafts
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = owner_uid)
  WITH CHECK ((select auth.uid()) = owner_uid);

COMMIT;
