-- Only disposable local PostgreSQL. Synthetic writes and links all roll back.
begin;
do $recovery$
declare
  a jsonb;
  b jsonb;
  c jsonb;
  h_a text;
  h_b text;
  h_c text;
  old_session uuid:=gen_random_uuid();
  unowned_session uuid:=gen_random_uuid();
  mixed_session uuid:=gen_random_uuid();
  qa_session uuid:=gen_random_uuid();
  prelinked_session uuid:=gen_random_uuid();
  payment uuid:=gen_random_uuid();
  payment_key uuid:=gen_random_uuid();
  active_authorization uuid:=gen_random_uuid();
  unowned_payment uuid:=gen_random_uuid();
  mixed_payment_a uuid:=gen_random_uuid();
  mixed_payment_b uuid:=gen_random_uuid();
  qa_payment uuid:=gen_random_uuid();
  prelinked_payment uuid:=gen_random_uuid();
  original_record jsonb;
  original_outbox jsonb;
  original_notices jsonb;
  result jsonb;
  visible jsonb;
  line_a jsonb:=jsonb_build_object('beneficiary','user1','category','TAX_WITH_RETURN',
    'assessmentYear','2026-27','amountMinor',100);
  line_b jsonb:=jsonb_build_object('beneficiary','user2','category','PENALTY',
    'assessmentYear','2025-26','amountMinor',200);
  input_data jsonb;
