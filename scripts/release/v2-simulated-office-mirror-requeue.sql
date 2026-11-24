-- Sohojkor simulation-only recovery. MANUAL, NOT auto-applied by migrations.
-- Prerequisites: Office's signed V2 source selector and Taxpayer V2 Story 1
-- dispatcher are deployed; verify the SIX immutable IDs are ABSENT from Office.
-- The payment-v1 financial bridge remains DISABLED throughout.
-- This changes only retry bookkeeping, not any payment, amount, owner, receipt,
-- credit, certificate, or SQL/Auth identity. Re-running fails closed.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $verify_v2_sim_mirror$
DECLARE v_rows integer;
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM payment_sync.bridge_config
   WHERE singleton AND enabled=false
     AND self_url='https://gmuhitmaynfhipcvbvkh.supabase.co/functions/v1/payment-sync-bridge'
     AND peer_url='https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/payment-sync-bridge'
 ) OR NOT EXISTS (
   SELECT 1 FROM payment_sync.settings WHERE singleton AND origin='TAXPAY_SQL'
 ) THEN
   RAISE EXCEPTION 'UNVERIFIED_SIMULATION_SOURCE_OR_FINANCIAL_BRIDGE_NOT_DISABLED';
 END IF;
 SELECT count(*) INTO v_rows
 FROM demo_payment.mirror_outbox o
 JOIN demo_payment.story_payments p ON p.id=o.entity_id
 WHERE o.entity_type='PAYMENT'
   AND o.status='ACKED'
   AND p.status='SIMULATED_SUCCESS'
   AND p.created_at < timestamptz '2026-11-13T00:00:00+00';
 IF v_rows<>6 THEN
   RAISE EXCEPTION 'SIMULATED_MIRROR_EXPECTED_SIX_ACKS_GOT_%',v_rows;
 END IF;
END;
$verify_v2_sim_mirror$;

UPDATE demo_payment.mirror_outbox o
SET status='PENDING',attempts=0,next_attempt_at=now(),
    claim_token=NULL,locked_until=NULL,acknowledged_at=NULL,
    last_error='V2_SIMULATED_OFFICE_ID_READBACK_MISSING_20261116',
    updated_at=now()
FROM demo_payment.story_payments p
WHERE p.id=o.entity_id
  AND o.entity_type='PAYMENT'
  AND o.status='ACKED'
  AND p.status='SIMULATED_SUCCESS'
  AND p.created_at < timestamptz '2026-11-13T00:00:00+00';
COMMIT;

-- NEXT: invoke only the authenticated private V2
-- /demo-story1-taxpay/sync/reconcile Story 1 dispatcher. Re-verify 6/6
-- exact Office IDs, payload digest, amount, head, status, allocations,
-- immutable original 23/23 Office rows, and ACKED only after Office readback.
