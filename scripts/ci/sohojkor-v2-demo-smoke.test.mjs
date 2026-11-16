import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDemoLogin } from './sohojkor-v2-demo-smoke.mjs';

// Guard the deployed Edge function source contract as well as the hosted test.
test('Edge login is limited to user1–user30 and exact fictional passwords', () => {
  const source = readFileSync(new URL('../../supabase/functions/taxpay-guest-beneficiaries/index.ts', import.meta.url), 'utf8');
  const branch = source.split("if (action === 'demo-login') {")[1]?.split("const data = await rpc")[0];
  assert.ok(branch, 'demo-login branch must exist');
  assert.ok(branch.includes('!/^user(?:[1-9]|[12][0-9]|30)$/.test(body.userId)'), 'user31–user55 must be denied');
  assert.ok(branch.includes('body.password !== body.userId'), 'incorrect fictional passwords must be denied');
});

const valid = {
  profileId: 'user1',
  capability: 'a'.repeat(43),
  paymentSessionId: '550e8400-e29b-41d4-a716-446655440000',
  language: 'en',
};

test('accepts exact fictional account and opaque capability', () => {
  assert.equal(validateDemoLogin(valid, 'user1'), true);
});
test('rejects wrong user identity', () => {
  assert.equal(validateDemoLogin(valid, 'user30'), false);
});
test('rejects invalid session, capability and language', () => {
  assert.equal(validateDemoLogin({...valid, capability: 'bad'}, 'user1'), false);
  assert.equal(validateDemoLogin({...valid, paymentSessionId: 'not-a-uuid'}, 'user1'), false);
  assert.equal(validateDemoLogin({...valid, language: 'invalid'}, 'user1'), false);
});
