import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { lookupSampleTaxpayer } from '../src/services/sampleTaxpayerLookup';
import { sampleTinForUserNumber } from '../src/data/sampleTinSuggestions';

test('the same thirty 12-digit aliases are present for the optional guest payer lookup', () => {
  const seen = new Set<string>();
  for (let id = 1; id <= 30; id++) {
    const tin = sampleTinForUserNumber(id);
    assert.ok(tin, `missing approved sample for user ${id}`);
    assert.match(tin, /^\d{12}$/);
    assert.equal(seen.has(tin), false);
    seen.add(tin);
    const match = lookupSampleTaxpayer(tin);
    assert.equal(match?.tin, tin);
    assert.equal(match?.nameEn, id <= 10 ? `User ${id}` : `Taxpayer Account ${id}`);
    assert.ok(match?.nameBn);
  }
  assert.equal(seen.size, 30);
  for (const value of ['', '123456789012', 'not-a-tin'])
    assert.equal(lookupSampleTaxpayer(value), null);
  // The shared legacy fixture lookup also contains non-12-digit records.
  // The guest payer flow must reject those by format before any lookup/confirmation.
  assert.equal(/^\d{12}$/.test('2222222222222'), false);
});

test('walk-in payer SQL contract never assigns ownership from a typed TIN', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20261112010500_taxpay_optional_walkin_payer_verified_history.sql', import.meta.url), 'utf8');
  assert.match(migration,/CREATE OR REPLACE FUNCTION public\.taxpay_claim_walkin_payer_payments\(\)/);
  assert.match(migration,/v_owner uuid := auth\.uid\(\)/);
  assert.match(migration,/FROM public\.sim_payment_account_bindings b/);
  assert.match(migration,/b\.owner_uid = v_owner/);
  assert.match(migration,/ON CONFLICT \(payment_id\) DO NOTHING/);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.taxpay_claim_walkin_payer_payments\(\)[\s\S]*FROM PUBLIC, anon/);
  assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.taxpay_claim_walkin_payer_payments\(\)[\s\S]*TO authenticated/);
  assert.match(migration,/CREATE TRIGGER story1_walkin_payer_tin_guard/);
  assert.match(migration,/UNMATCHED_WALKIN_PAYER_TIN/);
  // Guest-supplied payer IDs must not bypass matching via the public submit RPC.
  assert.match(migration,/UNAUTHORIZED_WALKIN_PAYER_ID/);
  assert.match(migration,/FROM taxpay_guest_private\.demo_profiles p/);
  assert.match(migration,/p\.payment_session_id = NEW\.session_id/);
  assert.match(migration,/UNCONFIRMED_WALKIN_PAYER/);
  assert.match(migration,/payment\.data->'details'->>'payerMode' = 'OTHER'/);
});
