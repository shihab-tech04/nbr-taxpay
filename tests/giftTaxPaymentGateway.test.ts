import assert from 'node:assert/strict';
import test from 'node:test';
import {
  initiateGiftTaxPayment, validatedGiftTaxSettlement, simulateGiftTaxPayment,
  type GiftTaxPaymentInput, type GiftTaxPaymentOutcome,
} from '../src/services/giftTaxPaymentGateway';

const input: GiftTaxPaymentInput = {
  donor: {tin:'111111111111',name:'Sample Donor'},
  donee: {tin:'222222222222',name:'Sample Donee',tag:'friends_family',relationship:'father',otherLabel:null},
  giftAmountMinor:250000000, estimatedTaxMinor:27200000,
  description:'Gift of property',giftDate:'2025-01-15',remarks:'Review',idempotencyKey:'00000000-0000-4000-8000-000000000001',
};

test('Gift Tax gateway fails closed; a simulated payment never creates money, receipt or donor credit',async()=>{
  const r=await initiateGiftTaxPayment(input);
  assert.deepEqual(r,{kind:'UNAVAILABLE',code:'OFFICIAL_GIFT_TAX_NOT_CONFIGURED'});
  assert.equal(validatedGiftTaxSettlement(r,input),null);
});

test('Pending and failed records never unlock receipts, downloads or official tax credit',()=>{
  for(const outcome of [
    {kind:'PENDING',requestId:'a',reference:'pending',receivedAt:'2026-11-23T00:00:00Z'},
    {kind:'FAILED',requestId:'b',reason:'Rejected',retryable:true},
  ] as GiftTaxPaymentOutcome[]) {
    assert.equal(validatedGiftTaxSettlement(outcome,input),null);
  }
});

test('A mismatched, incomplete or non-official settlement cannot unlock documents',()=>{
  const settled: GiftTaxPaymentOutcome = {kind:'SETTLED',requestId:'test',verified:{
    issuer:'OFFICIAL_PAYMENT_GATEWAY', sourceEvidenceRef:'not-real',
    paymentReference:'not-real',governmentChallanNo:'not-real',
    receiptDocumentUrl:'https://example.invalid/receipt',
    challanDocumentUrl:'https://example.invalid/challan',
    donorTin:'222222222222', doneeTin:input.donee.tin,
    donorZone:'',donorCircle:'',confirmedAmountMinor:input.estimatedTaxMinor,
    confirmedAt:'2026-11-23T00:00:00Z',donorCreditPostingReference:'',
  }};
  assert.equal(validatedGiftTaxSettlement(settled,input),null);

});

test('Gift Tax uses the existing three meaningful synthetic gateway outcomes with no official credits',()=>{
  const online=simulateGiftTaxPayment(input,'BKASH');
  assert.equal(online.kind,'SIMULATED_SUCCESS');
  assert.equal(validatedGiftTaxSettlement(online,input),null);
  if(online.kind==='SIMULATED_SUCCESS') assert.match(online.reference,/^SIM-GIFT-/);
  const pending=simulateGiftTaxPayment(input,'BANK_BRANCH');
  assert.equal(pending.kind,'SIMULATED_PENDING');
  assert.equal(validatedGiftTaxSettlement(pending,input),null);
  const failed=simulateGiftTaxPayment(input,'BKASH',true);
  assert.equal(failed.kind,'SIMULATED_FAILED');
  assert.equal(validatedGiftTaxSettlement(failed,input),null);
  const zero=simulateGiftTaxPayment({...input,estimatedTaxMinor:0},'SIMULATED');
  assert.equal(zero.kind,'SIMULATED_NO_TAX');
  const invalid=simulateGiftTaxPayment({...input,donor:input.donee},'BKASH');
  assert.equal(invalid.kind,'SIMULATED_FAILED');
});

test('Gift Tax simulated success is distinct from settlement and never validates as an official credit',()=>{
  const outcome=simulateGiftTaxPayment(input,'BKASH');
  assert.equal(outcome.kind,'SIMULATED_SUCCESS');
  assert.equal(validatedGiftTaxSettlement(outcome,input),null);
  assert.equal('verified' in outcome,false);
  if(outcome.kind==='SIMULATED_SUCCESS'){
    assert.match(outcome.reference,/^SIM-GIFT-/);
    assert.equal('donorCreditPostingReference' in outcome,false);
  }
});
