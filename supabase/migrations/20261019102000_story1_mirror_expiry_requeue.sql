-- A consent can expire without updating its TaxPay row. Mirror that derived
-- EXPIRED state exactly once, even when no new authorization action occurs.
create or replace function demo_payment.story1_requeue_expired_authorizations(
  p_at timestamptz default now()
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_requeued integer;
begin
  if p_at is null then raise exception 'INVALID_EXPIRY_CHECK_TIME'; end if;
  update demo_payment.mirror_outbox o
  set status='PENDING',next_attempt_at=now(),claim_token=null,
      locked_until=null,acknowledged_at=null,last_error=null,updated_at=now()
  from public.demo_authorization_requests a
  where o.entity_type='AUTHORIZATION' and o.entity_id=a.id
    and o.status='ACKED' and o.acknowledged_at is not null
    and a.status in ('PENDING','CODE_ISSUED')
    and a.code_expires_at<=p_at
    and o.acknowledged_at<a.code_expires_at;
  get diagnostics v_requeued = row_count;
  return v_requeued;
end;$$;
revoke all on function demo_payment.story1_requeue_expired_authorizations(timestamptz)
  from public,anon,authenticated,service_role;

-- Keep the original hosted private bridge, token rotation, and safe skip path.
-- pg_cron updates the existing named job, it does not create another worker.
do $install$
begin
  if to_regclass('payment_sync.bridge_config') is null
     or not exists(select 1 from pg_extension where extname='pg_cron')
     or not exists(select 1 from pg_extension where extname='pg_net')
  then
    raise notice 'Story1 expiry reconciliation deferred without hosted private bridge and pg_cron/pg_net';
    return;
  end if;

  perform cron.schedule(
    'taxpay_story1_office_reconcile',
    '* * * * *',
    $job$
      with newly_expired as (
        select demo_payment.story1_requeue_expired_authorizations() as total
      )
      select net.http_post(
        url := regexp_replace(b.self_url,
          '/payment-sync-bridge/?$', '/demo-story1-taxpay/sync/reconcile'),
        headers := jsonb_build_object(
          'Content-Type','application/json','X-Dispatch-Token',b.dispatch_token),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      )
      from payment_sync.bridge_config b cross join newly_expired e
      where b.singleton and b.enabled
        and b.self_url ~ '^https://[^/]+/functions/v1/payment-sync-bridge/?$'
        and (e.total>0 or exists(
          select 1 from demo_payment.mirror_outbox q
          where (q.status='PENDING' and q.next_attempt_at<=now())
             or (q.status='CLAIMED' and q.locked_until<now())
        ));
    $job$
  );
end;
$install$;
