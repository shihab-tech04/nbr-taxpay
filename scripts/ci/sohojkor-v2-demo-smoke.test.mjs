import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDemoLogin } from './sohojkor-v2-demo-smoke.mjs';

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
