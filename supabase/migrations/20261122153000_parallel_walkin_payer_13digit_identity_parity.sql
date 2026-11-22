-- Parallel All Tax Payments only: align the optional confirmed Walk-in payer
-- with the approved 12-digit lookup aliases AND the 30 exact 13-digit demo
-- account identifiers. Preserve the pre-existing original payment journey.
-- This is synthetic-only identity matching, not an official tax identity check.
-- This helper is private, callable only by the two existing SECURITY DEFINER
-- functions; do NOT make it a public identity-discovery or payment API.

CREATE OR REPLACE FUNCTION taxpay_guest_private.walkin_confirmed_payer(p_tin text)
RETURNS TABLE(profile_id text, name_en text, name_bn text)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO ''
AS $walkin_payer_alias$
  SELECT 'user' || n.i::text,
    CASE
      WHEN char_length(p_tin) = 12 THEN
        CASE WHEN n.i <= 10 THEN 'User ' ELSE 'Taxpayer Account ' END || n.i::text
      ELSE
        CASE n.i
          WHEN 1 THEN 'Md. Arif Rahman'
          WHEN 2 THEN 'Meghna Trading Ltd.'
          WHEN 3 THEN 'Rupali Textiles Ltd.'
          WHEN 4 THEN 'Nusrat Jahan'
          WHEN 5 THEN 'Mahmud Hasan'
          WHEN 6 THEN 'Farzana Akter'
          WHEN 7 THEN 'Sadia Islam'
          WHEN 8 THEN 'Tanvir Ahmed'
          WHEN 9 THEN 'Imran Hossain'
          WHEN 10 THEN 'Shaila Parvin'
          ELSE 'Taxpayer Account ' || n.i::text
        END
    END,
    CASE
      WHEN char_length(p_tin) = 12 THEN
        CASE WHEN n.i <= 10 THEN 'ইউজার ' ELSE 'করদাতা অ্যাকাউন্ট ' END || n.i::text
      ELSE
        CASE n.i
          WHEN 1 THEN 'মো. আরিফ রহমান'
          WHEN 2 THEN 'মেঘনা ট্রেডিং লিমিটেড'
          WHEN 3 THEN 'রূপালী টেক্সটাইলস লিমিটেড'
          WHEN 4 THEN 'নুসরাত জাহান'
          WHEN 5 THEN 'মাহমুদ হাসান'
          WHEN 6 THEN 'ফারজানা আক্তার'
          WHEN 7 THEN 'সাদিয়া ইসলাম'
          WHEN 8 THEN 'তানভীর আহমেদ'
          WHEN 9 THEN 'ইমরান হোসেন'
          WHEN 10 THEN 'শায়লা পারভীন'
          ELSE 'করদাতা অ্যাকাউন্ট ' || n.i::text
        END
    END
  FROM pg_catalog.generate_series(1, 30) AS n(i)
  WHERE p_tin = CASE
    WHEN char_length(p_tin) = 12
      THEN taxpay_guest_private.walkin_sample_tin('user' || n.i::text)
    WHEN n.i BETWEEN 1 AND 9 THEN pg_catalog.repeat(n.i::text, 13)
    WHEN n.i = 10 THEN '1010101010101'
    ELSE '90000000000' || pg_catalog.lpad(n.i::text, 2, '0')
  END;
$walkin_payer_alias$;

REVOKE ALL ON FUNCTION taxpay_guest_private.walkin_confirmed_payer(text)
  FROM PUBLIC, anon, authenticated;

-- Keep existing strict capability/session path, exact matched payer identity,
-- blank optional TIN, original 12-digit aliases and immutable receipt snapshot.
CREATE OR REPLACE FUNCTION demo_payment.validate_walkin_payer_tin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $walkin_guard$
DECLARE
  v_tin text;
  v_profile text;
  v_name_en text;
  v_name_bn text;
  v_name text;
  v_snapshot jsonb;
