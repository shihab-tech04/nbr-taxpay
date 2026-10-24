import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileStoryPaymentNotices } from '../src/services/storyNotificationReconciliation';
import type { StoryPaymentNotice, StorySessionPayment } from '../src/services/simulatedPaymentStory';

const payment: StorySessionPayment = {
  id: 'sample-1', service: 'TAX_WITH_RETURN', amountMinor: 125050,
  status: 'SIMULATED_SUCCESS', createdAt: '2026-10-24T10:00:00Z'
};
const notice: StoryPaymentNotice = {
  id: 1, paymentId: payment.id, type: 'SIMULATED_PAYMENT_SUCCESS',
  createdAt: '2026-10-24T10:00:00Z'
};

test('in-app notice displays exact SQL paisa amount without rounding to a fictional sum', () => {
  const joined = reconcileStoryPaymentNotices([notice], [payment]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].amountMinor, 125050);
  assert.equal(joined[0].service, 'TAX_WITH_RETURN');
  assert.equal(joined[0].paymentId, payment.id);
});

test('unmatched, unknown and unsafe payments are never shown as successfully simulated', () => {
  assert.throws(() => reconcileStoryPaymentNotices([notice], []), /verified session payment amount/);
  assert.throws(() => reconcileStoryPaymentNotices([notice], [{...payment,status:'PENDING'}]), /verified session payment amount/);
  assert.throws(() => reconcileStoryPaymentNotices([notice], [{...payment,amountMinor:1250.5}]), /verified session payment amount/);
  assert.throws(() => reconcileStoryPaymentNotices([notice], [{...payment,amountMinor:Number.MAX_SAFE_INTEGER+1}]), /verified session payment amount/);
  assert.throws(() => reconcileStoryPaymentNotices([{...notice,type:'OFFICIAL_PAYMENT_SETTLED'}], [payment]), /verified session payment amount/);
});

test('notice reconciliation does not mix amounts from different session records', () => {
  const other = {...payment,id:'sample-2',amountMinor:95000};
  const joined = reconcileStoryPaymentNotices([{...notice,id:2,paymentId:'sample-2'},notice], [payment,other]);
  assert.deepEqual(joined.map(x=>x.amountMinor), [95000,125050]);
});