begin
  a:=public.taxpay_demo_profile_login('user1','user1');
  b:=public.taxpay_demo_profile_login('user2','user2');
  c:=public.taxpay_demo_profile_login('user3','user3');
  h_a:=encode(extensions.digest(convert_to(a->>'capability','UTF8'),'sha256'),'hex');
  h_b:=encode(extensions.digest(convert_to(b->>'capability','UTF8'),'sha256'),'hex');
  h_c:=encode(extensions.digest(convert_to(c->>'capability','UTF8'),'sha256'),'hex');

  insert into public.demo_authorization_requests(id,payer_id,taxpayer_id,status,confirmed_at)
    values(active_authorization,'user1','user2','ACTIVE',now());
  line_b:=jsonb_set(line_b,'{authorizationId}',to_jsonb(active_authorization::text));

  input_data:=jsonb_build_object(
    'origin','TAXPAY_UI','service','TAX_WITH_RETURN','amountMinor',300,'sessionId',old_session,
    'idempotencyKey',payment_key,
    'details',jsonb_build_object('payerId','user1','payerName','Synthetic payer',
      'lines',jsonb_build_array(line_a,line_b)));
  insert into demo_payment.story_payments(id,idempotency_key,session_id,service_code,amount_minor,data,status)
    values(payment,payment_key,old_session,'TAX_WITH_RETURN',300,input_data,'SIMULATED_SUCCESS');
  insert into demo_payment.story_notifications(payment_id,session_id,event_type)
    values(payment,old_session,'SIMULATED_PAYMENT_SUCCESS');
  select to_jsonb(x) into original_record from demo_payment.story_payments x where x.id=payment;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into original_outbox
    from demo_payment.mirror_outbox x where x.entity_type='PAYMENT' and x.entity_id=payment;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into original_notices
    from demo_payment.story_notifications x where x.payment_id=payment;

  -- An unrelated row without explicit payer ownership and a mixed-owner
  -- session must never be assigned by its browser session UUID alone.
  insert into demo_payment.story_payments(id,idempotency_key,session_id,service_code,amount_minor,data,status)
    values(unowned_payment,gen_random_uuid(),unowned_session,'TAX_WITH_RETURN',10,
      jsonb_build_object('service','TAX_WITH_RETURN','amountMinor',10,
        'details',jsonb_build_object('test',true)),'SIMULATED_SUCCESS');
  insert into demo_payment.story_payments(id,idempotency_key,session_id,service_code,amount_minor,data,status)
    values(mixed_payment_a,gen_random_uuid(),mixed_session,'TAX_WITH_RETURN',10,
      jsonb_build_object('origin','TAXPAY_UI','service','TAX_WITH_RETURN','amountMinor',10,
        'details',jsonb_build_object('payerId','user1','lines',jsonb_build_array(
          jsonb_build_object('beneficiary','user1','category','TAX_WITH_RETURN',
            'assessmentYear','2026-27','amountMinor',10)))),'SIMULATED_SUCCESS'),
      (mixed_payment_b,gen_random_uuid(),mixed_session,'TAX_WITH_RETURN',20,
      jsonb_build_object('origin','TAXPAY_UI','service','TAX_WITH_RETURN','amountMinor',20,
        'details',jsonb_build_object('payerId','user2','lines',jsonb_build_array(
          jsonb_build_object('beneficiary','user2','category','TAX_WITH_RETURN',
            'assessmentYear','2026-27','amountMinor',20)))),'SIMULATED_SUCCESS');
  insert into demo_payment.story_payments(id,idempotency_key,session_id,service_code,amount_minor,data,status)
    values(qa_payment,gen_random_uuid(),qa_session,'TAX_WITH_RETURN',15,
      jsonb_build_object('origin','QA_BROWSER','service','TAX_WITH_RETURN','amountMinor',15,
        'details',jsonb_build_object('payerId','user1','lines',jsonb_build_array(
          jsonb_build_object('beneficiary','user1','category','TAX_WITH_RETURN',
            'assessmentYear','2026-27','amountMinor',15)))),
      'SIMULATED_SUCCESS');
  insert into demo_payment.story_payments(id,idempotency_key,session_id,service_code,amount_minor,data,status)
    values(prelinked_payment,gen_random_uuid(),prelinked_session,'TAX_WITH_RETURN',30,
      jsonb_build_object('origin','TAXPAY_UI','service','TAX_WITH_RETURN','amountMinor',30,
        'details',jsonb_build_object('payerId','user2','lines',jsonb_build_array(
          jsonb_build_object('beneficiary','user2','category','TAX_WITH_RETURN',
            'assessmentYear','2026-27','amountMinor',30)))),
      'SIMULATED_SUCCESS');
  -- Simulate a link created by the prior weaker function. Every read path must
  -- re-check ownership and keep the unrelated source data hidden.
  insert into taxpay_guest_private.demo_story_session_links(demo_id,legacy_session_id)
    values('user1',prelinked_session);

  if (public.taxpay_demo_story1_session_payments(h_a,1,100)->>'total')::bigint<>0 then
    raise exception 'Historical payment was silently added before consent';
  end if;
  begin
    perform public.taxpay_demo_recover_story1_session(h_a,unowned_session);
    raise exception 'An unowned legacy session was accepted';
  exception when others then
    if sqlerrm='An unowned legacy session was accepted' then raise; end if;
    if sqlerrm not like '%LEGACY_SESSION_OWNER_UNVERIFIED%' then raise; end if;
  end;
  begin
    perform public.taxpay_demo_recover_story1_session(h_a,mixed_session);
    raise exception 'A mixed-owner legacy session was accepted';
  exception when others then
    if sqlerrm='A mixed-owner legacy session was accepted' then raise; end if;
    if sqlerrm not like '%LEGACY_SESSION_OWNER_UNVERIFIED%' then raise; end if;
  end;
  begin
    perform public.taxpay_demo_recover_story1_session(h_a,qa_session);
    raise exception 'A QA-only source session was accepted for profile recovery';
  exception when others then
    if sqlerrm='A QA-only source session was accepted for profile recovery' then raise; end if;
    if sqlerrm not like '%LEGACY_SESSION_OWNER_UNVERIFIED%' then raise; end if;
  end;
  if exists(select 1 from taxpay_guest_private.demo_story_session_links
    where legacy_session_id in (unowned_session,mixed_session,qa_session)) then
    raise exception 'Rejected legacy session created an ownership link';
  end if;
  begin
    perform public.taxpay_demo_recover_story1_session(h_a,prelinked_session);
    raise exception 'A prior mismatched session link was trusted';
  exception when others then
    if sqlerrm='A prior mismatched session link was trusted' then raise; end if;
    if sqlerrm not like '%LEGACY_SESSION_OWNER_UNVERIFIED%' then raise; end if;
  end;

  if jsonb_array_length(original_outbox)<>1 then
    raise exception 'Synthetic source payment did not enqueue its Office mirror';
  end if;
  result:=public.taxpay_demo_recover_story1_session(h_a,old_session);
  if (result->>'recovered')::bigint<>1 then raise exception 'Verified recovery count incorrect'; end if;
  if (select to_jsonb(x) from demo_payment.story_payments x where x.id=payment)
     is distinct from original_record then
    raise exception 'Recovery rewrote an original payment or reference';
  end if;
  if (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from demo_payment.mirror_outbox x
       where x.entity_type='PAYMENT' and x.entity_id=payment) is distinct from original_outbox then
    raise exception 'Recovery changed the original Office mirror outbox record';
  end if;
  if (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from demo_payment.story_notifications x
       where x.payment_id=payment) is distinct from original_notices then
    raise exception 'Recovery changed an original notification';
  end if;
  if (public.taxpay_demo_story1_session_payments(h_a,1,100)->>'total')::bigint<>1 then
    raise exception 'Verified payment is absent after recovery';
  end if;
  if (public.taxpay_demo_story1_session_payment(h_a,payment)->>'id')::uuid<>payment then
    raise exception 'Recovered receipt is unreadable';
  end if;
  if not exists(select 1 from jsonb_array_elements(public.taxpay_demo_story1_session_notices(h_a)) n
    where n.value->>'paymentId'=payment::text and n.value->>'type'='SIMULATED_PAYMENT_SUCCESS') then
    raise exception 'Original payment notification is absent after recovery';
  end if;

  -- A confirmed historical session is immutable: exact idempotent retry is
  -- returned, while a new simulated payment cannot append to the linked ID.
  result:=public.demo_story1_submit(input_data);
  if result->>'id'<>payment::text or result->>'replayed'<>'true' then
    raise exception 'Existing successful retry was not idempotent';
  end if;
  begin
    perform public.demo_story1_submit(jsonb_set(
      jsonb_set(input_data,'{idempotencyKey}',to_jsonb(gen_random_uuid()::text)),
      '{amountMinor}','1'::jsonb));
    raise exception 'A new payment was appended to a recovered legacy session';
  exception when others then
    if sqlerrm='A new payment was appended to a recovered legacy session' then raise; end if;
    if sqlerrm not like '%LEGACY_SESSION_READ_ONLY%' then raise; end if;
  end;

  if (public.taxpay_demo_recover_story1_session(h_a,old_session)->>'recovered')::bigint<>1 then
    raise exception 'Idempotent recovery failed';
  end if;
  begin
    perform public.taxpay_demo_recover_story1_session(h_b,old_session);
    raise exception 'A different profile was allowed to claim the verified session';
  exception when others then
    if sqlerrm='A different profile was allowed to claim the verified session' then raise; end if;
    if sqlerrm not like '%LEGACY_SESSION_ALREADY_LINKED%' then raise; end if;
  end;
  if (public.taxpay_demo_story1_session_payments(h_b,1,100)->>'total')::bigint<>0 then
    raise exception 'Another preview profile can read the payer receipt';
  end if;
  if (public.taxpay_demo_story1_session_payments(h_a,1,100)->>'total')::bigint<>1 then
    raise exception 'A mismatched pre-existing session link exposed an unrelated payment';
  end if;
  begin
    perform public.demo_story1_list_page((a->>'paymentSessionId')::uuid,1,100);
    raise exception 'Public session endpoint exposed a profile history';
  exception when others then
    if sqlerrm='Public session endpoint exposed a profile history' then raise; end if;
    if sqlerrm not like '%PROFILE_CAPABILITY_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.taxpay_demo_story1_session_payment(h_a,prelinked_payment);
    raise exception 'A mismatched pre-existing session link exposed payment details';
  exception when others then
    if sqlerrm='A mismatched pre-existing session link exposed payment details' then raise; end if;
    if sqlerrm not like '%NOT_FOUND%' then raise; end if;
  end;
  if exists(select 1 from jsonb_array_elements(public.taxpay_demo_story1_session_notices(h_a)) item(value)
    where item.value->>'paymentId'=prelinked_payment::text) then
    raise exception 'A mismatched pre-existing session link exposed a notice';
  end if;

  result:=public.taxpay_demo_story1_history_page(h_a,'payer');
  select item.value into visible from jsonb_array_elements(result) item(value)
   where item.value->>'transactionId'=payment::text;
  if visible is null or (visible->>'totalMinor')::bigint<>300
     or jsonb_array_length(visible->'allocations')<>2 then
    raise exception 'Payer history did not retain its full payment and allocations';
  end if;
  result:=public.taxpay_demo_story1_history_page(h_b,'beneficiary');
  select item.value into visible from jsonb_array_elements(result) item(value)
   where item.value->>'transactionId'=payment::text;
  if visible is null or (visible->>'totalMinor')::bigint<>200
     or visible->>'payer' is not null
     or visible->'allocations'<>jsonb_build_array(line_b) then
    raise exception 'Beneficiary history exposed another allocation, payer or payment total';
  end if;
  if exists(select 1 from jsonb_array_elements(public.taxpay_demo_story1_history_page(h_c,'beneficiary')) item(value)
    where item.value->>'transactionId'=payment::text) then
    raise exception 'Unrelated profile can see the payment activity';
  end if;
  if has_function_privilege('anon','public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.demo_story1_demo_history_page(text,text,timestamptz,uuid,integer)','EXECUTE') then
    raise exception 'Caller-supplied actor history remained available to public roles';
  end if;
  if has_function_privilege('anon','public.taxpay_demo_recover_story1_session(text,uuid)','EXECUTE') then
    raise exception 'Anonymous direct recovery access granted';
  end if;
  raise notice 'PASS: explicit payer recovery, rejected unowned/mixed sessions, revalidated old links, immutable source/outbox/notices, retry, read-only archive and scoped history';
end
$recovery$;
rollback;
