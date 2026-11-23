import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GiftTaxPaymentResult} from '../src/components/screens/GiftTaxPaymentResult';
import {
  initiateGiftTaxPayment, validatedGiftTaxSettlement,
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
    const html=renderToStaticMarkup(React.createElement(GiftTaxPaymentResult,{
      language:'en',input,outcome,onBack:()=>undefined,onRetry:()=>undefined,
    }));
    assert.equal(html.includes('Download receipt'),false);
    assert.equal(html.includes('Download challan'),false);
    assert.equal(html.includes('gift-tax-settled-documents'),false);
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
  const html=renderToStaticMarkup(React.createElement(GiftTaxPaymentResult,{
    language:'bn',input,outcome:settled,onBack:()=>undefined,onRetry:()=>undefined,
  }));
  assert.equal(html.includes('Download receipt'),false);
  assert.equal(html.includes('gift-tax-settled-documents'),false);
});
