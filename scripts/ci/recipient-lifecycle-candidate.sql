begin;
-- A staged, validated simulation is NOT a completed payment, receipt or Office
-- payment mirror. The existing insert-only ledger and all AFTER triggers stay unchanged.
create table demo_payment.story_payment_initiations (
 id uuid primary key default gen_random_uuid(),idempotency_key uuid not null unique,
 session_id uuid not null,service_code text not null,amount_minor bigint not null check(amount_minor>0),
 data jsonb not null check(jsonb_typeof(data)='object'),status text not null check(status='SIMULATED_INITIATED'),
 created_at timestamptz not null default now()
);
alter table demo_payment.story_payment_initiations enable row level security;
revoke all on demo_payment.story_payment_initiations from public,anon,authenticated;
-- Reuse the exact existing BEFORE INSERT validators, never the outbox trigger.
-- Reject unexpected trigger shape instead of silently omitting a guard.
do $stage_guards$
declare t record; n integer:=0; ddl text;
begin
 for t in select tgname,pg_get_triggerdef(oid) as def from pg_trigger
 where tgrelid='demo_payment.story_payments'::regclass and not tgisinternal and (tgtype::int&2)=2 and (tgtype::int&4)=4
 loop
   ddl:=replace(t.def,' ON demo_payment.story_payments ',' ON demo_payment.story_payment_initiations ');
   if ddl=t.def then raise exception 'INITIATION_GUARD_SOURCE_MISMATCH: %',t.tgname; end if;
   execute ddl;n:=n+1;
 end loop;
 if n<4 then raise exception 'INITIATION_GUARDS_MISSING'; end if;
end;
$stage_guards$;
create function demo_payment.story_initiation_id(p_key uuid,p_session uuid,p_input jsonb)
returns uuid language plpgsql set search_path='' as $stage_id$
declare s demo_payment.story_payment_initiations%rowtype;
begin
 select * into s from demo_payment.story_payment_initiations where idempotency_key=p_key;
 if not found then return gen_random_uuid(); end if;
 if s.session_id<>p_session or s.data<>p_input then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
 return s.id;
end;
$stage_id$;
revoke all on function demo_payment.story_initiation_id(uuid,uuid,jsonb) from public,anon,authenticated;
-- Clone the accepted submit RPCs so all existing validation, capability and
-- idempotency code remains byte-identical before their final write.
do $stage_rpc$
declare sig text; def text; staged text; completed text; name text; next_name text;
 ins constant text:='insert into demo_payment.story_payments(idempotency_key,session_id,service_code,amount_minor,data,status)';
 values_prefix constant text:='values(v_key,v_session,';
 notices constant text:='insert into demo_payment.story_notifications(payment_id,session_id,event_type)';
 at_notice integer; at_return integer; before_insert text;
begin
 foreach sig in array array['public.demo_story1_submit(jsonb)','public.taxpay_demo_story1_submit(text,jsonb)'] loop
  def:=pg_get_functiondef(sig::regprocedure);
  name:=split_part(sig,'(',1);next_name:=replace(name,'_submit','_initiate');
  if position(ins in def)=0 or position(values_prefix in def)=0 or position(notices in def)=0
  then raise exception 'INITIATION_SUBMIT_SOURCE_MISMATCH: %',sig; end if;
  staged:=replace(def,'FUNCTION '||name||'(','FUNCTION '||next_name||'(');
  if staged=def then raise exception 'INITIATION_FUNCTION_NAME_MISMATCH: %',sig; end if;
  -- Same advisory lock already acquired. Return an exact staged replay only
  -- after the existing completed replay and all normal validation checks.
  before_insert:='select * into v_old from demo_payment.story_payment_initiations where idempotency_key=v_key;
  if found then
    if v_old.session_id<>v_session or v_old.data<>p_input then raise exception ''IDEMPOTENCY_CONFLICT''; end if;
    return jsonb_build_object(''id'',v_old.id,''status'',v_old.status,''replayed'',true,''createdAt'',v_old.created_at);
  end if;
  ';
  staged:=replace(staged,ins,before_insert||replace(ins,'story_payments','story_payment_initiations'));
  staged:=replace(staged,'''SIMULATED_SUCCESS'')','''SIMULATED_INITIATED'')');
  at_notice:=position(notices in staged);
  at_return:=position('return jsonb_build_object(''id'',v_new.id' in staged);
  if at_notice=0 or at_return<=at_notice then raise exception 'INITIATION_SUCCESS_NOTICE_SOURCE_MISMATCH'; end if;
  staged:=substring(staged from 1 for at_notice-1)||substring(staged from at_return);
  execute staged;
  -- Final completion uses the reserved ID. Direct older clients remain
  -- compatible, and completed historical rows are never rewritten.
  completed:=replace(def,ins,replace(ins,'(idempotency_key','(id,idempotency_key'));
  completed:=replace(completed,values_prefix,'values(demo_payment.story_initiation_id(v_key,v_session,p_input),v_key,v_session,');
  execute completed;
 end loop;
