import test from 'node:test';
import assert from 'node:assert/strict';
import {reuseRecordedPayment,reuseLegacySingleHeadPayment} from '../src/services/paymentReuse.ts';
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

test('does not reuse duplicate allocations for the same taxpayer, head and year',()=>{
 const duplicate={...receipt,
   items:[receipt.items[0],receipt.items[0]],
   allocationItems:[receipt.allocationItems![0],receipt.allocationItems![0]],
   totalAmount:20,
 };
 assert.throws(()=>reuseRecordedPayment([duplicate],'owner','1234567890123','source'),/duplicate taxpayer\/head\/year/);
});

test('historical SQL single-head payment opens editable repeat without guessing an unrecorded head',()=>{
  const source={
    id:'572659b2-4f41-496f-b72c-a9189a3ccb61',
    service:'TAX_WITH_RETURN',status:'SIMULATED_SUCCESS',amountMinor:2500000,
    details:{payerId:'user1',taxpayerTin:'1111111111111',assessmentYear:'2025-26',
      lines:[{beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2025-26',amountMinor:2500000}],
      paymentMethod:'SIMULATED'}
  };
  const original=JSON.stringify(source);
  const draft=reuseLegacySingleHeadPayment(source,'user1','1111111111111');
  assert.equal(draft.service,'TAX_WITH_RETURN');
  assert.equal(draft.formPayload.forSelf,true);
  assert.equal(draft.formPayload.legacySourceAmount,'25000.00');
  assert.equal(draft.formPayload.assessmentYear,'');
  assert.deepEqual(draft.formPayload.selectedHeadIds,[]);
  assert.deepEqual(draft.formPayload.amountInputs,{});
  assert.equal(draft.formPayload.incomeTaxType,null);
  assert.equal(draft.formPayload.noticeReference,'');
  assert.equal(JSON.stringify(source),original);
  const newYear=reuseLegacySingleHeadPayment({...source,details:{...source.details,
    assessmentYear:'2026-27',lines:[{...source.details.lines[0],assessmentYear:'2026-27'}]}
  },'user1','1111111111111');
  assert.equal(newYear.formPayload.assessmentYear,'2026-27');
});
test('historical head IDs never auto-select a current payment head',()=>{
  const source={
    id:'616259b2-4f41-496f-b72c-a9189a3ccb61',
    service:'ADVANCE_TAX',status:'SIMULATED_SUCCESS',amountMinor:5500,
    details:{payerId:'user1',taxpayerTin:'1111111111111',assessmentYear:'2025-26',
      lines:[{category:'ADVANCE_TAX',beneficiary:'user1',assessmentYear:'2025-26',
        amountMinor:5500,headId:11,headNameEn:'Old Advance Tax Quarter',economicCode:'1-1141-0015-0201'}]}
  };
  const result=reuseLegacySingleHeadPayment(source,'user1','1111111111111');
  assert.equal(result.formPayload.legacySourceAmount,'55.00');
  assert.deepEqual(result.formPayload.selectedHeadIds,[]);
  assert.deepEqual(result.formPayload.amountInputs,{});
  assert.equal(result.formPayload.assessmentYear,'');
  assert.throws(()=>reuseLegacySingleHeadPayment({
    ...source,details:{...source.details,lines:[{...source.details.lines[0],headId:-1}]}
  },'user1','1111111111111'));
  assert.throws(()=>reuseLegacySingleHeadPayment({
    ...source,details:{...source.details,lines:[{...source.details.lines[0],taxpayerTin:'9999999999999'}]}
  },'user1','1111111111111'));
});
test('legacy reuse refuses mixed Tax-with-Return, multiple lines, mismatched amount and modern snapshots',()=>{
  const sample={
    id:'c0227104-60d9-4827-be36-eba397e62c41',
    service:'TAX_WITH_RETURN',status:'SIMULATED_SUCCESS',amountMinor:5000,
    details:{payerId:'user1',taxpayerTin:'1111111111111',assessmentYear:'2026-27',
      lines:[{beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:3500}]}
  };
  assert.throws(()=>reuseLegacySingleHeadPayment({...sample,details:{...sample.details,
    lines:[...sample.details.lines,{beneficiary:'user1',category:'ADVANCE_TAX',assessmentYear:'2025-26',amountMinor:1500}]}
  },'user1','1111111111111'));
  assert.throws(()=>reuseLegacySingleHeadPayment(sample,'user1','1111111111111'));
  assert.throws(()=>reuseLegacySingleHeadPayment({...sample,status:'FAILED'},'user1','1111111111111'));
  assert.throws(()=>reuseLegacySingleHeadPayment({...sample,details:{...sample.details,payerId:'user2',
    lines:[{...sample.details.lines[0],amountMinor:5000}]}
  },'user1','1111111111111'));
  assert.throws(()=>reuseLegacySingleHeadPayment({...sample,details:{...sample.details,
    receiptSnapshot:{id:'old'},lines:[{...sample.details.lines[0],amountMinor:5000}]}
  },'user1','1111111111111'));
  assert.throws(()=>reuseLegacySingleHeadPayment({...sample,service:'TRAVEL_TAX',
    details:{...sample.details,lines:[{...sample.details.lines[0],category:'TRAVEL_TAX',amountMinor:5000}]}
  },'user1','1111111111111'));
});

test('Pay Again copies a Return-only receipt with multiple beneficiaries and years into the same editable allocation journey',()=>{
  const returnReceipt={...receipt,paymentCategory:'TAX_WITH_RETURN' as const,
    items:receipt.items.map(item=>({...item,headId:125,economicCode:'74',headNameEn:'Tax with return'})),
    allocationItems:receipt.allocationItems!.map(item=>({...item,paymentServiceEn:'Tax with return',economicCode:'74'}))};
  const original=JSON.stringify(returnReceipt);
  const again=reuseRecordedPayment([returnReceipt],'ownerUid','1234567890123','return-payment-id');
  assert.equal(again.service,'TAX_WITH_RETURN');
  assert.equal(again.formPayload.returnBatchRequested,true);
  assert.equal(again.formPayload.forSelf,true);
  assert.deepEqual((again.formPayload.otherTaxLines as Array<{headId:number;assessmentYear:string;amount:string}>)
    .map(line=>[line.headId,line.assessmentYear,line.amount]),
    [[125,'2026-27','10.00'],[125,'','20.00']]);
  assert.equal((again.formPayload.additionalTaxpayers as unknown[]).length,1);
  assert.deepEqual(again.formPayload.selectedHeadIds,[]);
  assert.deepEqual(again.formPayload.amountInputs,{});
  assert.equal(again.formPayload.incomeTaxType,null);
  assert.equal(again.formPayload.noticeReference,'');
  assert.equal(JSON.stringify(again.formPayload).includes('SIM-token'),false);
  assert.equal(JSON.stringify(returnReceipt),original);
});
test('Return-only Pay Again rejects mixed heads and incomplete allocation snapshots',()=>{
  const returnReceipt={...receipt,paymentCategory:'TAX_WITH_RETURN' as const,
    items:receipt.items.map(item=>({...item,headId:125})),
    allocationItems:receipt.allocationItems!};
  assert.throws(()=>reuseRecordedPayment([{...returnReceipt,
    items:[returnReceipt.items[0],{...returnReceipt.items[1],headId:121}]}],
    'owner','1234567890123','source'),/Tax with Return/);
  assert.throws(()=>reuseRecordedPayment([{...returnReceipt,
    taxpayerTin:'1234567890123',assessmentYear:'2026-27',allocationItems:undefined,
    items:[{...returnReceipt.items[0],headId:121}],totalAmount:10}],
    'owner','1234567890123','source'),/Tax with Return/);
  assert.throws(()=>reuseRecordedPayment([{...returnReceipt,
    allocationItems:receipt.allocationItems!.slice(0,1)}],
    'owner','1234567890123','source'),/incomplete|reconciled/);
  assert.throws(()=>reuseRecordedPayment([{...returnReceipt,
    allocationItems:receipt.allocationItems!.map((a,i)=>({...a,amountMinor:i?1000:1000}))}],
    'owner','1234567890123','source'),/reconciled/);
});
test('single-recipient legacy Return receipt retains its original form instead of forcing the allocation composer',()=>{
  const single={...receipt,paymentCategory:'TAX_WITH_RETURN' as const,
    taxpayerTin:'1234567890123',assessmentYear:'2026-27',
    items:[{...receipt.items[0],headId:125}],allocationItems:undefined,totalAmount:10};
  const copy=reuseRecordedPayment([single],'owner','1234567890123','single-source');
  assert.equal(copy.formPayload.returnBatchRequested,false);
  assert.deepEqual(copy.formPayload.otherTaxLines,[]);
  assert.deepEqual(copy.formPayload.selectedHeadIds,[125]);
});
