import test from 'node:test';
import assert from 'node:assert/strict';
import { PAYMENT_SERVICE_IDS, resolvePaymentServiceAccess } from '../src/services/paymentServiceAccessPolicy';

test('all eight v11 payment services permit the public payment path', () => {
  assert.equal(PAYMENT_SERVICE_IDS.length, 8);
  for (const service of PAYMENT_SERVICE_IDS) {
    const decision = resolvePaymentServiceAccess(service, 'MAKE_PAYMENT');
    assert.equal(decision.kind, 'PUBLIC', service);
    assert.equal(decision.requiresTin, service !== 'TRAVEL_TAX', service);
    assert.equal(decision.requiresNBRReference, service === 'OTHER_TAX_PAYMENT', service);
  }
});

test('account records are private regardless of the selected payment category', () => {
  for (const service of PAYMENT_SERVICE_IDS) {
    assert.equal(resolvePaymentServiceAccess(service, 'VIEW_ACCOUNT_RECORDS').kind, 'SIGN_IN_REQUIRED');
  }
});

test('eTDS allocation is protected and applies only to withholding deposits', () => {
  for (const service of PAYMENT_SERVICE_IDS) {
    const decision = resolvePaymentServiceAccess(service, 'ALLOCATE_ETDS_DEPOSIT');
    assert.equal(decision.kind, service === 'SOURCE_TAX_DEPOSIT' ? 'SIGN_IN_REQUIRED' : 'NOT_APPLICABLE');
  }
});

test('private income-tax drafts require sign-in; travel tax is a separate guest journey', () => {
  for (const service of PAYMENT_SERVICE_IDS) {
    assert.equal(resolvePaymentServiceAccess(service, 'SAVE_PRIVATE_DRAFT').kind,
      service === 'TRAVEL_TAX' ? 'NOT_APPLICABLE' : 'SIGN_IN_REQUIRED');
  }
});
