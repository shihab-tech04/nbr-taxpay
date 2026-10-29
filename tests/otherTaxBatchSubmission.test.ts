import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOtherTaxBatch, loadOtherTaxBatch, saveOtherTaxBatch, syncOtherTaxBatch,
  confirmedBatchReceipts,
} from '../src/services/otherTaxBatchSubmission.ts';
import type { StoryPaymentAcknowledgement, StoryPaymentInput } from '../src/services/simulatedPaymentStory.ts';
import type { ChallanReceipt, PaymentLineItem } from '../src/types/tax.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (headId: number, amount: number): PaymentLineItem => ({
  headId, economicCode: '68A', headNameEn: 'Advance tax', taxAmount: amount,
  penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0, totalAmount: amount,
});
const receipt: ChallanReceipt = {
  id: 'parent', challanNo: 'unused', tokenNumber: 'unused', paymentCategory: 'OTHER_TAX_PAYMENT',
  assessmentYear: 'Multiple years', payerName: 'Payer', payerTin: 'GUEST', taxpayerTin: '111111111111',
  receiptMobile: '01712345678', isRepresentativePayment: true, taxZone: '—', taxCircle: '—',
  isWithholding: false, items: [line(1, 0.15), line(2, 0.35)], totalAmount: 0.50,
  paymentMethod: 'BKASH', gatewayTransactionId: 'unused', treasuryStatus: 'INITIATED',
  taxCreditStatus: 'PENDING_RECONCILIATION', createdAt: '2026-10-29 10:00:00', isSimulatedDemo: true,
};
const template: StoryPaymentInput = {
  idempotencyKey: id(99), sessionId: id(100), service: 'OTHER_TAX_PAYMENT', amountMinor: 50,
  details: { payerName: 'Payer', paymentChannel: 'NOW', paymentMethod: 'BKASH', receiptMobile: '01712345678' },
};
const sources = [
  { sourceId: 'line-1', taxpayerTin: '111111111111', taxpayerName: 'Alpha', assessmentYear: '2026-27', amountMinor: 15, line: line(1, 0.15) },
  { sourceId: 'line-2', taxpayerTin: '222222222222', taxpayerName: 'Beta', assessmentYear: '2025-26', amountMinor: 35, line: line(2, 0.35) },
];
const makeBatch = (phase: 'READY' | 'PENDING_BANK' = 'READY') => {
  let n = 0;
  return createOtherTaxBatch(template, receipt, sources, phase, () => id(++n));
};
function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}
const ack = (paymentId: string): StoryPaymentAcknowledgement => ({
  success: true, id: paymentId, status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
});

test('each cart item becomes a distinct, correctly scoped request and receipt', () => {
  const batch = makeBatch();
  assert.equal(batch.amountMinor, 50);
  assert.deepEqual(batch.items.map(item => item.payload.amountMinor), [15, 35]);
  assert.notEqual(batch.items[0].payload.idempotencyKey, batch.items[1].payload.idempotencyKey);
  for (let i = 0; i < sources.length; i++) {
    const item = batch.items[i];
    assert.equal(item.payload.details.taxpayerTin, sources[i].taxpayerTin);
    assert.equal(item.payload.details.assessmentYear, sources[i].assessmentYear);
    assert.deepEqual(item.payload.details.allocations, [{ taxpayerTin: sources[i].taxpayerTin,
      taxpayerName: sources[i].taxpayerName, headId: sources[i].line.headId,
      assessmentYear: sources[i].assessmentYear, amountMinor: sources[i].amountMinor }]);
    assert.equal(item.receipt.items.length, 1);
    assert.equal(item.receipt.totalAmount, sources[i].amountMinor / 100);
  }
});

