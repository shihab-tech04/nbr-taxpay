-- Canonical acceptance checks for synthetic (not Treasury) combined payments.
-- Head metadata is a frozen transcription from the same approved v11 source
-- used by OtherTaxBatchComposer; it is NOT an official/legal ACS mapping.
-- Stored historical payments and unrelated Office SQL are never rewritten.
CREATE TABLE IF NOT EXISTS demo_payment.taxpay_combined_demo_heads (
  head_id integer PRIMARY KEY,
  code_en text NOT NULL,
  name_en text NOT NULL,
  category text NOT NULL
);
ALTER TABLE demo_payment.taxpay_combined_demo_heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON demo_payment.taxpay_combined_demo_heads FROM PUBLIC, anon, authenticated;
INSERT INTO demo_payment.taxpay_combined_demo_heads(head_id,code_en,name_en,category)
VALUES
  (1,'16A','Surcharge','other_head'),
  (2,'16F','Distributing Excess Stock dividend','other_head'),
  (3,'16G','Maintaing excess retained earning','other_head'),
  (4,'19AAAA','Tax for undisclosed investment in stock market','other_head'),
  (6,'19BBBBB','Tax on undisclosed investment in flat, house,land','other_head'),
  (7,'19DD','Investing in Economic Zone','other_head'),
  (118,'57','Penalty for no deduction','penalty'),
  (119,'57A','Consequences of the issuance of fake certificate of tax deduction','penalty'),
  (120,'63','Payment of tax where no deduction is made','demand'),
  (121,'64','Advance Tax','advance'),
  (122,'68A','Advance tax on cigarrete manufacturer','advance'),
  (123,'68B','Advance tax for the owners of private motor car','advance'),
  (124,'73A','Delay interest','other_head'),
  (126,'102','Shipping business of non-residents','other_head'),
  (127,'103A','Airlines business of non residents','other_head'),
  (128,'107G','Penalty in failure of Statement of International Transaction','penalty'),
  (129,'107H','Penalty for non complaince of notice of TPO','penalty'),
  (130,'107HH','Penalty for non submission of TP return','penalty'),
  (131,'123(1)','Penalty for not maintaining account','penalty'),
  (132,'123(2)','Penalty for not depositing house rent through bank','penalty'),
  (133,'124(1)','Penalty for non submission of return','penalty'),
  (134,'124(2)','Penalty for non filing or furnishing of Withholding tax return, certificate and other statement','penalty'),
  (135,'124(3)','Penalty for not showing TIN certificate u/s 184C','penalty'),
  (136,'124(4)','Penalty for non furnishing information u/s 113','penalty'),
  (137,'124A','Penalty for using fake TIN','penalty'),
  (138,'124AA','Penalty for failure to verify Taxpayer’s Identification Number, etc','penalty'),
  (139,'125','Penalty for failure to pay advance tax','penalty'),
  (140,'126','Penalty for non compliance of notice','penalty'),
  (141,'127','Penalty for not paying tax u/s 74','penalty'),
  (142,'128','Penalty for concealment of income','penalty'),
  (143,'129A','Penalty for incorrect or false audit report by chartered accountant.','penalty'),
  (144,'129B','Penalty for furnishing fake audit report','penalty'),
  (145,'135','Tax on notice of demand','demand'),
  (146,'137','Penalty for default in payment of tax','penalty'),
  (147,'158','Tax for case heraing in Applleate Tribunal','tribunal'),
  (148,'SRO214','Presumptive tax on inland water carriers','other_head'),
  (149,'SRO215','Presumptive tax on Bus Truck, Minibus etc','other_head'),
  (151,'184C','Displaying proof of submission of return','penalty'),
  (152,'19F','Special Tax Treatment in respect of undisclosed offshore assets','other_head'),
  (153,'19G','Penalty for any offshore asset not disclosed in the return','penalty')
ON CONFLICT(head_id) DO UPDATE SET code_en=EXCLUDED.code_en,
  name_en=EXCLUDED.name_en, category=EXCLUDED.category;

