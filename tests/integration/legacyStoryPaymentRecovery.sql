-- Only disposable local PostgreSQL. Roll back every test payment and link.
begin;
do $$
declare
 a jsonb; b jsonb;h_a text;h_b text;old_session uuid:=gen_random_uuid();
 payment uuid:=gen_random_uuid();key uuid:=gen_random_uuid();
 original_session uuid;total bigint;result jsonb;
 original_record jsonb;original_outbox bigint;original_notices bigint;
begin
 a:=public.taxpay_demo_profile_login('user1','user1');
 b:=public.taxpay_demo_profile_login('user2','user2');
 h_a:=encode(extensions.digest(convert_to(a->>'capability','UTF8'),'sha256'),'hex');
 h_b:=encode(extensions.digest(convert_to(b->>'capability','UTF8'),'sha256'),'hex');
 insert into demo_payment.story_payments(id,idempotency_key,session_id,service_code,amount_minor,data,status)
 values(payment,key,old_session,'TAX_WITH_RETURN',100,
 jsonb_build_object('service','TAX_WITH_RETURN','amountMinor',100,'details',jsonb_build_object('test',true)),'SIMULATED_SUCCESS');
 select to_jsonb(x) into original_record from demo_payment.story_payments x where x.id=payment;
 select count(*) into original_outbox from demo_payment.mirror_outbox where entity_id=payment;
 select count(*) into original_notices from demo_payment.story_notifications where payment_id=payment;
 if (public.demo_story1_list_page((a->>'paymentSessionId')::uuid,1,100)->>'total')::bigint<>0 then
   raise exception 'Old payment was silently added before consent'; end if;
 result:=public.taxpay_demo_recover_story1_session(h_a,old_session);
 if (result->>'recovered')::bigint<>1 then raise exception 'Recovery count incorrect';end if;
 if (select to_jsonb(x) from demo_payment.story_payments x where x.id=payment) is distinct from original_record then
   raise exception 'Recovery rewrote an original payment row';end if;
 if (select count(*) from demo_payment.mirror_outbox where entity_id=payment)<>original_outbox then
   raise exception 'Recovery altered the existing Office mirror outbox';end if;
 if (select count(*) from demo_payment.story_notifications where payment_id=payment)<>original_notices then
   raise exception 'Recovery altered original payment notifications';end if;

 if (public.demo_story1_list_page((a->>'paymentSessionId')::uuid,1,100)->>'total')::bigint<>1 then
   raise exception 'Recovered payment is absent';end if;
 if (public.demo_story1_get(payment,(a->>'paymentSessionId')::uuid)->>'id')::uuid<>payment then
   raise exception 'Recovered receipt unreadable';end if;
 if (public.demo_story1_list_page((b->>'paymentSessionId')::uuid,1,100)->>'total')::bigint<>0 then
   raise exception 'Another preview user can read old payments';end if;
 if (public.taxpay_demo_recover_story1_session(h_a,old_session)->>'recovered')::bigint<>1 then
   raise exception 'Idempotent recovery failed';end if;
 begin
   perform public.taxpay_demo_recover_story1_session(h_b,old_session);
   raise exception 'Different owner was allowed to claim recovered session';
 exception when others then
   if sqlerrm='Different owner was allowed to claim recovered session' then raise;end if;
 end;
 select session_id into original_session from demo_payment.story_payments where id=payment;
 if original_session<>old_session then raise exception 'Immutable original payment was modified';end if;
 if has_function_privilege('anon','public.taxpay_demo_recover_story1_session(text,uuid)','EXECUTE') then
   raise exception 'Anonymous direct recovery access granted';end if;
 raise notice 'PASS: explicit legacy-session recovery, readback, owner isolation, idempotency, immutable source and RPC grants';
end $$;
rollback;
