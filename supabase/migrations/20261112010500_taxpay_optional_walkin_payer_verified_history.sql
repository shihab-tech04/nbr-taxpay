-- F-167 / US-168: optional payer TIN on guest Other Tax.
-- Existing public payment and Office mirror records are immutable.
-- A typed TIN never creates an Auth account, owner binding, or session claim.
-- Only a pre-existing approver-assigned, email-confirmed account binding may
-- later identify the owner of a matching guest payer transaction.

-- Canonical alias of the existing 30 fictional public lookup profiles.
-- Keep consistent with src/data/sampleTinSuggestions.ts.
CREATE OR REPLACE FUNCTION taxpay_guest_private.walkin_sample_tin(p_profile text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path TO ''
AS $walkin_alias$
DECLARE v_number integer;
BEGIN
  IF p_profile IS NULL OR p_profile !~ '^user([1-9]|[12][0-9]|30)$' THEN
    RETURN NULL;
  END IF;
  v_number := substring(p_profile from 5)::integer;
  RETURN CASE
    WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,12)
    WHEN v_number = 10 THEN repeat('0',12)
    WHEN v_number BETWEEN 11 AND 30 THEN '9090000000'||lpad(v_number::text,2,'0')
    ELSE NULL
  END;
END;
$walkin_alias$;
REVOKE ALL ON FUNCTION taxpay_guest_private.walkin_sample_tin(text)
  FROM PUBLIC, anon, authenticated;

-- Reject forged/unmatched payer identities at the database boundary.
-- This does not assert government TIN verification: the approved 30 profiles
-- are fictional TaxPay lookup fixtures, not taxpayer credentials.
CREATE OR REPLACE FUNCTION demo_payment.validate_walkin_payer_tin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $walkin_guard$
DECLARE
  v_tin text;
  v_number integer;
  v_name_en text;
  v_name_bn text;
  v_name text;
  v_snapshot jsonb;
BEGIN
  IF NEW.service_code IS DISTINCT FROM 'OTHER_TAX_PAYMENT'
     OR NEW.data->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
     OR NEW.data->'details'->>'payerMode' IS DISTINCT FROM 'OTHER'
     OR nullif(NEW.data->'details'->>'payerId','') IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  v_tin := btrim(coalesce(NEW.data->'details'->>'payerTin',''));
  IF v_tin IN ('','GUEST') THEN
    RETURN NEW; -- Original no-TIN guest journey is unchanged.
  END IF;
  IF v_tin !~ '^[0-9]{12}$' THEN
    RAISE EXCEPTION 'INVALID_WALKIN_PAYER_TIN';
  END IF;

  -- Select by exact trusted lookup aliases, not a browser-supplied user ID.
  SELECT n INTO v_number FROM pg_catalog.generate_series(1,30) n
  WHERE taxpay_guest_private.walkin_sample_tin('user'||n::text) = v_tin;
  IF v_number IS NULL THEN
    RAISE EXCEPTION 'UNMATCHED_WALKIN_PAYER_TIN';
  END IF;
  v_name_en := CASE WHEN v_number <= 10 THEN 'User ' ELSE 'Taxpayer Account ' END || v_number::text;
  v_name_bn := CASE WHEN v_number <= 10 THEN 'ইউজার ' ELSE 'করদাতা অ্যাকাউন্ট ' END || v_number::text;
  v_name := NEW.data->'details'->>'payerName';
  v_snapshot := NEW.data->'details'->'receiptSnapshot';
  IF v_name IS NULL OR v_name NOT IN (v_name_en,v_name_bn)
     OR jsonb_typeof(v_snapshot) IS DISTINCT FROM 'object'
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
DROP TRIGGER IF EXISTS story1_walkin_payer_tin_guard ON demo_payment.story_payments;
CREATE TRIGGER story1_walkin_payer_tin_guard
BEFORE INSERT ON demo_payment.story_payments
FOR EACH ROW EXECUTE FUNCTION demo_payment.validate_walkin_payer_tin();

-- The account may read its history only after the existing verified admin
-- binding already associates auth.uid() with the fictional payer profile.
-- Never infer the owner from a guest-provided TIN, contact, or session UUID.
CREATE OR REPLACE FUNCTION public.taxpay_claim_walkin_payer_payments()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $walkin_claim$
DECLARE
  v_owner uuid := auth.uid();
  v_profile text;
  v_tin text;
  v_number integer;
  v_name_en text;
  v_name_bn text;
  v_count integer := 0;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'SIGN_IN_REQUIRED';
  END IF;
  SELECT b.user_id INTO v_profile
  FROM public.sim_payment_account_bindings b
  WHERE b.owner_uid = v_owner;
  IF v_profile IS NULL THEN
    RETURN 0; -- Never automatically assign unlinked accounts.
  END IF;
  v_tin := taxpay_guest_private.walkin_sample_tin(v_profile);
  IF v_tin IS NULL THEN
    RETURN 0;
  END IF;
  v_number := substring(v_profile from 5)::integer;
  v_name_en := CASE WHEN v_number <= 10 THEN 'User ' ELSE 'Taxpayer Account ' END || v_number::text;
  v_name_bn := CASE WHEN v_number <= 10 THEN 'ইউজার ' ELSE 'করদাতা অ্যাকাউন্ট ' END || v_number::text;

  INSERT INTO public.taxpay_story1_payment_owners(payment_id,owner_uid)
  SELECT payment.id,v_owner
  FROM demo_payment.story_payments payment
  WHERE payment.status = 'SIMULATED_SUCCESS'
    AND payment.service_code = 'OTHER_TAX_PAYMENT'
    AND payment.data->>'origin' = 'TAXPAY_UI'
    AND payment.data->'details'->>'payerMode' = 'OTHER'
    AND nullif(payment.data->'details'->>'payerId','') IS NULL
    AND payment.data->'details'->>'payerTin' = v_tin
    AND payment.data->'details'->'receiptSnapshot'->>'payerTin' = v_tin
    AND payment.data->'details'->>'payerName' IN (v_name_en,v_name_bn)
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
