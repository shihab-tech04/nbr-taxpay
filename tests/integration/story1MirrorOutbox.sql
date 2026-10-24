-- Pure disposable SQL test. No Office endpoint or hosted credentials are used.
begin;
do $test$
declare
  payment_key uuid := gen_random_uuid();
  payment_id uuid;
  session_id uuid := gen_random_uuid();
  consent_id uuid;
  expiring_id uuid;
  expiring_claim jsonb;
  expiry_at timestamptz;
  claims jsonb;
  payment_claim jsonb;
  auth_claim jsonb;
  denied boolean := false;
  status_before text;
  submission jsonb;
begin
  perform set_config('request.jwt.claim.role','anon',true);
  begin
    perform public.demo_story1_mirror_claim(20);
  exception when others then
    denied := SQLERRM like '%SERVICE_ROLE_REQUIRED%';
  end;
  if not denied then raise exception 'Anonymous queue claim unexpectedly authorized';end if;

  submission := public.demo_story1_submit(jsonb_build_object(
    'idempotencyKey',payment_key,'sessionId',session_id,
    'service','TRAVEL_TAX','amountMinor',12345,'origin','TAXPAY_UI',
    'details',jsonb_build_object('travelRoute','Synthetic acceptance')));
  payment_id := (submission->>'id')::uuid;
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

  -- Time-based expiry has no row UPDATE; the cron job must enqueue it once.
  insert into public.demo_authorization_requests(payer_id,taxpayer_id)
    values('user8','user7') returning id,code_expires_at into expiring_id,expiry_at;
  claims := public.demo_story1_mirror_claim(20);
  select x.value into expiring_claim from jsonb_array_elements(claims) x
    where x.value->>'type'='AUTHORIZATION' and (x.value->>'id')::uuid=expiring_id;
  if expiring_claim is null or not public.demo_story1_mirror_finish(
    'AUTHORIZATION',expiring_id,(expiring_claim->>'claimToken')::uuid,true)
  then raise exception 'Initial expiring authorization ACK failed';end if;
  if demo_payment.story1_requeue_expired_authorizations(expiry_at-interval '1 second')<>0
  then raise exception 'Authorization requeued before its expiry';end if;
  if demo_payment.story1_requeue_expired_authorizations(expiry_at+interval '1 second')<>1
  then raise exception 'Expired authorization did not requeue';end if;
  if demo_payment.story1_requeue_expired_authorizations(expiry_at+interval '2 seconds')<>0
  then raise exception 'Expired authorization requeued twice before ACK';end if;
  claims := public.demo_story1_mirror_claim(20);
  select x.value into expiring_claim from jsonb_array_elements(claims) x
    where x.value->>'type'='AUTHORIZATION' and (x.value->>'id')::uuid=expiring_id;
  if expiring_claim is null or not public.demo_story1_mirror_finish(
    'AUTHORIZATION',expiring_id,(expiring_claim->>'claimToken')::uuid,true)
  then raise exception 'Expired authorization ACK failed';end if;
  -- Simulate the ACK timestamp after expiry rather than waiting in CI.
  update demo_payment.mirror_outbox set acknowledged_at=expiry_at+interval '2 seconds'
    where entity_type='AUTHORIZATION' and entity_id=expiring_id;
  if demo_payment.story1_requeue_expired_authorizations(expiry_at+interval '3 seconds')<>0
  then raise exception 'Already acknowledged expiry was requeued again';end if;
  raise notice 'PASS: durable outbox, service-only claims, stale-claim rejection, retry and exactly-once derived expiry';
end;
$test$;
rollback;
