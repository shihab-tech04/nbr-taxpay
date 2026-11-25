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

-- The existing demo_auth_transition() already allows actor IDs up to user55,
-- but its target lookup repeated the whole user11 number 13 times, producing
-- 26-digit strings that never match the approved user11..user30 13-digit TINs.
-- Preserve the entire live authorization state machine, limits, ownership and
-- Office sync; change only the exact fictional target-TIN resolution.
CREATE OR REPLACE FUNCTION public.demo_auth_transition(p_action text, p_actor text, p_request uuid DEFAULT NULL::uuid, p_target_tin text DEFAULT NULL::text, p_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.demo_authorization_requests%rowtype;
 v_target text; v_now timestamptz:=now(); v_code text; v_bytes bytea;
begin
 if p_actor !~ '^user([1-9]|[1-4][0-9]|5[0-5])$' or not exists(select 1 from public.sim_payment_users where id=p_actor)
   then raise exception 'UNKNOWN_DEMO_USER';end if;
 if p_action='request' then
   if coalesce(p_target_tin,'') !~ '^[0-9]{13}$' then raise exception 'TIN_MUST_HAVE_13_DIGITS';end if;
   select u.id into v_target from public.sim_payment_users u
   where case
     when u.id='user10' then '1010101010101'
     when substring(u.id from 5)::integer between 1 and 9
       then repeat(substring(u.id from 5),13)
     when substring(u.id from 5)::integer between 11 and 30
       then '90000000000' || lpad(substring(u.id from 5),2,'0')
     else null end=p_target_tin;
   if v_target is null then raise exception 'TIN_NOT_FOUND';end if;
   if v_target=p_actor then raise exception 'CANNOT_AUTHORIZE_SELF';end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor||':'||v_target,0));
   if exists(select 1 from public.demo_authorization_requests a
     where a.payer_id=p_actor and a.taxpayer_id=v_target
       and (a.status='ACTIVE' or (a.status in ('PENDING','CODE_ISSUED') and a.code_expires_at>v_now)))
     then raise exception 'AUTHORIZATION_ALREADY_EXISTS';end if;
   insert into public.demo_authorization_requests(payer_id,taxpayer_id)
    values(p_actor,v_target) returning * into r;
 else
   if p_request is null then raise exception 'REQUEST_REQUIRED';end if;
   select * into r from public.demo_authorization_requests where id=p_request for update;
   if not found then raise exception 'REQUEST_NOT_FOUND';end if;
   if (p_actor=r.payer_id and r.payer_deleted_at is not null)
      or (p_actor=r.taxpayer_id and r.taxpayer_deleted_at is not null)
     then raise exception 'REQUEST_ALREADY_DELETED';end if;
   if p_action='accept' then
     if r.taxpayer_id<>p_actor or r.status<>'PENDING' or r.code_expires_at<=v_now
       then raise exception 'REQUEST_NOT_PENDING_FOR_YOU';end if;
     v_bytes:=extensions.gen_random_bytes(2);
     v_code:=lpad(((get_byte(v_bytes,0)*256+get_byte(v_bytes,1))%10000)::text,4,'0');
     update public.demo_authorization_requests set status='CODE_ISSUED',code_value=v_code,
       code_expires_at=v_now+interval '15 minutes',accepted_at=v_now,code_sent_at=v_now
       where id=r.id returning * into r;
   elsif p_action='resend' then
     if r.payer_id<>p_actor or r.status<>'CODE_ISSUED' or r.code_expires_at<=v_now
       then raise exception 'CODE_NOT_READY_OR_EXPIRED';end if;
     if r.code_resends>=3 then raise exception 'RESEND_LIMIT_REACHED';end if;
     if r.code_sent_at is not null and r.code_sent_at>v_now-interval '60 seconds'
       then raise exception 'RESEND_WAIT_60_SECONDS';end if;
     v_bytes:=extensions.gen_random_bytes(2);
     v_code:=lpad(((get_byte(v_bytes,0)*256+get_byte(v_bytes,1))%10000)::text,4,'0');
     -- Guarantee the previous code is invalid, even if the random draw repeats it.
     if v_code=r.code_value then
       v_code:=lpad(((v_code::int+1)%10000)::text,4,'0');
     end if;
     update public.demo_authorization_requests set code_value=v_code,
       code_expires_at=v_now+interval '15 minutes',code_sent_at=v_now,code_resends=code_resends+1
       where id=r.id returning * into r;
   elsif p_action='confirm' then
     if r.payer_id<>p_actor or r.status<>'CODE_ISSUED' or r.code_expires_at<=v_now
       then raise exception 'CODE_NOT_READY_OR_EXPIRED';end if;
     if coalesce(p_code,'')=r.code_value then
       update public.demo_authorization_requests set status='ACTIVE',code_value=null,confirmed_at=v_now
         where id=r.id returning * into r;
     else
       update public.demo_authorization_requests set attempts=least(3,attempts+1),
         status=case when attempts>=2 then 'DENIED' else status end,
         code_value=case when attempts>=2 then null else code_value end
         where id=r.id returning * into r;
     end if;
   elsif p_action='decline' then
     if r.taxpayer_id<>p_actor or r.status not in ('PENDING','CODE_ISSUED')
       then raise exception 'CANNOT_DECLINE';end if;
     update public.demo_authorization_requests set status='DENIED',code_value=null
       where id=r.id returning * into r;
   elsif p_action='revoke' then
     if r.taxpayer_id<>p_actor or r.status<>'ACTIVE' then raise exception 'CANNOT_REVOKE';end if;
     update public.demo_authorization_requests set status='REVOKED',revoked_at=v_now
       where id=r.id returning * into r;
   elsif p_action='delete' then
     if p_actor not in (r.payer_id,r.taxpayer_id) then raise exception 'CANNOT_DELETE';end if;
     -- Deleting an active permission revokes it for BOTH parties first.
     -- Pending requests are cancelled. The row remains for historical audit.
     update public.demo_authorization_requests set
       status=case when status='ACTIVE' then 'REVOKED'
                   when status in ('PENDING','CODE_ISSUED') then 'CANCELLED' else status end,
       code_value=null,
       revoked_at=case when status='ACTIVE' then v_now else revoked_at end,
       payer_deleted_at=case when p_actor=payer_id then v_now else payer_deleted_at end,
       taxpayer_deleted_at=case when p_actor=taxpayer_id then v_now else taxpayer_deleted_at end
       where id=r.id returning * into r;
   else raise exception 'INVALID_ACTION';
   end if;
 end if;
 return jsonb_build_object('id',r.id,'status',r.status,'payerId',r.payer_id,
  'taxpayerId',r.taxpayer_id,'attempts',r.attempts,
  'codeResends',r.code_resends,
  'consentCode',case when p_actor=r.taxpayer_id and r.status='CODE_ISSUED' then r.code_value else null end);
end;$function$;
