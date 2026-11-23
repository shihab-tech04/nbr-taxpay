import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountBeneficiaryPaymentReferences,
  displayAccountBeneficiaryPaymentReference,
} from '../src/services/accountBeneficiaryHistoryReferences';
import type { BeneficiaryPaymentEntry } from '../src/services/story1AccountPaymentHistory';

const paymentId='eae7a3e9-8b6b-423d-9618-3cc8f1f14401';
const entry=(challanNo='PN-2026-000392'):BeneficiaryPaymentEntry=>({
  key:paymentId+':0',paymentId,beneficiaryName:'Taxpayer',taxpayerTin:'001234567890',
  assessmentYear:'2025-26',paymentHead:'Income tax',amountMinor:5000,
  batchId:'0bca2394-3b29-4a52-987c-633a8620aa11',
  receipt:{
    id:paymentId,challanNo,tokenNumber:'TOKEN-392',paymentTransactionId:paymentId,
    gatewayTransactionId:'GW-392',
  } as BeneficiaryPaymentEntry['receipt'],
});

test('payer history finds the original receipt and permitted Payment Certificate references',()=>{
  const row=entry();
  const references=accountBeneficiaryPaymentReferences(row);
  assert.ok(references.includes('PN-2026-000392'));
  assert.ok(references.includes('TOKEN-392'));
  assert.ok(references.includes('SK-PC-'+paymentId));
  assert.ok(references.includes('GW-392'));
  assert.ok(references.includes(row.batchId!));
  assert.ok(references.includes(paymentId));
  assert.equal(references.some(value=>value.toLocaleLowerCase().includes('pn-2026-000392')),
    true);
});

test('history reference column shows the original challan and preserves the payment ID',()=>{
  assert.equal(displayAccountBeneficiaryPaymentReference(entry()),'PN-2026-000392 · '+paymentId);
  assert.equal(displayAccountBeneficiaryPaymentReference(entry('  ')),paymentId);
  assert.equal(displayAccountBeneficiaryPaymentReference(entry(paymentId)),paymentId);
});