end;
$stage_rpc$;
revoke all on function public.demo_story1_initiate(jsonb),public.taxpay_demo_story1_initiate(text,jsonb) from public,anon,authenticated;
grant execute on function public.demo_story1_initiate(jsonb) to anon,authenticated;
grant execute on function public.taxpay_demo_story1_initiate(text,jsonb) to service_role;

-- Extend existing recorded simulated-payment notices to explicit walk-in allocations.
-- Read-only payment projection; existing acknowledgement and account contracts remain.
-- No new authentication, role, payment gateway or financial mutation.
CREATE OR REPLACE FUNCTION public.taxpay_demo_received_payment_notices(
  p_capability_hash text,
  p_action text DEFAULT 'list',
  p_event_id text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 100
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $notices$
DECLARE
  v_demo text;
  v_number integer;
  v_tin12 text;
  v_tin13 text;
  v_registered_tin text;
  v_events jsonb;
  v_list jsonb;
  v_count integer;
  v_ack_at timestamptz;
BEGIN
  IF p_capability_hash IS NULL OR p_capability_hash !~ '^[0-9a-f]{64}$'
     OR p_action IS NULL OR p_action NOT IN ('list','unread','ack')
     OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'INVALID_NOTICE_REQUEST'; END IF;
  PERFORM taxpay_guest_private.touch_session(p_capability_hash);
  SELECT demo_id INTO v_demo FROM taxpay_guest_private.demo_profiles
   WHERE encode(extensions.digest(convert_to(capability_token,'UTF8'),'sha256'),'hex')
      =p_capability_hash;
  IF v_demo IS NULL THEN RAISE EXCEPTION 'INVALID_DEMO_PROFILE'; END IF;
  v_number := substring(v_demo from 5)::integer;
  v_tin12 := CASE WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,12)
    WHEN v_number=10 THEN repeat('0',12)
    ELSE '9090000000'||lpad(v_number::text,2,'0') END;
  v_tin13 := CASE WHEN v_number BETWEEN 1 AND 9 THEN repeat(v_number::text,13)
    WHEN v_number=10 THEN '1010101010101'
    ELSE '90000000000'||lpad(v_number::text,2,'0') END;
  SELECT tin INTO v_registered_tin
    FROM public.taxpay_taxpayer_registration_profiles
    WHERE account_id=v_demo;

  -- Source rows are immutable payments, never inferred from a browser-supplied
  -- TIN. The paying session must belong to its existing demo payer; links
  -- recovered from legacy sessions are accepted only when every row is owned.
  WITH source_rows AS (
    SELECT p.id,p.idempotency_key,p.session_id,p.service_code,p.amount_minor,p.data,p.status,
      coalesce(i.created_at,p.created_at) as created_at
    FROM demo_payment.story_payments p
    LEFT JOIN demo_payment.story_payment_initiations i ON i.id=p.id
    UNION ALL
    SELECT i.id,i.idempotency_key,i.session_id,i.service_code,i.amount_minor,i.data,i.status,i.created_at
    FROM demo_payment.story_payment_initiations i
    WHERE NOT EXISTS (SELECT 1 FROM demo_payment.story_payments p WHERE p.id=i.id)
  ), valid_parents AS (
    SELECT p.* FROM source_rows p
    JOIN taxpay_guest_private.demo_profiles payer
      ON payer.demo_id=p.data->'details'->>'payerId'
    WHERE p.status IN ('SIMULATED_SUCCESS','SIMULATED_INITIATED') AND p.data->>'origin'='TAXPAY_UI'
      AND payer.demo_id IS DISTINCT FROM v_demo
      AND (payer.payment_session_id=p.session_id OR EXISTS (
        SELECT 1 FROM taxpay_guest_private.demo_story_session_links link
        WHERE link.demo_id=payer.demo_id AND link.legacy_session_id=p.session_id
          AND NOT EXISTS (
            SELECT 1 FROM demo_payment.story_payments unverified
            WHERE unverified.session_id=link.legacy_session_id
              AND (unverified.data->>'origin' IS DISTINCT FROM 'TAXPAY_UI'
                OR unverified.data->'details'->>'payerId' IS DISTINCT FROM payer.demo_id)
          )
      ))
    UNION ALL
    -- A completed synthetic walk-in v3/v5 payment is independently eligible only
    -- through its explicit source allocation. Guest claims never confer Auth
    -- identity, verified payer identity, settlement, or access to other data.
    SELECT p.* FROM source_rows p
    WHERE p.status IN ('SIMULATED_SUCCESS','SIMULATED_INITIATED')
      AND p.data->>'origin'='TAXPAY_UI'
      AND p.data->'details'->>'payerId' IS NULL
      AND p.data->'details'->>'payerMode'='OTHER'
      AND p.data->'details'->>'allocationContractVersion' IN ('3','5')
      AND p.data->'details'->>'combinedPayment'='true'
      AND jsonb_typeof(p.data->'details'->'allocations')='array'
      AND char_length(btrim(coalesce(p.data->'details'->>'payerName',''))) BETWEEN 1 AND 200
      AND p.data->'details'->>'payerName'=p.data->'details'->'receiptSnapshot'->>'payerName'
      -- A matching declared guest TIN/name is not an authenticated payer.
      -- Do not suppress a recipient notice based on untrusted guest identity.
      AND NOT EXISTS (
        SELECT 1 FROM taxpay_guest_private.demo_profiles reserved
        WHERE reserved.payment_session_id=p.session_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM taxpay_guest_private.demo_story_session_links reserved
        WHERE reserved.legacy_session_id=p.session_id
      )
  ),
  eligible AS (
    SELECT p.id::text||':allocation:'||a.ordinality::text AS event_id,
      a.value->>'allocationId' AS allocation_id,
      p.id AS payment_id,p.created_at,
      coalesce(nullif(p.data->'details'->>'receiptReference',''),
        p.data->'details'->'receiptSnapshot'->>'challanNo') AS receipt_reference,
      a.value->>'taxpayerTin' AS recipient_tin,
      a.value->>'headId' AS head_id,
      coalesce(a.value->>'serviceCode',p.service_code) AS service_code,
      a.value->>'assessmentYear' AS assessment_year,
      (a.value->>'amountMinor')::bigint AS amount_minor,
      CASE WHEN char_length(btrim(coalesce(p.data->'details'->>'payerName',''))) BETWEEN 1 AND 200
        THEN p.data->'details'->>'payerName' ELSE NULL END AS payer_name,
      p.status AS payment_status
    FROM valid_parents p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.data->'details'->'allocations')='array'
        THEN p.data->'details'->'allocations' ELSE '[]'::jsonb END
    ) WITH ORDINALITY a(value,ordinality)
    WHERE a.value->>'taxpayerTin' IN (v_tin12,v_tin13,v_registered_tin)
      AND (p.data->'details'->>'payerId' IS NOT NULL
           OR length(coalesce(a.value->>'allocationId','')) BETWEEN 1 AND 128)
      AND a.value->>'amountMinor' ~ '^[1-9][0-9]{0,11}$'
      AND coalesce(a.value->>'assessmentYear','')<>''
    UNION ALL
    SELECT p.id::text||':legacy:'||l.ordinality::text AS event_id,
      NULL::text AS allocation_id,p.id,p.created_at,
      coalesce(nullif(p.data->'details'->>'receiptReference',''),
        p.data->'details'->'receiptSnapshot'->>'challanNo'),
      NULL::text AS recipient_tin,l.value->>'headId',
      p.service_code,l.value->>'assessmentYear',
      (l.value->>'amountMinor')::bigint AS amount_minor,
      CASE WHEN char_length(btrim(coalesce(p.data->'details'->>'payerName',''))) BETWEEN 1 AND 200
        THEN p.data->'details'->>'payerName' ELSE NULL END,
      p.status
    FROM valid_parents p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.data->'details'->'lines')='array'
        THEN p.data->'details'->'lines' ELSE '[]'::jsonb END
    ) WITH ORDINALITY l(value,ordinality)
    WHERE jsonb_typeof(p.data->'details'->'allocations') IS DISTINCT FROM 'array'
      AND l.value->>'beneficiary'=v_demo
      AND l.value->>'amountMinor' ~ '^[1-9][0-9]{0,11}$'
  )
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'eventId',e.event_id,'paymentId',e.payment_id,
      'allocationId',e.allocation_id,'receiptReference',e.receipt_reference,
      'recipientTin',e.recipient_tin,'headId',e.head_id,
      'serviceCode',e.service_code,'assessmentYear',e.assessment_year,
      'amountMinor',e.amount_minor,'createdAt',e.created_at,
      'payerName',e.payer_name,'paymentStatus',e.payment_status)
    ORDER BY e.created_at,e.payment_id,e.event_id
  ),'[]'::jsonb) INTO v_events FROM eligible e;

  IF p_action='ack' THEN
    IF p_event_id IS NULL OR length(p_event_id)>200 OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_events) AS event(value)
      WHERE event.value->>'eventId'=p_event_id
    ) THEN RAISE EXCEPTION 'NOTICE_NOT_FOUND'; END IF;
    INSERT INTO taxpay_guest_private.demo_received_payment_notice_ack
      (demo_id,event_id) VALUES (v_demo,p_event_id)
      ON CONFLICT (demo_id,event_id) DO NOTHING;
    SELECT acknowledged_at INTO v_ack_at
      FROM taxpay_guest_private.demo_received_payment_notice_ack
      WHERE demo_id=v_demo AND event_id=p_event_id;
    RETURN jsonb_build_object(
      'eventId',p_event_id,'isRead',true,'acknowledgedAt',v_ack_at
    );
  END IF;
  SELECT count(*) INTO v_count FROM jsonb_array_elements(v_events) AS event(value)
   LEFT JOIN taxpay_guest_private.demo_received_payment_notice_ack ack
    ON ack.demo_id=v_demo AND ack.event_id=event.value->>'eventId'
   WHERE p_action='list' OR ack.event_id IS NULL;
  SELECT coalesce(jsonb_agg(p.item ORDER BY p.ordinal),'[]'::jsonb)
    INTO v_list FROM (
    SELECT event.value ||
      jsonb_build_object('isRead',ack.acknowledged_at IS NOT NULL,
        'acknowledgedAt',ack.acknowledged_at) AS item,event.ordinality AS ordinal
    FROM jsonb_array_elements(v_events) WITH ORDINALITY AS event(value,ordinality)
    LEFT JOIN taxpay_guest_private.demo_received_payment_notice_ack ack
      ON ack.demo_id=v_demo AND ack.event_id=event.value->>'eventId'
    WHERE p_action='list' OR ack.event_id IS NULL
    ORDER BY event.ordinality
    OFFSET p_offset LIMIT p_limit
  ) p;
  RETURN jsonb_build_object('items',v_list,'total',v_count,
    'hasMore',v_count>p_offset+p_limit,'offset',p_offset,'limit',p_limit);
END;
$notices$;

REVOKE ALL ON FUNCTION public.taxpay_demo_received_payment_notices(
  text,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxpay_demo_received_payment_notices(
  text,text,text,integer,integer) TO service_role;

commit;