CREATE OR REPLACE FUNCTION demo_payment.validate_demo_authorized_payment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_payer text;
  v_lines jsonb;
  v_line jsonb;
  v_beneficiary text;
  v_auth uuid;
  v_amount bigint;
  v_sum bigint := 0;
  v_tin text;
  v_number integer;
  v_expected13 text;
  v_expected12 text;
  v_saved boolean;
  v_allowed_tin boolean;
  v_allocations jsonb;
  v_snapshot jsonb;
  v_allocation jsonb;
  v_allocation_view jsonb;
  v_i integer;
  v_count integer;
  v_mode text;
  v_year text;
  v_key text;
  v_seen text[] := ARRAY[]::text[];
  v_seen_tins text[] := ARRAY[]::text[];
  v_head record;
BEGIN
  v_payer := new.data->'details'->>'payerId';
  -- Preserve earlier public single-service paths (including Travel Tax) until
  -- their distinct contracts are migrated; combined public rows now validate.
  IF v_payer IS NULL AND new.data->'details'->>'combinedPayment' IS DISTINCT FROM 'true' THEN RETURN new; END IF;
  IF v_payer IS NOT NULL AND
     (v_payer !~ '^user([1-9]|[12][0-9]|30)$' OR
      NOT EXISTS (SELECT 1 FROM public.sim_payment_users WHERE id=v_payer))
  THEN RAISE EXCEPTION 'INVALID_DEMO_PAYER'; END IF;
  v_lines := new.data->'details'->'lines';
  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_array_length(v_lines) NOT BETWEEN 1 AND
    (CASE WHEN new.data->'details'->>'combinedPayment' = 'true' THEN 256 ELSE 20 END)
  THEN RAISE EXCEPTION 'INVALID_BENEFICIARY_LINES'; END IF;
  -- One Office-compatible payment transaction, many independently verified
  -- taxpayer allocations. Keep accounting heads in details.lines and explicit
  -- beneficiary shares in details.allocations; never mix synthetic user IDs.
  IF new.data->'details'->>'combinedPayment' = 'true' THEN
    v_mode := new.data->'details'->>'payerMode';
    v_allocations := new.data->'details'->'allocations';
    v_snapshot := new.data->'details'->'receiptSnapshot';
    v_count := jsonb_array_length(v_lines);
    IF new.data->>'origin' <> 'TAXPAY_UI' THEN RAISE EXCEPTION 'INVALID_COMBINED_ORIGIN'; END IF;
    IF new.service_code <> 'OTHER_TAX_PAYMENT'
       OR v_mode IS NULL OR v_mode NOT IN ('OTHER','SELF')
       OR jsonb_typeof(v_allocations) IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_snapshot) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_snapshot->'items') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_snapshot->'allocationItems') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_allocations) <> v_count
       OR jsonb_array_length(v_snapshot->'items') <> v_count
       OR jsonb_array_length(v_snapshot->'allocationItems') <> v_count
       OR coalesce(new.data->'details'->>'allocationCount','') <> v_count::text
       OR v_snapshot->>'paymentCategory' <> 'OTHER_TAX_PAYMENT'
       OR v_snapshot->>'challanNo' <> 'SIM-' || new.idempotency_key::text
       OR v_snapshot->>'challanNo' IS DISTINCT FROM new.data->'details'->>'receiptReference'
       OR coalesce(v_snapshot->>'totalAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
       OR (v_snapshot->>'totalAmount')::numeric * 100 <> new.amount_minor
    THEN RAISE EXCEPTION 'INVALID_COMBINED_PAYMENT'; END IF;

    FOR v_i IN 0..v_count - 1 LOOP
      v_line := v_lines->v_i;
      v_allocation := v_allocations->v_i;
      v_allocation_view := v_snapshot->'allocationItems'->v_i;
      v_tin := btrim(coalesce(v_allocation->>'taxpayerTin',''));
      IF jsonb_typeof(v_line) <> 'object'
        OR jsonb_typeof(v_allocation) <> 'object'
        OR jsonb_typeof(v_allocation_view) <> 'object'
        OR v_tin !~ '^[0-9]{12,13}$'
        OR coalesce(v_allocation->>'assessmentYear','') = ''
        OR coalesce(v_allocation->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$'
        OR coalesce(v_allocation->>'headId','') !~ '^[1-9][0-9]{0,8}$'
        OR v_line->>'headId' IS DISTINCT FROM v_allocation->>'headId'
        OR (v_snapshot->'items'->v_i) IS DISTINCT FROM v_line
        OR coalesce(v_line->>'totalAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$'
        OR (v_line->>'totalAmount')::numeric * 100 <> (v_allocation->>'amountMinor')::bigint
        OR v_allocation_view->>'taxpayerTin' IS DISTINCT FROM v_tin
        OR v_allocation_view->>'assessmentYear' IS DISTINCT FROM v_allocation->>'assessmentYear'
        OR v_allocation_view->>'amountMinor' IS DISTINCT FROM v_allocation->>'amountMinor'
      THEN RAISE EXCEPTION 'INVALID_COMBINED_ALLOCATION'; END IF;
      -- One independent immutable allocation = beneficiary + eligible head + assessment year.
      -- An invalid or duplicate line must never be accepted merely because the total matches.
      v_year := v_allocation->>'assessmentYear';
      IF v_year !~ '^20[0-9]{2}-[0-9]{2}$' THEN
        RAISE EXCEPTION 'INVALID_ASSESSMENT_YEAR';
      END IF;
      IF right(v_year,2)::integer <> (left(v_year,4)::integer + 1) % 100 THEN
        RAISE EXCEPTION 'INVALID_ASSESSMENT_YEAR';
      END IF;
      v_key := v_tin || ':' || (v_allocation->>'headId') || ':' || v_year;
      IF v_key = ANY(v_seen) THEN RAISE EXCEPTION 'DUPLICATE_COMBINED_ALLOCATION'; END IF;
      v_seen := array_append(v_seen,v_key);
      IF NOT v_tin = ANY(v_seen_tins) THEN v_seen_tins := array_append(v_seen_tins,v_tin); END IF;
      SELECT h.head_id,h.code_en,h.name_en,h.category INTO v_head
      FROM demo_payment.taxpay_combined_demo_heads h
      WHERE h.head_id=(v_allocation->>'headId')::integer;
      IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_COMBINED_HEAD'; END IF;
      IF v_line->>'economicCode' IS DISTINCT FROM v_head.code_en
         OR v_line->>'headNameEn' IS DISTINCT FROM v_head.name_en
         OR v_allocation_view->>'paymentServiceEn' IS DISTINCT FROM v_head.name_en
         OR v_allocation_view->>'economicCode' IS DISTINCT FROM v_head.code_en
      THEN RAISE EXCEPTION 'INVALID_COMBINED_HEAD'; END IF;
      v_amount := (v_allocation->>'amountMinor')::bigint;
      v_sum := v_sum + v_amount;
      IF v_payer IS NULL THEN
        -- Public walk-in is permitted to pay for others, but never skips accounting,
        -- head, year, TIN, uniqueness, receipt and sum validation.
        CONTINUE;
      END IF;
      IF v_mode = 'SELF' THEN
        v_number := substring(v_payer from 5)::integer;
        v_expected13 := CASE
          WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,13)
          WHEN v_number = 10 THEN '1010101010101'
          ELSE '90000000000'||lpad(v_number::text,2,'0') END;
        v_expected12 := CASE
          WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,12)
          WHEN v_number = 10 THEN '000000000000'
          ELSE '9090000000'||lpad(v_number::text,2,'0') END;
        IF v_tin IS DISTINCT FROM new.data->'details'->>'taxpayerTin'
          OR v_tin NOT IN (v_expected12,v_expected13)
        THEN RAISE EXCEPTION 'INVALID_SELF_ALLOCATION'; END IF;
      ELSE
        -- A signed-in payer may include their own TIN alongside owned saved
        -- beneficiaries. Their own TIN must not be entered as a saved contact.
        v_number := substring(v_payer from 5)::integer;
        v_expected13 := CASE
          WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,13)
          WHEN v_number = 10 THEN '1010101010101'
          ELSE '90000000000'||lpad(v_number::text,2,'0') END;
        v_expected12 := CASE
          WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,12)
          WHEN v_number = 10 THEN '000000000000'
          ELSE '9090000000'||lpad(v_number::text,2,'0') END;
        IF v_tin IN (v_expected12,v_expected13) THEN CONTINUE; END IF;
        SELECT EXISTS(
          SELECT 1 FROM taxpay_guest_private.demo_profiles prof
          JOIN taxpay_guest_private.sessions sess
            ON sess.capability_hash =
              encode(extensions.digest(convert_to(prof.capability_token,'UTF8'),'sha256'),'hex')
          JOIN taxpay_guest_private.lists own_list ON own_list.session_id=sess.id
          JOIN taxpay_guest_private.beneficiaries saved
            ON saved.session_id=sess.id AND saved.list_id=own_list.id
          WHERE prof.demo_id=v_payer AND prof.payment_session_id=new.session_id
            AND saved.tin=v_tin
        ) INTO v_saved;
        IF NOT v_saved THEN RAISE EXCEPTION 'INVALID_BENEFICIARY'; END IF;
      END IF;
    END LOOP;
    IF v_sum <> new.amount_minor THEN RAISE EXCEPTION 'ALLOCATION_TOTAL_MISMATCH'; END IF;
    IF coalesce(new.data->'details'->>'taxpayerCount','') !~ '^[1-9][0-9]{0,3}$'
      OR array_length(v_seen_tins,1) IS DISTINCT FROM
        (CASE WHEN coalesce(new.data->'details'->>'taxpayerCount','') ~ '^[1-9][0-9]{0,3}$'
          THEN (new.data->'details'->>'taxpayerCount')::integer ELSE NULL END)
    THEN RAISE EXCEPTION 'INVALID_TAXPAYER_COUNT'; END IF;
    RETURN new;
  END IF;

  -- Legacy accounting/consent format remains read-only for guest records and
  -- retains its existing authorization behavior for bound demo profiles.
  IF v_payer IS NULL THEN RETURN new; END IF;
  FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines) LOOP
    v_beneficiary := v_line->>'beneficiary';
    IF v_beneficiary !~ '^SAVED_TIN:[0-9]{12,13}$' AND
       NOT EXISTS (SELECT 1 FROM public.sim_payment_users WHERE id=v_beneficiary)
    THEN RAISE EXCEPTION 'INVALID_BENEFICIARY'; END IF;
    IF coalesce(v_line->>'amountMinor','') !~ '^[1-9][0-9]{0,11}$'
    THEN RAISE EXCEPTION 'INVALID_ALLOCATION_AMOUNT'; END IF;
    v_amount := (v_line->>'amountMinor')::bigint;
    v_sum := v_sum + v_amount;
    IF v_beneficiary <> v_payer THEN
      v_saved := false;
      -- The existing UI permits simulated payments for saved beneficiaries
      -- without access to their private data. Verify the server-side list,
      -- tied to the exact capability and demo payment session.
      IF new.data->>'origin' = 'TAXPAY_UI'
         AND new.data->'details'->>'payerMode' = 'OTHER'
         AND jsonb_typeof(new.data->'details'->'receiptSnapshot') = 'object'
         AND jsonb_array_length(v_lines) = 1
         AND v_line->>'authorizationId' IS NULL THEN
        v_tin := btrim(coalesce(new.data->'details'->>'taxpayerTin',''));
        -- Preserve literal external TIN identity; only owner-scoped saved rows
        -- can satisfy the new branch. No implicit authorization is generated.
        IF v_beneficiary LIKE 'SAVED_TIN:%' THEN
          v_allowed_tin := v_beneficiary = 'SAVED_TIN:'||v_tin
            AND v_tin ~ '^[0-9]{12,13}$'
            AND new.data->'details'->'receiptSnapshot'->>'taxpayerTin' = v_tin;
        ELSE
          v_number := substring(v_beneficiary from 5)::integer;
          v_expected13 := CASE
            WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,13)
            WHEN v_number = 10 THEN '1010101010101'
            ELSE '90000000000'||lpad(v_number::text,2,'0') END;
          v_expected12 := CASE
            WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,12)
            WHEN v_number = 10 THEN repeat('0',12)
            ELSE '9090000000'||lpad(v_number::text,2,'0') END;
          v_allowed_tin := v_tin IN (v_expected12,v_expected13);
        END IF;
        IF v_allowed_tin THEN
          SELECT EXISTS (
            SELECT 1
            FROM taxpay_guest_private.demo_profiles prof
            JOIN taxpay_guest_private.sessions guest_sess
              ON guest_sess.capability_hash =
                 encode(extensions.digest(convert_to(prof.capability_token,'UTF8'),'sha256'),'hex')
            JOIN taxpay_guest_private.lists owned_list
              ON owned_list.session_id = guest_sess.id
            JOIN taxpay_guest_private.beneficiaries saved
              ON saved.session_id = guest_sess.id AND saved.list_id = owned_list.id
            WHERE prof.demo_id = v_payer
              AND prof.payment_session_id = new.session_id
              AND saved.tin = v_tin
          ) INTO v_saved;
        END IF;
      END IF;
      IF NOT v_saved THEN
        -- A failed external saved-TIN check cannot use an unrelated consent.
        IF v_beneficiary LIKE 'SAVED_TIN:%' THEN
          RAISE EXCEPTION 'INVALID_BENEFICIARY';
        END IF;
        IF coalesce(v_line->>'authorizationId','') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN RAISE EXCEPTION 'AUTHORIZATION_REQUIRED'; END IF;
        v_auth := (v_line->>'authorizationId')::uuid;
        IF NOT EXISTS (
          SELECT 1 FROM public.demo_authorization_requests a
          WHERE a.id=v_auth AND a.payer_id=v_payer AND a.taxpayer_id=v_beneficiary
            AND a.status='ACTIVE'
        ) THEN RAISE EXCEPTION 'AUTHORIZATION_REQUIRED'; END IF;
      END IF;
    END IF;
  END LOOP;
  IF v_sum <> new.amount_minor THEN RAISE EXCEPTION 'ALLOCATION_TOTAL_MISMATCH'; END IF;
  RETURN new;