test('partial sync and lost acknowledgement recover after reload without duplicate records', async () => {
  const storage = memoryStorage(), batch = makeBatch();
  const created = new Map<string, string>(), attempts: StoryPaymentInput[] = [];
  let loseResponse = true;
  const submit = async (input: StoryPaymentInput) => {
    attempts.push(structuredClone(input));
    const paymentId = created.get(input.idempotencyKey) ?? id(200 + created.size);
    created.set(input.idempotencyKey, paymentId);
    if (input.idempotencyKey === batch.items[1].payload.idempotencyKey && loseResponse) {
      loseResponse = false;
      throw Error('response lost after write');
    }
    return ack(paymentId);
  };
  await assert.rejects(syncOtherTaxBatch(batch, submit, () => {}, storage));
  const restored = loadOtherTaxBatch(template.sessionId, storage)!;
  assert.equal(restored.items.filter(item => item.confirmedId).length, 1);
  const finished = await syncOtherTaxBatch(restored, submit, () => {}, storage);
  assert.equal(finished.phase, 'COMPLETE');
  assert.equal(created.size, 2);
  assert.equal(attempts.length, 3);
  assert.deepEqual(attempts[1], attempts[2]);
  assert.deepEqual(confirmedBatchReceipts(finished).map(item => item.paymentTransactionId), [id(200), id(201)]);
  assert.equal(loadOtherTaxBatch(template.sessionId, storage)?.phase, 'COMPLETE');
});

test('storage failure blocks sending and an unfinished bank slip cannot submit', async () => {
  const storage = memoryStorage();
  let sent = 0;
  const submit = async () => { sent++; return ack(id(300)); };
  await assert.rejects(syncOtherTaxBatch(makeBatch(), submit, () => {}, {
    ...storage, setItem: () => { throw Error('storage unavailable'); },
  }));
  await assert.rejects(syncOtherTaxBatch(makeBatch('PENDING_BANK'), submit, () => {}, storage));
  assert.equal(sent, 0);
});

test('a storage failure after an acknowledgement retries the same request', async () => {
  const stored = memoryStorage(), batch = makeBatch();
  let writes = 0;
  const storage = { ...stored, setItem: (key: string, value: string) => {
    if (++writes === 2) throw Error('storage unavailable after acknowledgement');
    stored.setItem(key, value);
  } };
  const records = new Map<string, string>(), attempted: string[] = [];
  const submit = async (input: StoryPaymentInput) => {
    attempted.push(input.idempotencyKey);
    const paymentId = records.get(input.idempotencyKey) ?? id(400 + records.size);
    records.set(input.idempotencyKey, paymentId);
    return ack(paymentId);
  };
  await assert.rejects(syncOtherTaxBatch(batch, submit, () => {}, storage));
  const retry = loadOtherTaxBatch(template.sessionId, stored)!;
  const finished = await syncOtherTaxBatch(retry, submit, () => {}, stored);
  assert.equal(finished.phase, 'COMPLETE');
  assert.equal(attempted[0], attempted[1]);
  assert.equal(records.size, 2);
});

test('only one synchronization runs at a time in the same page', async () => {
  const batch = makeBatch(), storage = memoryStorage();
  let release: (() => void) | undefined;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let count = 0;
  const submit = async () => { if (++count === 1) await wait; return ack(id(500 + count)); };
  const first = syncOtherTaxBatch(batch, submit, () => {}, storage);
  await assert.rejects(syncOtherTaxBatch(batch, submit, () => {}, storage), /BATCH_IN_PROGRESS/);
  release!();
  assert.equal((await first).phase, 'COMPLETE');
  assert.equal(count, 2);
});

test('corrupt or mismatched recovery data is rejected rather than silently replaced', () => {
  const storage = memoryStorage(), batch = makeBatch();
  saveOtherTaxBatch(batch, storage);
  assert.throws(() => loadOtherTaxBatch(id(101), storage));
  storage.setItem('taxpay-other-tax-batch-v1', '{broken');
  assert.throws(() => loadOtherTaxBatch(template.sessionId, storage));
  const changed = structuredClone(batch);
  changed.items[1].payload.details.taxpayerTin = '999999999999';
  assert.throws(() => saveOtherTaxBatch(changed, storage));
  assert.throws(() => createOtherTaxBatch({ ...template, amountMinor: 51 }, receipt, sources, 'READY'));
  assert.throws(() => createOtherTaxBatch({ ...template, details: { ...template.details, payerName: 'A'.repeat(12000) } }, receipt, sources, 'READY'), /PAYMENT_DETAILS_TOO_LONG/);
});
