-- First-time TaxPay fictional accounts (user7–user10).
-- Preserve ID and role for future account binding, but do not preload
-- personal profile attributes, tax heads, transactions or credits.
-- These are public synthetic test fixtures, never taxpayer records.
DO $reset$
DECLARE v_users int;
BEGIN
  SELECT count(*) INTO v_users FROM public.sim_payment_users
    WHERE id IN ('user7','user8','user9','user10');
  IF v_users <> 4 THEN
    RAISE EXCEPTION 'Expected exactly four existing synthetic new-user identities, found %',v_users;
  END IF;

  IF EXISTS (SELECT 1 FROM public.sim_payment_transactions
             WHERE payer_id IN ('user7','user8','user9','user10'))
    OR EXISTS (SELECT 1 FROM public.sim_payment_allocations
               WHERE beneficiary_id IN ('user7','user8','user9','user10'))
    OR EXISTS (SELECT 1 FROM public.sim_payment_notifications
               WHERE user_id IN ('user7','user8','user9','user10'))
    OR EXISTS (SELECT 1 FROM public.sim_payment_account_bindings
               WHERE user_id IN ('user7','user8','user9','user10'))
  THEN
    RAISE EXCEPTION 'Cannot reset accounts with payments, notifications, or assigned identities; inspect and reconcile them first';
  END IF;

  DELETE FROM public.sim_tax_service_records
    WHERE user_id IN ('user7','user8','user9','user10');

  UPDATE public.sim_payment_users
     SET name_en=NULL, name_bn=NULL, focus_en=NULL, focus_bn=NULL,
         tin_stub=NULL, jurisdiction_label=NULL
   WHERE id IN ('user7','user8','user9','user10');

  IF EXISTS (SELECT 1 FROM public.sim_tax_service_records
             WHERE user_id IN ('user7','user8','user9','user10'))
    OR EXISTS (SELECT 1 FROM public.sim_payment_users
               WHERE id IN ('user7','user8','user9','user10')
                 AND (name_en IS NOT NULL OR name_bn IS NOT NULL
                  OR focus_en IS NOT NULL OR focus_bn IS NOT NULL
                  OR tin_stub IS NOT NULL OR jurisdiction_label IS NOT NULL))
  THEN
    RAISE EXCEPTION 'New-user empty baseline failed read-back';
  END IF;
END;
$reset$;