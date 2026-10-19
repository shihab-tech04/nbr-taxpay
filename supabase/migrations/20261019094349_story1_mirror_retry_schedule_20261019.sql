-- Hosted-only activation when the separately maintained private payment_sync
-- bridge is installed. An isolated Supabase database safely skips scheduling.
-- No service-role key or dispatch token is embedded in the stored job command.
do $install$
begin
  if to_regclass('payment_sync.bridge_config') is null
     or not exists(select 1 from pg_extension where extname='pg_cron')
     or not exists(select 1 from pg_extension where extname='pg_net')
  then
    raise notice 'Story1 mirror cron deferred until the private hosted bridge and pg_net/pg_cron are installed';
    return;
  end if;

  perform cron.schedule(
    'taxpay_story1_office_reconcile',
    '* * * * *',
    $job$
      select net.http_post(
        url := regexp_replace(b.self_url,
          '/payment-sync-bridge/?$', '/demo-story1-taxpay/sync/reconcile'),
        headers := jsonb_build_object(
          'Content-Type','application/json','X-Dispatch-Token',b.dispatch_token),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      )
      from payment_sync.bridge_config b
      where b.singleton and b.enabled
        and b.self_url ~ '^https://[^/]+/functions/v1/payment-sync-bridge/?$'
        and exists(
          select 1 from demo_payment.mirror_outbox q
          where (q.status='PENDING' and q.next_attempt_at<=now())
             or (q.status='CLAIMED' and q.locked_until<now())
        );
    $job$
  );
end;
$install$;
