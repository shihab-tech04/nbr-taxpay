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

test('payer history searches all original receipt and permitted certificate references',()=>{
  const row=entry();
  const refs=accountBeneficiaryPaymentReferences(row);
  for(const ref of ['PN-2026-000392','TOKEN-392','SK-PC-'+paymentId,'GW-392',row.batchId!,paymentId])
    assert.ok(refs.includes(ref),`Missing ${ref}`);
  assert.equal(refs.length,new Set(refs).size);
  assert.ok(refs.some(value=>value.toLocaleLowerCase().includes('pn-2026-000392')));
});

test('history reference preserves the original challan alongside payment id',()=>{
  assert.equal(displayAccountBeneficiaryPaymentReference(entry()),'PN-2026-000392 · '+paymentId);
  assert.equal(displayAccountBeneficiaryPaymentReference(entry('  ')),paymentId);
  assert.equal(displayAccountBeneficiaryPaymentReference(entry(paymentId)),paymentId);
});
