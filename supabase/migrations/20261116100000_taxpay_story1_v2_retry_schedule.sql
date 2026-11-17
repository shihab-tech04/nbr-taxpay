-- V2-only Story 1 simulation mirror recovery. Keep the financial payment_sync
-- bridge disabled, preserve Office Auth/RLS, and never embed the dispatch token
-- in cron.job or a browser bundle. Existing named job is updated idempotently.
-- Rollback for a newly installed job: select cron.unschedule('taxpay_story1_office_reconcile');
DO $setup$
DECLARE v_approved_v2 boolean;
BEGIN
  IF to_regclass('payment_sync.bridge_config') IS NULL
     OR to_regclass('demo_payment.mirror_outbox') IS NULL
     OR to_regclass('cron.job') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net')
     OR to_regprocedure('demo_payment.story1_requeue_expired_authorizations(timestamptz)') IS NULL
  THEN
    RAISE NOTICE 'Story 1 mirror retry schedule omitted: hosted dependencies not installed';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM payment_sync.bridge_config b
    WHERE b.singleton AND b.enabled IS FALSE
      AND b.self_url='https://gmuhitmaynfhipcvbvkh.supabase.co/functions/v1/payment-sync-bridge'
      AND b.peer_url='https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/payment-sync-bridge'
      AND b.dispatch_token IS NOT NULL AND length(b.dispatch_token)>0
  ) INTO v_approved_v2;
  IF NOT v_approved_v2 THEN
    RAISE NOTICE 'Story 1 mirror retry schedule omitted: not approved V2-only simulation pair';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'taxpay_story1_office_reconcile', '* * * * *',
    $job$
      WITH newly_expired AS (
        SELECT demo_payment.story1_requeue_expired_authorizations() AS total
      )
      SELECT net.http_post(
        url := 'https://gmuhitmaynfhipcvbvkh.supabase.co/functions/v1/demo-story1-taxpay/sync/reconcile',
        headers := jsonb_build_object('Content-Type','application/json',
                                      'X-Dispatch-Token',b.dispatch_token),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      )
      FROM payment_sync.bridge_config b CROSS JOIN newly_expired e
      WHERE b.singleton AND b.enabled IS FALSE
        AND b.self_url='https://gmuhitmaynfhipcvbvkh.supabase.co/functions/v1/payment-sync-bridge'
        AND b.peer_url='https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/payment-sync-bridge'
        AND (e.total>0 OR EXISTS (
          SELECT 1 FROM demo_payment.mirror_outbox q
          WHERE (q.status='PENDING' AND q.next_attempt_at<=now())
             OR (q.status='CLAIMED' AND q.locked_until<now())
        ));
    $job$
  );
END;
$setup$;
