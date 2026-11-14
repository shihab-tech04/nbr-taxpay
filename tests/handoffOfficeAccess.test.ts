import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresVerifiedOfficeIdentity } from '../supabase/functions/taxpay-handoff-api/officeGuard';

test('all Office-only routes fail closed pending verified Office identity', () => {
  for (const path of [
    '/office',
    '/office/inbox',
    '/office/payments/8228689f-aa18-4581-8a2e-c9c628541bce/review',
    '/office/payments/8228689f-aa18-4581-8a2e-c9c628541bce/state',
    '/office/unknown',
  ]) {
    assert.equal(requiresVerifiedOfficeIdentity(path), true, path);
  }
});
test('existing public synthetic taxpayer routes stay outside Office guard', () => {
  for (const path of [
    '/payments',
    '/payments/8228689f-aa18-4581-8a2e-c9c628541bce',
    '/payments/8228689f-aa18-4581-8a2e-c9c628541bce/summary',
    '/notifications',
    '/notifications/5',
    '/officer',
  ]) {
    assert.equal(requiresVerifiedOfficeIdentity(path), false, path);
  }
});
