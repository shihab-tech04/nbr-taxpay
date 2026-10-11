-- COR-002: add unverified before/after values to evidence-pending inquiries.
-- This is not approval, a Treasury record modification, or an NBR attribution change.
BEGIN;
ALTER TABLE public.taxpay_correction_inquiries
 ADD COLUMN change_kind text,
 ADD COLUMN old_value text,
 ADD COLUMN new_value text,
 ADD CONSTRAINT taxpay_correction_inquiry_consistent_change CHECK (
 (change_kind IS NULL AND old_value IS NULL AND new_value IS NULL)
 OR (change_kind IN ('ASSESSMENT_YEAR','CIRCLE','PAYMENT_HEAD','ATTRIBUTION')
  AND old_value IS NOT NULL AND new_value IS NOT NULL
  AND length(trim(old_value)) BETWEEN 1 AND 120
  AND length(trim(new_value)) BETWEEN 1 AND 120
  AND lower(trim(old_value)) <> lower(trim(new_value))
 ));
GRANT INSERT (change_kind,old_value,new_value)
 ON public.taxpay_correction_inquiries TO authenticated;
COMMENT ON COLUMN public.taxpay_correction_inquiries.change_kind IS
 'User-requested unverified attribution field: NOT a real financial correction';
COMMIT;
