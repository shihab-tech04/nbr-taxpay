import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20261110180000_taxpay_verified_story1_owner_claim.sql', import.meta.url),
  'utf8',
);

test('account payment history claims require the existing authorized owner binding AND exact session', () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /JOIN public\.sim_payment_account_bindings|FROM public\.sim_payment_account_bindings/);
  assert.match(migration, /profile\.payment_session_id\s*=\s*p_session_id/);
  assert.match(migration, /b\.owner_uid\s*=\s*v_uid/);
  assert.match(migration, /IF v_demo_id IS NULL THEN[\s\S]*?RETURN 0;/);
});

test('payment ownership is fail-closed for cross-profile sessions, preserving existing rows', () => {
  assert.match(migration, /SESSION_PAYMENT_SCOPE_MISMATCH/);
  assert.match(migration, /payment\.data->>'origin'\s+IS DISTINCT FROM 'TAXPAY_UI'/);
  assert.match(migration, /payment\.data->'details'->>'payerId'\s+IS DISTINCT FROM v_demo_id/);
  assert.match(migration, /ON CONFLICT \(payment_id\) DO NOTHING/);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b|\bUPDATE\s+demo_payment\.story_payments\b/i);
});

test('anonymous callers never gain account payment ownership through RPC', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.taxpay_claim_story1_session\(uuid\) FROM PUBLIC, anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.taxpay_claim_story1_session\(uuid\) TO authenticated/);
});