END;
$function$;

-- Enforce the exclusive Tax with Return category on NEW RPC submissions only.
-- Direct insertion of already-existing, knowingly invalid historical fixture
-- rows remains possible in disposable tests without relaxing any public RPC.
CREATE OR REPLACE FUNCTION demo_payment.assert_new_head_exclusivity(p_input jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $taxpay_return$
DECLARE
  v_service text := p_input->>'service';
  v_lines jsonb := p_input->'details'->'lines';
BEGIN
  IF jsonb_typeof(v_lines) IS DISTINCT FROM 'array' THEN RETURN; END IF;
  IF v_service = 'TAX_WITH_RETURN' THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) AS a(value)
      WHERE (a.value ? 'category' AND a.value->>'category' <> 'TAX_WITH_RETURN')
         OR (a.value ? 'headId' AND a.value->>'headId' <> '125'))
    THEN RAISE EXCEPTION 'RETURN_HEAD_EXCLUSIVE'; END IF;
  ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) AS a(value)
      WHERE a.value->>'category' = 'TAX_WITH_RETURN' OR a.value->>'headId' = '125')
    THEN RAISE EXCEPTION 'RETURN_HEAD_EXCLUSIVE';
  END IF;
END;
$taxpay_return$;
REVOKE ALL ON FUNCTION demo_payment.assert_new_head_exclusivity(jsonb) FROM PUBLIC,anon,authenticated;

