-- Pure disposable SQL test. No Office endpoint or hosted credentials are used.
begin;
do $test$
declare
  payment_id uuid := gen_random_uuid();
  session_id uuid := gen_random_uuid();
  consent_id uuid;
  claims jsonb;
  payment_claim jsonb;
  auth_claim jsonb;
  denied boolean := false;
  status_before text;
begin
  perform set_config('request.jwt.claim.role','anon',true);
  begin
    perform public.demo_story1_mirror_claim(20);
  exception when others then
    denied := SQLERRM like '%SERVICE_ROLE_REQUIRED%';
  end;
  if not denied then raise exception 'Anonymous queue claim unexpectedly authorized';end if;

  perform public.demo_story1_submit(jsonb_build_object(
    'idempotencyKey',payment_id,'sessionId',session_id,
    'service','TRAVEL_TAX','amountMinor',12345,'origin','TAXPAY_UI',
    'details',jsonb_build_object('travelRoute','Synthetic acceptance')));
  insert into public.demo_authorization_requests(payer_id,taxpayer_id)
    values('user10','user9') returning id into consent_id;
  if (select count(*) from demo_payment.mirror_outbox
      where (entity_type='PAYMENT' and entity_id=payment_id)
         or (entity_type='AUTHORIZATION' and entity_id=consent_id)) <> 2
  then raise exception 'Source insert did not atomically queue both entity types';end if;

  perform set_config('request.jwt.claim.role','service_role',true);
  claims := public.demo_story1_mirror_claim(20);
  select x.value into payment_claim from jsonb_array_elements(claims) x
    where x.value->>'type'='PAYMENT' and (x.value->>'id')::uuid=payment_id;
  select x.value into auth_claim from jsonb_array_elements(claims) x
    where x.value->>'type'='AUTHORIZATION' and (x.value->>'id')::uuid=consent_id;
  if payment_claim is null or auth_claim is null
    or (payment_claim->>'sessionId')::uuid<>session_id
  then raise exception 'Claim batch missing one synthetic source entity';end if;
  if public.demo_story1_mirror_finish('PAYMENT',payment_id,gen_random_uuid(),true)
  then raise exception 'Stale claim could acknowledge payment';end if;
  if not public.demo_story1_mirror_finish('PAYMENT',payment_id,
        (payment_claim->>'claimToken')::uuid,true)
  then raise exception 'Correct payment claim could not be acknowledged';end if;
  if not public.demo_story1_mirror_finish('AUTHORIZATION',consent_id,
        (auth_claim->>'claimToken')::uuid,false,'synthetic Office outage')
  then raise exception 'Authorization retry was not persisted';end if;
  if (select status from demo_payment.mirror_outbox
      where entity_type='PAYMENT' and entity_id=payment_id) <> 'ACKED'
  then raise exception 'Payment ACK state incorrect';end if;
  if not exists(select 1 from demo_payment.mirror_outbox
      where entity_type='AUTHORIZATION' and entity_id=consent_id
        and status='PENDING' and attempts=1 and next_attempt_at>now())
  then raise exception 'Authorization retry backoff incorrect';end if;

  update public.demo_authorization_requests set status='DENIED' where id=consent_id;
  if not exists(select 1 from demo_payment.mirror_outbox
      where entity_type='AUTHORIZATION' and entity_id=consent_id
        and status='PENDING' and next_attempt_at<=now() and claim_token is null)
  then raise exception 'Source authorization change did not reset pending mirror';end if;
  select status into status_before from demo_payment.story_payments where id=payment_id;
  if status_before<>'SIMULATED_SUCCESS' then raise exception 'Mirror work altered payment status';end if;
  raise notice 'PASS: durable outbox, service-only claims, exact ACK, stale-claim rejection, retry and authorization requeue';
end;
$test$;
rollback;
