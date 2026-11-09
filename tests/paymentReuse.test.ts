import test from 'node:test';
import assert from 'node:assert/strict';
import {reuseRecordedPayment} from '../src/services/paymentReuse.ts';
import type {ChallanReceipt} from '../src/types/tax.ts';
const receipt = {
  id:'r1',challanNo:'SIM-1',tokenNumber:'SIM-token',paymentCategory:'OTHER_TAX_PAYMENT',
  assessmentYear:'2025-26, 2026-27',payerName:'Payer',payerTin:'1234567890123',
  taxpayerTin:undefined,receiptMobile:'01712345678',isRepresentativePayment:true,
  taxZone:'—',taxCircle:'—',isWithholding:false,items:[
    {headId:1,economicCode:'H1',headNameEn:'Head1',taxAmount:10,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:10},
    {headId:2,economicCode:'H2',headNameEn:'Head2',taxAmount:20,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:20}
  ],allocationItems:[
    {taxpayerName:'Own',taxpayerTin:'1234567890123',paymentServiceEn:'Head1',paymentServiceBn:'Head1',assessmentYear:'2026-27',amountMinor:1000},
    {taxpayerName:'Friend',taxpayerTin:'9999999999999',paymentServiceEn:'Head2',paymentServiceBn:'Head2',assessmentYear:'2025-26',amountMinor:2000}
  ],totalAmount:30,paymentMethod:'SIMULATED',gatewayTransactionId:'SIM-TXN',
  treasuryStatus:'GATEWAY_SUCCESS',taxCreditStatus:'PENDING_RECONCILIATION',createdAt:'2026-11-09',isSimulatedDemo:true
} as ChallanReceipt;
test('copies original mixed own/other/head/year allocations without altering paid record',()=>{
 const before=JSON.stringify(receipt);
 const draft=reuseRecordedPayment([receipt],'ownerUid','1234567890123','original-payment');
 assert.equal(draft.ownerUid,'ownerUid');assert.equal(draft.service,'OTHER_TAX_PAYMENT');
 assert.equal(draft.formPayload.forSelf,true);
 assert.deepEqual((draft.formPayload.otherTaxLines as Array<{assessmentYear:string}>).map(l=>l.assessmentYear),['2026-27','']);
 assert.deepEqual((draft.formPayload.otherTaxLines as Array<{amount:string}>).map(l=>l.amount),['10.00','20.00']);
 assert.equal((draft.formPayload.additionalTaxpayers as unknown[]).length,1);
 assert.equal(draft.formPayload.noticeReference,'');
 assert.equal(JSON.stringify(receipt),before);
});
test('refuses incomplete and mismatched receipt data',()=>{
 assert.throws(()=>reuseRecordedPayment([{...receipt,allocationItems:[]}],'owner','1234567890123','ref'));
 assert.throws(()=>reuseRecordedPayment([{...receipt,totalAmount:99}],'owner','1234567890123','ref'));
 assert.throws(()=>reuseRecordedPayment([{...receipt,items:[...receipt.items,receipt.items[0]]}],'owner','1234567890123','ref'));
 assert.throws(()=>reuseRecordedPayment([{...receipt,paymentCategory:'TRAVEL_TAX'}],'owner','1234567890123','ref'));
});

test('preserves complete multi-taxpayer mixed-head multi-year source without reusing receipt identity',()=>{
 const extended = {...receipt,
   id:'r-combined',challanNo:'SIM-COMBINED',totalAmount:40,
   items:[...receipt.items, {...receipt.items[0],headId:3,totalAmount:5,taxAmount:5},
     {...receipt.items[1],headId:4,totalAmount:5,taxAmount:5}],
   allocationItems:[...receipt.allocationItems!,
     {...receipt.allocationItems![0],taxpayerTin:'8888888888888',assessmentYear:'2027-28',amountMinor:500},
     {...receipt.allocationItems![1],taxpayerTin:'9999999999999',assessmentYear:'2026-27',amountMinor:500}]
 } as ChallanReceipt;
 const before=JSON.stringify(extended);
 const copy=reuseRecordedPayment([extended],'signed-in-owner','1234567890123','source-payment');
 const lines=copy.formPayload.otherTaxLines as Array<{taxpayerId:string;headId:number;assessmentYear:string;amount:string}>;
 assert.equal(lines.length,4);
 assert.deepEqual(lines.map(line=>line.headId),[1,2,3,4]);
 assert.deepEqual(lines.map(line=>line.assessmentYear),['2026-27','','','2026-27']);
 assert.deepEqual(lines.map(line=>line.amount),['10.00','20.00','5.00','5.00']);
 assert.equal(copy.formPayload.forSelf,true);
 assert.equal((copy.formPayload.additionalTaxpayers as unknown[]).length,2);
 assert.equal(copy.sourcePaymentId,'source-payment');
 assert.equal(Object.keys(copy.formPayload).some(key=>/challan|transaction|gateway|treasury|authorization|idempotency/i.test(key)),false);
 lines[0].amount='1.00';
 assert.equal(JSON.stringify(extended),before);
});
test('cannot reuse a partial grouped batch or unreconciled line amount',()=>{
 const grouped={...receipt,batchId:'batch-1',batchItemCount:2,batchItemIndex:1};
 assert.throws(()=>reuseRecordedPayment([grouped],'owner','1234567890123','batch-1'),/complete original batch/);
 assert.throws(()=>reuseRecordedPayment([
   grouped,{...grouped,id:'second',batchItemIndex:1}
 ],'owner','1234567890123','batch-1'),/complete original batch/);
 assert.throws(()=>reuseRecordedPayment([
   {...grouped,allocationItems:[{...receipt.allocationItems![0],amountMinor:2000},receipt.allocationItems![1]]},
   {...grouped,id:'second',batchItemIndex:2}
 ],'owner','1234567890123','batch-1'),/reconciled/);
});

test('Travel Tax reuse copies itinerary and people but never treats masked passports as verified',()=>{
 const travel={...receipt,paymentCategory:'TRAVEL_TAX' as const,
   assessmentYear:'2026-27',items:[{...receipt.items[0],totalAmount:30,taxAmount:30}],
   totalAmount:30,travelDetails:{
     mode:'LAND' as const,departurePort:'Benapole',destination:'India',travelDate:'2026-11-12',
     economicCode:'1144102',
     passengers:[{name:'Test Passenger',passportMasked:'••••1234',nationality:'BD' as const,
       country:'Bangladesh',ageBand:'ADULT' as const,age:34,amount:30}]
   }};
 const draft=reuseRecordedPayment([travel],'owner','1234567890123','travel-origin');
 assert.equal(draft.service,'TRAVEL_TAX');
 assert.equal(draft.formPayload.travelDate,'');
 assert.equal(draft.formPayload.port,'Benapole');
 assert.equal(draft.formPayload.destination,'India');
 const people=draft.formPayload.passengers as Array<{passport:string;name:string;birthDate:string;identitySource:string}>;
 assert.deepEqual(people.map(p=>p.name),['Test Passenger']);
 assert.deepEqual(people.map(p=>p.passport),['']);
 assert.deepEqual(people.map(p=>p.birthDate),['']);
 assert.deepEqual(people.map(p=>p.identitySource),['PENDING']);
 assert.equal(JSON.stringify(draft).includes('••••1234'),false);
 assert.throws(()=>reuseRecordedPayment([{...travel,
   travelDetails:{...travel.travelDetails,passengers:[{...travel.travelDetails.passengers[0],amount:0}]}
 }],'owner','1234567890123','travel-origin'),/cannot be reconciled/);
});