-- Preserve every existing RPC ownership, idempotency and grant condition: change
-- only the request limit for the already separately validated combined shape.
-- The existing 12KB cap remains unchanged for all older/single-head services.
DO $taxpay_payload_limit$
DECLARE
  v_rpc text;
  v_sql text;
  v_old text := 'length(p_input::text)>12000';
  v_insert text := 'insert into demo_payment.story_payments(idempotency_key,session_id,service_code,amount_minor,data,status)';
  v_validate text := 'perform demo_payment.assert_new_head_exclusivity(p_input);';
  v_new text := 'length(p_input::text) > (CASE WHEN p_input->''details''->>''combinedPayment'' = ''true'' AND p_input->>''service'' = ''OTHER_TAX_PAYMENT'' THEN 750000 ELSE 12000 END)';
BEGIN
  FOR v_rpc IN SELECT unnest(ARRAY['public.demo_story1_submit(jsonb)',
    'public.taxpay_demo_story1_submit(text,jsonb)']) LOOP
    v_sql := pg_get_functiondef(v_rpc::regprocedure);
    IF position(v_old IN v_sql) = 0 AND position(v_new IN v_sql) = 0 THEN
      RAISE EXCEPTION 'TAXPAY_RPC_UNEXPECTED_SOURCE: %', v_rpc;
    END IF;
    IF position(v_insert IN v_sql) = 0 THEN
      RAISE EXCEPTION 'TAXPAY_RPC_IDEMPOTENCY_SOURCE_UNEXPECTED: %', v_rpc;
    END IF;
    IF position(v_validate IN v_sql) = 0 THEN
      v_sql := replace(v_sql, v_insert, v_validate || E'\n  ' || v_insert);
    END IF;
    IF position(v_old IN v_sql) > 0 THEN
      v_sql := replace(v_sql, v_old, v_new);
    END IF;
    EXECUTE v_sql;
  END LOOP;
END $taxpay_payload_limit$;
