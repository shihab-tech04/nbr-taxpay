import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareCombinedOtherTaxPayment, saveCombinedOtherTaxRequest,
  loadCombinedOtherTaxRequest, clearCombinedOtherTaxRequest
} from '../src/services/otherTaxCombinedPayment.ts';
import {bindPreviewStoryPayer} from '../src/services/simulatedPaymentStory.ts';
import {makeConfirmedReceipt} from '../src/services/confirmedPaymentCertificate.ts';
import type {ChallanReceipt,PaymentLineItem} from '../src/types/tax.ts';
import type {StoryPaymentInput} from '../src/services/simulatedPaymentStory.ts';

const id='11111111-2222-4333-8444-555555555555';
const session='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const items:PaymentLineItem[]=[
 {headId:68,economicCode:'68A',headNameEn:'Advance tax',taxAmount:15,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:15},
 {headId:69,economicCode:'68B',headNameEn:'Motor vehicle advance tax',taxAmount:35,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:35},
];
const receipt:ChallanReceipt={
 id:'rcpt-'+id,challanNo:'SIM-'+id,tokenNumber:'SIM-TOKEN-'+id,
 paymentCategory:'OTHER_TAX_PAYMENT',assessmentYear:'Multiple years',
 payerName:'Payer',payerTin:'1111111111111',taxpayerTin:'909000000013',
 receiptMobile:'01712345678',isRepresentativePayment:true,taxZone:'—',taxCircle:'—',
 isWithholding:false,items,totalAmount:50,paymentMethod:'BKASH',
 gatewayTransactionId:'SIM-TXN-'+id,treasuryStatus:'INITIATED',
 taxCreditStatus:'PENDING_RECONCILIATION',createdAt:'2026-11-08 12:00:00',isSimulatedDemo:true
};
const input:StoryPaymentInput={
 idempotencyKey:id,sessionId:session,service:'OTHER_TAX_PAYMENT',amountMinor:5000,
 details:{payerMode:'OTHER',assessmentYear:'2026-27',taxpayerTin:'909000000013',
 payerName:'Payer',lines:items,receiptSnapshot:receipt,totalAmount:50}
};
const allocations=[
 {sourceId:'one',taxpayerTin:'909000000013',taxpayerName:'Person 13',assessmentYear:'2026-27',amountMinor:1500,line:items[0]},
 {sourceId:'two',taxpayerTin:'000000000018',taxpayerName:'Person 18',assessmentYear:'2025-26',amountMinor:3500,line:items[1]},
];
const mk=()=>prepareCombinedOtherTaxPayment(input,receipt,allocations);
const store=()=>{
 const map=new Map<string,string>();
 return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
};
test('multi-taxpayer combined payment uses ONE idempotency key and ONE challan',()=>{
 const result=mk();
 assert.equal(result.payload.idempotencyKey,id);
 assert.equal(result.receipt.challanNo,'SIM-'+id);
 assert.equal(result.payload.amountMinor,5000);
 assert.equal(result.receipt.totalAmount,50);
 assert.deepEqual(result.receipt.allocationItems?.map(x=>[x.taxpayerTin,x.assessmentYear,x.amountMinor]),[
   ['909000000013','2026-27',1500],['000000000018','2025-26',3500]]);
 assert.equal(result.payload.details.combinedPayment,true);
 assert.equal(result.payload.details.taxpayerCount,2);
 assert.equal((result.payload.details.allocations as unknown[]).length,2);
 assert.equal(result.payload.details.batchItemCount,undefined,'no split-payment record');
});
test('the signed-in payer keeps both saved beneficiaries inside one scoped SQL submission',()=>{
 const grouped=mk();
 const bound=bindPreviewStoryPayer(grouped.payload,{profileId:'user1',paymentSessionId:session});
 const signed=bound.details.lines as Array<Record<string,unknown>>;
 assert.equal(signed.length,2);
 assert.deepEqual(signed.map(x=>x.beneficiary),['user13','SAVED_TIN:000000000018']);
 assert.deepEqual(signed.map(x=>x.amountMinor),[1500,3500]);
 assert.deepEqual(signed.map(x=>x.taxpayerTin),['909000000013','000000000018']);
 assert.equal(bound.idempotencyKey,id);
 assert.deepEqual(bound,bindPreviewStoryPayer(grouped.payload,{profileId:'user1',paymentSessionId:session}));
 const confirmed=makeConfirmedReceipt({id,service:'OTHER_TAX_PAYMENT',amountMinor:5000,
  status:'SIMULATED_SUCCESS',createdAt:'2026-11-08T12:00:00Z',details:bound.details});
 assert.equal(confirmed.totalAmount,50);
 assert.equal(confirmed.paymentTransactionId,id);
 assert.deepEqual(confirmed.allocationItems?.map(item=>[item.taxpayerTin,item.economicCode,item.amountMinor]),
  [['909000000013','68A',1500],['000000000018','68B',3500]]);
});
test('pending combined request is recoverable with same identity, and cannot leak across sessions',()=>{
 const storage=store(), request=mk();
 saveCombinedOtherTaxRequest(request,'READY',storage);
 const restored=loadCombinedOtherTaxRequest(session,storage);
 assert.equal(restored?.request.payload.idempotencyKey,id);
 assert.equal(restored?.request.receipt.challanNo,receipt.challanNo);
 assert.equal(loadCombinedOtherTaxRequest('99999999-aaaa-4ccc-8ddd-eeeeeeeeeeee',storage),null,'another taxpayer has no access to this pending request');
 assert.equal(loadCombinedOtherTaxRequest(session,storage)?.request.receipt.challanNo,receipt.challanNo);
 clearCombinedOtherTaxRequest(session,storage);
 assert.equal(loadCombinedOtherTaxRequest(session,storage),null);
});
test('fail closed for amount mismatch, invalid TIN, duplicate allocation and altered references',()=>{
 assert.throws(()=>prepareCombinedOtherTaxPayment({...input,amountMinor:4999},receipt,allocations),/COMBINED_TOTAL_MISMATCH/);
 assert.throws(()=>prepareCombinedOtherTaxPayment(input,receipt,[{...allocations[0],taxpayerTin:'INVALID'},allocations[1]]),/INVALID_COMBINED_ALLOCATION/);
 assert.throws(()=>prepareCombinedOtherTaxPayment(input,receipt,[allocations[0],{...allocations[1],sourceId:'one'}]),/INVALID_COMBINED_PAYMENT/);
 const storage=store(); const request=mk();
 assert.throws(()=>saveCombinedOtherTaxRequest({payload:request.payload,receipt:{...request.receipt,challanNo:'SIM-FORGED'}},'READY',storage),/INVALID_COMBINED_RECOVERY/);
});
