import assert from 'node:assert/strict';
import {test} from 'node:test';
import {persistSimulatedPayment, sourceReadbackMatches, type StoryPaymentInput} from '../src/services/simulatedPaymentStory';

const paymentId = '00000000-0000-4000-8000-000000001015';
const payment: StoryPaymentInput = {
  idempotencyKey: '10000000-0000-4000-8000-000000001015',
  sessionId: '20000000-0000-4000-8000-000000001015',
  service: 'OTHER_TAX_PAYMENT',
  amountMinor: 12500,
  details: {payerMode: 'SELF', taxpayerTin: '012345678901', assessmentYear: '2026-27'},
};
const sqlRecord = (data: StoryPaymentInput = payment) => ({
  id: paymentId, status: 'SIMULATED_SUCCESS', data,
});

test('source SQL readback verifies identity, amount, status and scope even without remarks', () => {
  assert.equal(sourceReadbackMatches(sqlRecord(), paymentId, payment), true);
  assert.equal(sourceReadbackMatches({...sqlRecord(), status: 'PENDING'}, paymentId, payment), false);
  assert.equal(sourceReadbackMatches(sqlRecord(), '00000000-0000-4000-8000-000000001016', payment), false);
  assert.equal(sourceReadbackMatches(sqlRecord({...payment, amountMinor: 12600}), paymentId, payment), false);
  assert.equal(sourceReadbackMatches(sqlRecord({...payment, sessionId: 'wrong-session'}), paymentId, payment), false);
  assert.equal(sourceReadbackMatches(sqlRecord({...payment, idempotencyKey: 'wrong-key'}), paymentId, payment), false);
  assert.equal(sourceReadbackMatches(sqlRecord({...payment, service: 'TRAVEL_TAX'}), paymentId, payment), false);
});

test('source SQL readback keeps exact challan remarks and receipt snapshot reconciliation', () => {
  const withRemarks: StoryPaymentInput = {...payment, details: {
    ...payment.details, challanRemarks: 'Reference 15 / গুরুত্বপূর্ণ',
    receiptSnapshot: {challanRemarks: 'Reference 15 / গুরুত্বপূর্ণ'},
  }};
  assert.equal(sourceReadbackMatches(sqlRecord(withRemarks), paymentId, withRemarks), true);
  assert.equal(sourceReadbackMatches(sqlRecord({...withRemarks, details: {
    ...withRemarks.details, receiptSnapshot: {challanRemarks: 'wrong note'},
  }}), paymentId, withRemarks), false);
  assert.equal(sourceReadbackMatches(sqlRecord({...withRemarks, details: {
    ...withRemarks.details, challanRemarks: 'different note',
  }}), paymentId, withRemarks), false);
});

async function withSimulatedApi(
  readback: (input: StoryPaymentInput) => Record<string, unknown>,
  check: (counts: {posts: number; reads: number}) => Promise<void>,
) {
  const existingFetch = globalThis.fetch;
  let posts = 0;
  let reads = 0;
  try {
    globalThis.fetch = async (url, init) => {
      const requestUrl = String(url);
      if (init?.method === 'POST' && requestUrl.endsWith('/payments')) {
        posts++;
        return Response.json({success: true, id: paymentId, status: 'SIMULATED_SUCCESS',
          mirrored: true, simulationOnly: true});
      }
      if (requestUrl.includes('/payments/' + paymentId + '?sessionId=')) {
        reads++;
        return Response.json({success: true, simulationOnly: true, data: readback(payment)});
      }
      throw new Error('Unexpected simulated API request: ' + requestUrl);
    };
    await check({get posts() {return posts;}, get reads() {return reads;}});
  } finally {
    globalThis.fetch = existingFetch;
  }
}

test('Office-mirrored success without remarks still requires exact Taxpayer SQL readback', async () => {
  await withSimulatedApi(() => sqlRecord(), async counts => {
    const result = await persistSimulatedPayment(payment);
    assert.equal(result.officeSyncStatus, 'SYNCED');
    assert.equal(result.id, paymentId);
    assert.equal(counts.posts, 1);
    assert.equal(counts.reads, 1);
  });
});

test('Office-mirrored success cannot present success when source SQL readback differs', async () => {
  await withSimulatedApi((input) => sqlRecord({...input, amountMinor: input.amountMinor + 1}), async counts => {
    await assert.rejects(persistSimulatedPayment(payment), /SIMULATION_READBACK_MISMATCH/);
    assert.equal(counts.posts, 1);
    assert.equal(counts.reads, 1);
  });
});
