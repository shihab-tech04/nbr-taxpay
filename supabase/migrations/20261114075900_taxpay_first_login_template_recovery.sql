-- Sohojkor approved first-login preview journey (user7-user10).
-- The original hosted database contains four obsolete, exact fixture-name
-- templates. Remove ONLY those templates while retaining each preview
-- identity row, capability, session, beneficiary list, notice and payment.
-- Fail closed if any profile was customized or has initiated a payment.
-- This must run before 20261114080000_taxpay_phase1_preview_accounts_recovery.sql.
BEGIN;

DO $first_login_template_recovery$
DECLARE
  updated_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('user7','Sadia Islam','সাদিয়া ইসলাম','DEMO-TIN-007','circle-7'),
      ('user8','Tanvir Ahmed','তানভীর আহমেদ','DEMO-TIN-008','circle-8'),
      ('user9','Imran Hossain','ইমরান হোসেন','DEMO-TIN-009','circle-9'),
      ('user10','Shaila Parvin','শায়লা পারভীন','DEMO-TIN-010','circle-10')
    ) AS expected(id,name_en,name_bn,tin_stub,jurisdiction_label)
    LEFT JOIN public.sim_payment_users p ON p.id=expected.id
    WHERE p.id IS NULL
       OR p.role_code IS DISTINCT FROM 'TAXPAYER_INDIVIDUAL'
       OR p.name_en IS DISTINCT FROM expected.name_en
       OR p.name_bn IS DISTINCT FROM expected.name_bn
       OR p.focus_en IS DISTINCT FROM 'First-time payment'
       OR p.focus_bn IS DISTINCT FROM 'প্রথমবার পেমেন্ট'
       OR p.tin_stub IS DISTINCT FROM expected.tin_stub
       OR p.jurisdiction_label IS DISTINCT FROM expected.jurisdiction_label
  ) THEN
    RAISE EXCEPTION 'FIRST_LOGIN_TEMPLATE_CHANGED_NO_AUTOMATIC_OVERWRITE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM demo_payment.story_payments pay
    WHERE pay.data#>>'{details,payerId}' IN
      ('user7','user8','user9','user10')
  ) THEN
    RAISE EXCEPTION 'FIRST_LOGIN_HAS_PAYMENT_HISTORY_NO_AUTOMATIC_RESET';
  END IF;

  -- Do not touch the private session/capability table or any linked data.
  UPDATE public.sim_payment_users
  SET name_en=NULL, name_bn=NULL, focus_en=NULL, focus_bn=NULL,
      tin_stub=NULL, jurisdiction_label=NULL
  WHERE id IN ('user7','user8','user9','user10');

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 4 THEN
    RAISE EXCEPTION 'FIRST_LOGIN_EXPECTED_EXACTLY_FOUR_TEMPLATES';
  END IF;
END;
$first_login_template_recovery$;

COMMIT;
