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
  -- Other installations may already have empty rows or no preview rows;
  -- both are valid and must remain unchanged. Reject customized identities.
  IF EXISTS (
    SELECT 1 FROM public.sim_payment_users p
    WHERE p.id IN ('user7','user8','user9','user10')
      AND NOT (
        p.role_code='TAXPAYER_INDIVIDUAL'
        AND (
          (p.name_en IS NULL AND p.name_bn IS NULL
           AND p.focus_en IS NULL AND p.focus_bn IS NULL
           AND p.tin_stub IS NULL AND p.jurisdiction_label IS NULL)
          OR EXISTS (
            SELECT 1 FROM (VALUES
              ('user7','Sadia Islam','সাদিয়া ইসলাম','DEMO-TIN-007','circle-7'),
              ('user8','Tanvir Ahmed','তানভীর আহমেদ','DEMO-TIN-008','circle-8'),
              ('user9','Imran Hossain','ইমরান হোসেন','DEMO-TIN-009','circle-9'),
              ('user10','Shaila Parvin','শায়লা পারভীন','DEMO-TIN-010','circle-10')
            ) AS expected(id,name_en,name_bn,tin_stub,jurisdiction_label)
            WHERE p.id=expected.id AND p.name_en=expected.name_en
              AND p.name_bn=expected.name_bn
              AND p.focus_en='First-time payment'
              AND p.focus_bn='প্রথমবার পেমেন্ট'
              AND p.tin_stub=expected.tin_stub
              AND p.jurisdiction_label=expected.jurisdiction_label
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'FIRST_LOGIN_TEMPLATE_CHANGED_NO_AUTOMATIC_OVERWRITE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM demo_payment.story_payments pay
    JOIN public.sim_payment_users p
      ON pay.data#>>'{details,payerId}'=p.id
    WHERE p.id IN ('user7','user8','user9','user10')
      AND p.focus_en='First-time payment'
      AND p.tin_stub IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FIRST_LOGIN_HAS_PAYMENT_HISTORY_NO_AUTOMATIC_RESET';
  END IF;

  -- Do not touch the private session/capability table or any linked data.
  UPDATE public.sim_payment_users
  SET name_en=NULL, name_bn=NULL, focus_en=NULL, focus_bn=NULL,
      tin_stub=NULL, jurisdiction_label=NULL
  WHERE id IN ('user7','user8','user9','user10')
    AND focus_en='First-time payment'
    AND focus_bn='প্রথমবার পেমেন্ট'
    AND tin_stub IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 4 THEN
    RAISE EXCEPTION 'FIRST_LOGIN_TOO_MANY_UPDATED_ROWS';
  END IF;
END;
$first_login_template_recovery$;

COMMIT;