BEGIN
  IF NEW.service_code IS DISTINCT FROM 'OTHER_TAX_PAYMENT'
     OR NEW.data->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
     OR NEW.data->'details'->>'payerMode' IS DISTINCT FROM 'OTHER'
  THEN
    RETURN NEW;
  END IF;

  IF nullif(NEW.data->'details'->>'payerId','') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM taxpay_guest_private.demo_profiles p
      WHERE p.demo_id = NEW.data->'details'->>'payerId'
        AND p.payment_session_id = NEW.session_id
    ) THEN
      RAISE EXCEPTION 'UNAUTHORIZED_WALKIN_PAYER_ID';
    END IF;
    RETURN NEW;
  END IF;

  v_tin := pg_catalog.btrim(coalesce(NEW.data->'details'->>'payerTin',''));
  IF v_tin IN ('','GUEST') THEN
    RETURN NEW;
  END IF;
  IF v_tin !~ '^[0-9]{12,13}$' THEN
    RAISE EXCEPTION 'INVALID_WALKIN_PAYER_TIN';
  END IF;

  SELECT matched.profile_id, matched.name_en, matched.name_bn
    INTO v_profile, v_name_en, v_name_bn
  FROM taxpay_guest_private.walkin_confirmed_payer(v_tin) matched;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'UNMATCHED_WALKIN_PAYER_TIN';
  END IF;
  v_name := NEW.data->'details'->>'payerName';
  v_snapshot := NEW.data->'details'->'receiptSnapshot';
  IF v_name IS NULL OR v_name NOT IN (v_name_en,v_name_bn)
     OR pg_catalog.jsonb_typeof(v_snapshot) IS DISTINCT FROM 'object'
     OR v_snapshot->>'payerTin' IS DISTINCT FROM v_tin
     OR v_snapshot->>'payerName' IS DISTINCT FROM v_name
  THEN
    RAISE EXCEPTION 'UNCONFIRMED_WALKIN_PAYER';
  END IF;
  RETURN NEW;
END;
$walkin_guard$;

REVOKE ALL ON FUNCTION demo_payment.validate_walkin_payer_tin()
  FROM PUBLIC, anon, authenticated;

-- A matched payer TIN NEVER grants account history by itself. Keep the
-- pre-existing admin-assigned, email-confirmed auth owner binding as mandatory.
-- Extend history claim to the same trusted 13-digit demo aliases; preserve all
-- original claim checks and idempotent ON CONFLICT behavior.
CREATE OR REPLACE FUNCTION public.taxpay_claim_walkin_payer_payments()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $walkin_claim$
DECLARE
  v_owner uuid := auth.uid();
  v_profile text;
  v_count integer := 0;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'SIGN_IN_REQUIRED';
  END IF;
  SELECT b.user_id INTO v_profile
  FROM public.sim_payment_account_bindings b
  JOIN auth.users verified_account
    ON verified_account.id = b.owner_uid
   AND verified_account.email_confirmed_at IS NOT NULL
  WHERE b.owner_uid = v_owner;
  IF v_profile IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.taxpay_story1_payment_owners(payment_id,owner_uid)
  SELECT payment.id,v_owner
  FROM demo_payment.story_payments payment
  JOIN LATERAL taxpay_guest_private.walkin_confirmed_payer(
    payment.data->'details'->>'payerTin'
  ) matched ON matched.profile_id = v_profile
  WHERE payment.status = 'SIMULATED_SUCCESS'
    AND payment.service_code = 'OTHER_TAX_PAYMENT'
    AND payment.data->>'origin' = 'TAXPAY_UI'
    AND payment.data->'details'->>'payerMode' = 'OTHER'
    AND nullif(payment.data->'details'->>'payerId','') IS NULL
    AND payment.data->'details'->'receiptSnapshot'->>'payerTin'
        = payment.data->'details'->>'payerTin'
    AND payment.data->'details'->>'payerName' IN (matched.name_en,matched.name_bn)
    AND payment.data->'details'->'receiptSnapshot'->>'payerName'
        = payment.data->'details'->>'payerName'
  ON CONFLICT (payment_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$walkin_claim$;
REVOKE ALL ON FUNCTION public.taxpay_claim_walkin_payer_payments()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.taxpay_claim_walkin_payer_payments()
  TO authenticated;
