import assert from 'node:assert/strict';
import { createOtherTaxBatch, loadOtherTaxBatch, syncOtherTaxBatch } from '../../src/services/otherTaxBatchSubmission.ts';
import type { StoryPaymentAcknowledgement, StoryPaymentInput } from '../../src/services/simulatedPaymentStory.ts';
import type { ChallanReceipt, PaymentLineItem } from '../../src/types/tax.ts';

// Stable QA IDs and payloads make every CI rerun a replay instead of creating more records.
const tax = 'https://eyqhoavnitkrajvyqvxn.supabase.co/functions/v1/demo-story1-taxpay';
const sessionId = '7ea10000-0000-4000-8000-000000000001';
const ids = ['7ea10000-0000-4000-8000-000000000002', '7ea10000-0000-4000-8000-000000000003', '7ea10000-0000-4000-8000-000000000004'];
let nextId = 0;
const line = (headId: number, amount: number): PaymentLineItem => ({
  headId, economicCode: headId === 122 ? '68A' : '68B', headNameEn: 'Advance tax',
  taxAmount: amount, penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0, totalAmount: amount,
});
const receipt: ChallanReceipt = {
  id: 'batch-parent', challanNo: 'unused', tokenNumber: 'unused', paymentCategory: 'OTHER_TAX_PAYMENT',
  assessmentYear: 'Multiple years', payerName: 'QA Batch Payer', payerTin: 'GUEST', taxpayerTin: '111111111111',
  receiptMobile: '01700000000', isRepresentativePayment: true, taxZone: '—', taxCircle: '—', isWithholding: false,
  items: [line(122, 15), line(123, 35)], totalAmount: 50, paymentMethod: 'BKASH',
  gatewayTransactionId: 'unused', treasuryStatus: 'INITIATED', taxCreditStatus: 'PENDING_RECONCILIATION',
  createdAt: '2026-10-29 00:00:00', isSimulatedDemo: true,
};
const template: StoryPaymentInput = {
  idempotencyKey: '7ea10000-0000-4000-8000-000000000005', sessionId, service: 'OTHER_TAX_PAYMENT', amountMinor: 5000,
  details: { payerName: receipt.payerName, payerTin: receipt.payerTin, payerMode: 'OTHER',
    receiptMobile: receipt.receiptMobile, paymentChannel: 'NOW', paymentMethod: receipt.paymentMethod },
};
const batch = createOtherTaxBatch(template, receipt, [
  { sourceId: 'qa-batch-item-1', taxpayerTin: '111111111111', taxpayerName: 'QA Taxpayer One', assessmentYear: '2026-27', amountMinor: 1500, line: line(122, 15) },
  { sourceId: 'qa-batch-item-2', taxpayerTin: '222222222222', taxpayerName: 'QA Taxpayer Two', assessmentYear: '2025-26', amountMinor: 3500, line: line(123, 35) },
], 'READY', () => ids[nextId++]);
const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); } };
const seen = new Map<string, string>();
let loseSecondAcknowledgement = true;
let calls = 0;
async function submit(input: StoryPaymentInput): Promise<StoryPaymentAcknowledgement> {
  calls++;
  const response = await fetch(tax + '/payments', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, origin: 'QA_BROWSER' }), signal: AbortSignal.timeout(30000) });
  const body = await response.json() as StoryPaymentAcknowledgement & { replayed?: boolean; error?: string };
  assert.equal(response.status, 200, `Hosted submission failed: ${body.error ?? response.status}`);
  assert.equal(body.success, true); assert.equal(body.mirrored, true);
  const previous = seen.get(input.idempotencyKey);
  if (previous) { assert.equal(body.id, previous); assert.equal(body.replayed, true); }
  seen.set(input.idempotencyKey, body.id);
  if (input.idempotencyKey === batch.items[1].payload.idempotencyKey && loseSecondAcknowledgement) {
    loseSecondAcknowledgement = false;
    throw Error('deliberately lost acknowledgement');
  }
  return body;
}

await assert.rejects(syncOtherTaxBatch(batch, submit, () => {}, storage), /deliberately lost acknowledgement/);
const pending = loadOtherTaxBatch(sessionId, storage)!;
assert.equal(pending.items.filter(item => item.confirmedId).length, 1);
const completed = await syncOtherTaxBatch(pending, submit, () => {}, storage);
assert.equal(completed.phase, 'COMPLETE');
assert.equal(calls, 3);
assert.equal(seen.size, 2);
for (const [index, item] of completed.items.entries()) {
  const response = await fetch(tax + '/payments/' + item.confirmedId + '?sessionId=' + sessionId,
    { signal: AbortSignal.timeout(30000) });
  const body = await response.json() as { success: boolean; data: { id: string; data: StoryPaymentInput } };
  assert.equal(response.status, 200); assert.equal(body.success, true); assert.equal(body.data.id, item.confirmedId);
  assert.equal(body.data.data.amountMinor, index === 0 ? 1500 : 3500);
  assert.equal(body.data.data.details.taxpayerTin, index === 0 ? '111111111111' : '222222222222');
  assert.equal(body.data.data.details.assessmentYear, index === 0 ? '2026-27' : '2025-26');
}
console.log('PASS: two stable QA records, Office acknowledgements, lost-response replay and TaxPay readback',
  completed.items.map(item => item.confirmedId).join(' '));
