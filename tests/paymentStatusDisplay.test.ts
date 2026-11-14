import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentStatusLabel } from '../src/services/paymentStatusDisplay';

test('F-054: known saved statuses remain understandable in EN and BN', () => {
  assert.equal(paymentStatusLabel('INITIATED', 'en'), 'Initiated');
  assert.equal(paymentStatusLabel('INITIATED', 'bn'), 'শুরু হয়েছে');
  assert.equal(paymentStatusLabel('PENDING_RECONCILIATION', 'en'), 'Reconciliation pending');
  assert.equal(paymentStatusLabel('CREDITED_TO_LEDGER', 'bn'), 'ক্রেডিট যাচাই হয়নি');
});

test('F-054: local payment records do not assert gateway or Treasury settlement', () => {
  assert.equal(paymentStatusLabel('GATEWAY_SUCCESS', 'en', true), 'Payment record saved');
  assert.equal(paymentStatusLabel('GATEWAY_SUCCESS', 'bn', true), 'পেমেন্ট রেকর্ড সংরক্ষিত');
  assert.equal(paymentStatusLabel('TREASURY_SCROLLED', 'en', true), 'Treasury status not verified');
  assert.equal(paymentStatusLabel('TREASURY_SCROLLED', 'bn', true), 'ট্রেজারির অবস্থা যাচাই হয়নি');
});

test('F-054: unknown internal statuses do not leak their raw codes', () => {
  for (const status of ['SIMULATED_SUCCESS', 'PRIVATE_WORKFLOW_FLAG', '', 'GATEWAY_PENDING_UNKNOWN']) {
    for (const language of ['en', 'bn'] as const) {
      const display = paymentStatusLabel(status, language);
      assert.equal(display, language === 'bn' ? 'অবস্থা যাচাই করা যায়নি' : 'Status unavailable');
      assert.equal(display.includes(status) && status.length > 0, false);
    }
  }
});
