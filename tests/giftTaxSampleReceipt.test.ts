import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveGiftTaxReceipt} from '../src/services/giftTaxSampleReceipt';
import type {GiftTaxPaymentInput,GiftTaxPaymentOutcome} from '../src/services/giftTaxPaymentGateway';
const input:GiftTaxPaymentInput={donor:{tin:'111111111111',name:'Donor'},donee:{tin:'222222222222',name:'Donee',tag:'friends_family',relationship:'father',otherLabel:null},giftAmountMinor:250000000,estimatedTaxMinor:27200000,giftDate:'2025-07-01',description:'Gift of property',remarks:'বাংলা\nExact remarks',idempotencyKey:'00000000-0000-4000-8000-000000000101',payer:{name:'Separate payer',tin:'333333333333',phone:'01712345678',email:'',noticeReference:''}};
const success:Extract<GiftTaxPaymentOutcome,{kind:'SIMULATED_SUCCESS'}>={kind:'SIMULATED_SUCCESS',reference:'SIM-GIFT-'+input.idempotencyKey,method:'BKASH',createdAt:'2026-11-24T06:00:00Z'};
test('local Gift receipt keeps service, AY, three independent parties and exact remarks',()=>{
 const receipt=resolveGiftTaxReceipt(input,success,false)!;
 assert.equal(receipt.paymentCategory,'GIFT_TAX');assert.equal(receipt.assessmentYear,'2026-27');
 assert.equal(receipt.payerName,'Separate payer');assert.equal(receipt.payerTin,'333333333333');
 assert.equal(receipt.taxpayerName,'Donor');assert.equal(receipt.taxpayerTin,'111111111111');
 assert.deepEqual(receipt.giftDetails?.donee,input.donee);assert.equal(receipt.paymentRemarks,input.remarks);
 assert.equal(receipt.totalAmount,272000);assert.equal(receipt.items[0].totalAmount,272000);
 assert.equal(receipt.challanNo,success.reference);assert.equal(receipt.isSimulatedDemo,true);
 assert.equal(receipt.taxCreditStatus,'NOT_APPLICABLE');assert.equal(receipt.treasuryStatus,'INITIATED');
 assert.equal(receipt.paymentTransactionId,undefined);
});
test('optional payer TIN is not invented from donor; June date keeps prior AY',()=>{
 const receipt=resolveGiftTaxReceipt({...input,giftDate:'2025-06-30',payer:{...input.payer!,tin:''}},success,false)!;
 assert.equal(receipt.payerTin,'');assert.equal(receipt.taxpayerTin,input.donor.tin);
 assert.equal(receipt.assessmentYear,'2025-26');
});
test('signed-in success never falls back to local receipt; authoritative snapshot is returned unchanged',()=>{
 assert.equal(resolveGiftTaxReceipt(input,success,true),null);
 const source={...resolveGiftTaxReceipt(input,success,false)!,paymentTransactionId:'00000000-0000-4000-8000-000000000102'};
 assert.strictEqual(resolveGiftTaxReceipt(input,{...success,receipt:source},true),source);
 assert.equal(resolveGiftTaxReceipt(input,{kind:'SIMULATED_SYNC_PENDING',reference:success.reference,method:'BKASH'},false),null);
 assert.equal(resolveGiftTaxReceipt(input,{kind:'SIMULATED_NO_TAX'},false),null);
});
