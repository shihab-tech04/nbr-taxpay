-- Disposable local PostgreSQL only. All demo payments and profile fixtures roll back.
begin;
do $profile_scope$
declare
  first_login jsonb;
  other_login jsonb;
  first_hash text;
  other_hash text;
  profile_session uuid;
  key_id uuid:=gen_random_uuid();
  input_data jsonb;
  inserted jsonb;
  replay jsonb;
  first_page jsonb;
  other_page jsonb;
  session_page jsonb;
  original_payment jsonb;
  original_outbox jsonb;
  original_notice jsonb;
  v_payment_id uuid;
  correction_key uuid:=gen_random_uuid();
  correction_input jsonb;
  saved_correction jsonb;
  replay_correction jsonb;
begin
  first_login:=public.taxpay_demo_profile_login('user10','user10');
  other_login:=public.taxpay_demo_profile_login('user9','user9');
  first_hash:=encode(extensions.digest(convert_to(first_login->>'capability','UTF8'),'sha256'),'hex');
  other_hash:=encode(extensions.digest(convert_to(other_login->>'capability','UTF8'),'sha256'),'hex');
  profile_session:=(first_login->>'paymentSessionId')::uuid;
  -- Preserve capability-scoping, source/outbox/notice and replay tests, but
  -- supply one canonical exclusive Return receipt (disposable fixture only).
  input_data:=jsonb_build_object(
    'origin','TAXPAY_UI','service','TAX_WITH_RETURN','amountMinor',12345,
    'sessionId',profile_session,'idempotencyKey',key_id,
    'details',jsonb_build_object(
      'payerId','user10','payerName','Synthetic acceptance user',
      'payerTin','1010101010101','payerMode','SELF',
      'taxpayerTin','1010101010101','assessmentYear','2026-27',
      'receiptReference','SIM-'||key_id::text,
      'lines',jsonb_build_array(jsonb_build_object(
        'beneficiary','user10','category','TAX_WITH_RETURN','headId',125,
        'assessmentYear','2026-27','amountMinor',12345,'totalAmount',123.45)),
      'receiptSnapshot',jsonb_build_object(
        'paymentCategory','TAX_WITH_RETURN','taxpayerTin','1010101010101',
        'payerTin','1010101010101','assessmentYear','2026-27',
        'challanNo','SIM-'||key_id::text,'totalAmount',123.45,
        'items',jsonb_build_array(jsonb_build_object(
          'headId',125,'totalAmount',123.45)))));

  -- Disposable fixture diagnostic: schema flags only, never personal identifiers.
  RAISE NOTICE 'M04 diagnostic: linesType=%,linesCount=%,head125=%,categoryReturn=%,combinedField=%,allocationsField=%,otherTaxField=%',
    jsonb_typeof(input_data#>'{details,lines}'),
    jsonb_array_length(input_data#>'{details,lines}'),
    input_data#>>'{details,lines,0,headId}'='125',
    input_data#>>'{details,lines,0,category}'='TAX_WITH_RETURN',
    (input_data->'details') ? 'combinedPayment',
    (input_data->'details') ? 'allocations',
    (input_data->'details') ? 'otherTaxLines';
  inserted:=public.taxpay_demo_story1_submit(first_hash,input_data);
  v_payment_id:=(inserted->>'id')::uuid;
  if inserted->>'replayed'<>'false' then raise exception 'First capability-backed payment did not insert'; end if;
  select to_jsonb(x) into original_payment from demo_payment.story_payments x where x.id=v_payment_id;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into original_outbox
    from demo_payment.mirror_outbox x where x.entity_type='PAYMENT' and x.entity_id=v_payment_id;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into original_notice
    from demo_payment.story_notifications x where x.payment_id=v_payment_id;
  if jsonb_array_length(original_outbox)<>1 or jsonb_array_length(original_notice)<>1 then
    raise exception 'Payment, mirror outbox and notification were not created exactly once';
  end if;

  replay:=public.taxpay_demo_story1_submit(first_hash,input_data);
  if replay->>'id'<>v_payment_id::text or replay->>'replayed'<>'true' then
    raise exception 'Same account payment retry was not idempotent';
  end if;
  if (select to_jsonb(x) from demo_payment.story_payments x where x.id=v_payment_id) is distinct from original_payment
     or (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from demo_payment.mirror_outbox x
          where x.entity_type='PAYMENT' and x.entity_id=v_payment_id) is distinct from original_outbox
     or (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from demo_payment.story_notifications x
          where x.payment_id=v_payment_id) is distinct from original_notice then
    raise exception 'Idempotent retry rewrote the payment, Office mirror or notification';
  end if;

  first_page:=public.taxpay_demo_story1_history_page(first_hash,'payer',null,null,100);
  other_page:=public.taxpay_demo_story1_history_page(other_hash,'payer',null,null,100);
  if jsonb_array_length(first_page)<>1 or (first_page->0->>'transactionId')::uuid<>v_payment_id
     or (first_page->0->>'totalMinor')::bigint<>12345
     or jsonb_array_length(other_page)<>0 then
    raise exception 'Capability-backed payment history crossed demo User IDs or lost its nonempty receipt';
  end if;
  session_page:=public.taxpay_demo_story1_session_payments(first_hash,1,100);
  if (session_page->>'total')::bigint<>1 or
     (session_page->'items'->0->>'id')::uuid<>v_payment_id then
    raise exception 'Capability-backed session history did not return its payment';
  end if;
  if (public.taxpay_demo_story1_session_payments(other_hash,1,100)->>'total')::bigint<>0 then
    raise exception 'Other profile read a payer session payment';
  end if;
  if (public.taxpay_demo_story1_session_payment(first_hash,v_payment_id)->>'id')::uuid<>v_payment_id
     or jsonb_array_length(public.taxpay_demo_story1_session_notices(first_hash))<>1 then
    raise exception 'Capability-backed detail or notice read failed';
  end if;
  begin
    perform public.taxpay_demo_story1_session_payment(other_hash,v_payment_id);
    raise exception 'Other profile read payment details';
  exception when others then
    if sqlerrm='Other profile read payment details' then raise; end if;
    if sqlerrm not like '%NOT_FOUND%' then raise; end if;
  end;

  begin
    perform public.demo_story1_list_page(profile_session,1,100);
    raise exception 'Public paged session API exposed the demo profile';
  exception when others then
    if sqlerrm='Public paged session API exposed the demo profile' then raise; end if;
    if sqlerrm not like '%PROFILE_CAPABILITY_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.demo_story1_get(v_payment_id,profile_session);
    raise exception 'Public detail API exposed the demo profile';
  exception when others then
    if sqlerrm='Public detail API exposed the demo profile' then raise; end if;
    if sqlerrm not like '%PROFILE_CAPABILITY_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.demo_story1_notices(profile_session);
    raise exception 'Public notification API exposed the demo profile';
  exception when others then
    if sqlerrm='Public notification API exposed the demo profile' then raise; end if;
    if sqlerrm not like '%PROFILE_CAPABILITY_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.demo_story1_submit(jsonb_set(input_data,'{idempotencyKey}',to_jsonb(gen_random_uuid()::text)));
    raise exception 'Public submit API wrote to the demo profile';
  exception when others then
    if sqlerrm='Public submit API wrote to the demo profile' then raise; end if;
    if sqlerrm not like '%PROFILE_CAPABILITY_REQUIRED%' then raise; end if;
  end;

  if has_function_privilege('anon','public.taxpay_demo_story1_submit(text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.taxpay_demo_story1_submit(text,jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.taxpay_demo_story1_submit(text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.taxpay_demo_story1_history_page(text,text,timestamptz,uuid,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.taxpay_demo_story1_history_page(text,text,timestamptz,uuid,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.taxpay_demo_story1_history_page(text,text,timestamptz,uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)','EXECUTE') then
    raise exception 'Capability-only functions still permit public actor or payment access';
  end if;
  -- PostgREST runs STABLE RPCs in a read-only transaction. These four GET
  -- paths refresh/expire the opaque session through touch_session, so they
  -- must be VOLATILE or HTTP reads fail with DELETE-in-read-only-transaction
  -- even though direct SQL calls appear to work.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public'
         and p.proname in ('taxpay_demo_story1_history_page',
                           'taxpay_demo_story1_session_payments',
                           'taxpay_demo_story1_session_payment',
                           'taxpay_demo_story1_session_notices')
         and p.provolatile='v')<>4 then
    raise exception 'Capability-backed GET RPCs must be VOLATILE for PostgREST session cleanup';
  end if;
  -- The correction form operates on the same saved payment, not a local receipt
  -- fixture. Verify the simulation-only SQL intake, readback and account scope.
  correction_input:=jsonb_build_object('allocationIndex',0,'allocationId',null,
    'proposedAY','2025-2026','proposedCircle','','proposedHeadCode','',
    'reason','Selected the wrong assessment year');
  saved_correction:=public.taxpay_demo_correction_save(first_hash,v_payment_id,correction_key,correction_input);
  if saved_correction->>'status' is distinct from 'RECORDED'
     or saved_correction->>'paymentId' is distinct from v_payment_id::text
     or saved_correction->>'currentAY' is distinct from '2026-27'
     or saved_correction->>'proposedAY' is distinct from '2025-2026'
     or saved_correction->>'originalReference' is distinct from 'SIM-'||key_id::text then
    raise exception 'Correction acknowledgement differs from its original payment';
  end if;
  replay_correction:=public.taxpay_demo_correction_save(first_hash,v_payment_id,correction_key,correction_input);
  if saved_correction is distinct from replay_correction
     or jsonb_array_length(public.taxpay_demo_correction_list(first_hash,100,0))<>1
     or public.taxpay_demo_correction_list(first_hash,100,0)->0 is distinct from saved_correction
     or jsonb_array_length(public.taxpay_demo_correction_list(other_hash,100,0))<>0 then
    raise exception 'Correction replay or account history failed';
  end if;
  begin
    perform public.taxpay_demo_correction_save(other_hash,v_payment_id,gen_random_uuid(),correction_input);
    raise exception 'Cross-account correction was accepted';
  exception when others then
    if sqlerrm not like '%NOT_FOUND%' then raise; end if;
  end;
  begin
    perform public.taxpay_demo_correction_save(first_hash,v_payment_id,gen_random_uuid(),
      correction_input||jsonb_build_object('proposedAY','2026-2027'));
    raise exception 'Unchanged assessment year was accepted';
  exception when others then
    if sqlerrm not like '%CORRECTION_NO_CHANGE%' then raise; end if;
  end;
  begin
    perform public.taxpay_demo_correction_save(first_hash,v_payment_id,correction_key,
      correction_input||jsonb_build_object('reason','Changed input using same request key'));
    raise exception 'Conflicting correction replay was accepted';
  exception when others then
    if sqlerrm not like '%CORRECTION_REQUEST_CONFLICT%' then raise; end if;
  end;
  if (select to_jsonb(x) from demo_payment.story_payments x where x.id=v_payment_id) is distinct from original_payment
     or (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from demo_payment.mirror_outbox x
          where x.entity_type='PAYMENT' and x.entity_id=v_payment_id) is distinct from original_outbox
     or (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from demo_payment.story_notifications x
          where x.payment_id=v_payment_id) is distinct from original_notice then
    raise exception 'Correction modified the original payment, mirror, or notice';
  end if;
  if has_function_privilege('anon','public.taxpay_demo_correction_save(text,uuid,uuid,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.taxpay_demo_correction_save(text,uuid,uuid,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.taxpay_demo_correction_list(text,integer,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.taxpay_demo_correction_list(text,integer,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.taxpay_demo_correction_save(text,uuid,uuid,jsonb)','EXECUTE') then
    raise exception 'Simulated correction RPC privileges are incorrect';
  end if;
  raise notice 'PASS: correction persistence, retry, source immutability and cross-account denial';
  raise notice 'PASS: nonempty payment activity, capability-scoped reads/writes, cross-account isolation, rejected public session paths, idempotent retry and preserved Office/notice rows';
end
$profile_scope$;
rollback;
