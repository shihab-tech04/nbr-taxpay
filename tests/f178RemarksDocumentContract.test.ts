import test from 'node:test';
import assert from 'node:assert/strict';
import { makeConfirmedReceipt } from '../src/services/confirmedPaymentCertificate.ts';

test('F-178 / US-181: receipt document payload preserves the full 16,000-byte SQL remark',()=>{
  const remarks='😀'.repeat(4000);
  const details={
    challanRemarks:remarks,
    paymentRemarks:'stale legacy alias',
    receiptSnapshot:{
      paymentCategory:'OTHER_TAX_PAYMENT',
      totalAmount:1,
      paymentRemarks:'stale snapshot copy',
      items:[],
    },
  };
  const before=structuredClone(details);
  const receipt=makeConfirmedReceipt({
    id:'92000000-0000-4000-8000-000000000001',
    service:'OTHER_TAX_PAYMENT',
    amountMinor:100,
    status:'SIMULATED_SUCCESS',
    createdAt:'2026-11-20T00:00:00.000Z',
    details,
  });

  assert.equal(receipt.paymentRemarks,remarks);
  assert.equal([...receipt.paymentRemarks!].length,4000);
  assert.equal(new TextEncoder().encode(receipt.paymentRemarks).byteLength,16000);
  assert.deepEqual(details,before,'Receipt assembly must not mutate the original SQL record');
});
