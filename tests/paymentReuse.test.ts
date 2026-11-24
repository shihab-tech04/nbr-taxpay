import test from 'node:test';
import assert from 'node:assert/strict';
import {reuseRecordedPayment,reuseLegacySingleHeadPayment,oneChoicePerRecordedParent,parseGiftTaxReuseDraft} from '../src/services/paymentReuse.ts';
import type {ChallanReceipt} from '../src/types/tax.ts';
import {V11_PAYMENT_OPTIONS} from '../src/data/v11PaymentOptions.ts';
import {makeConfirmedReceipt} from '../src/services/confirmedPaymentCertificate.ts';
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
 assert.deepEqual((draft.formPayload.otherTaxLines as Array<{assessmentYear:string}>).map(l=>l.assessmentYear),['2026-27','2025-26']);
 assert.deepEqual((draft.formPayload.otherTaxLines as Array<{amount:string}>).map(l=>l.amount),['10.00','20.00']);
 assert.equal((draft.formPayload.additionalTaxpayers as unknown[]).length,1);
 assert.equal(draft.formPayload.noticeReference,'');
 assert.equal(JSON.stringify(receipt),before);
});
test('M09 rejects fractional-cent historical heads and parents without rounding SQL allocations',()=>{
 const sourceSnapshot=JSON.stringify(receipt);
 const check=(source:ChallanReceipt)=>assert.throws(()=>
   reuseRecordedPayment([source],'ownerUid','1234567890123','original-payment'),
   /Invalid historical payment amount/);
 check({...receipt,items:[{...receipt.items[0],totalAmount:10.0001},receipt.items[1]]});
 check({...receipt,totalAmount:30.0001});
 check({...receipt,paymentCategory:'ADVANCE_TAX',allocationItems:undefined,
   taxpayerTin:'1234567890123',items:[{...receipt.items[0],totalAmount:10.0001}],totalAmount:10});
 // Genuine two-decimal amounts remain valid with their exact SQL minor units.
 const valid={...receipt,items:[{...receipt.items[0],taxAmount:10.01,totalAmount:10.01},receipt.items[1]],
   allocationItems:[{...receipt.allocationItems![0],amountMinor:1001},receipt.allocationItems![1]],
   totalAmount:30.01};
 const repeated=reuseRecordedPayment([valid],'ownerUid','1234567890123','original-payment');
 assert.deepEqual((repeated.formPayload.otherTaxLines as Array<{amount:string}>).map(line=>line.amount),
   ['10.01','20.00']);
 assert.equal(JSON.stringify(receipt),sourceSnapshot);
});
test('M09 validates every non-Travel saved tax/fee component before reuse',()=>{
 const sourceSnapshot=JSON.stringify(receipt);
 const originalHead=receipt.items[0];
 const brokenHeads=[
   {...originalHead,taxAmount:10.0001},
   {...originalHead,penaltyAmount:0.01},
   {...originalHead,taxAmount:10.01,penaltyAmount:-0.01},
   {...originalHead,taxAmount:9.99,penaltyAmount:0.0101}
 ];
 for(const head of brokenHeads){
   assert.throws(()=>reuseRecordedPayment([
     {...receipt,items:[head,receipt.items[1]]}
   ],'ownerUid','1234567890123','original-payment'),
   /Invalid historical payment amount|head breakdown does not reconcile/);
 }
 // A legitimate exact-cent fee is not discarded or silently reclassified.
 const balanced={...receipt,items:[
   {...originalHead,taxAmount:9.99,penaltyAmount:0.01},receipt.items[1]
 ]};
 const repeated=reuseRecordedPayment([balanced],'ownerUid','1234567890123','original-payment');
 assert.deepEqual((repeated.formPayload.otherTaxLines as Array<{amount:string}>)
   .map(item=>item.amount),['10.00','20.00']);
 assert.equal(JSON.stringify(receipt),sourceSnapshot);
});
test('Pay Again carries editable long, bilingual challan comments without mutating the source',()=>{
  const remarks='Payment covers multiple years; explanation supplied by taxpayer. বাংলা মন্তব্য: তথ্য যাচাই করুন।';
  assert.ok(remarks.length > 20);
  const original={...receipt,paymentRemarks:remarks};
  const frozen=JSON.stringify(original);
  const draft=reuseRecordedPayment([original],'ownerUid','1234567890123','original-payment');
  assert.equal(draft.formPayload.paymentRemarks,remarks);
  draft.formPayload.paymentRemarks='An edited comment for the new challan';
  assert.equal(original.paymentRemarks,remarks);
  assert.equal(JSON.stringify(original),frozen);
});

test('Pay Again allocates independent UUIDs for every new combined line while retaining historical provenance',()=>{
  const sourceId='11111111-2222-4333-8444-555555555555';
  const historicalIds=['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee','cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa'];
  const original={...receipt,paymentTransactionId:sourceId,
    allocationItems:receipt.allocationItems!.map((a,i)=>({...a,allocationId:historicalIds[i]}))};
  const frozen=JSON.stringify(original);
  const first=reuseRecordedPayment([original],'ownerUid','1234567890123',sourceId);
  const second=reuseRecordedPayment([original],'ownerUid','1234567890123',sourceId);
  const getIds=(copy:typeof first)=>(copy.formPayload.otherTaxLines as Array<{id:string}>).map(x=>x.id);
  const firstIds=getIds(first),secondIds=getIds(second);
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.equal(firstIds.length,2);
  assert.equal(new Set([...firstIds,...secondIds]).size,4,'each Pay Again copy needs independent allocation IDs');
  for(const id of [...firstIds,...secondIds]){
    assert.match(id,uuid);
    assert.equal(historicalIds.includes(id),false,'never use an original allocation ID for a new line');
  }
  assert.deepEqual(first.sourceAllocationIds,historicalIds);
  assert.deepEqual(second.sourceAllocationIds,historicalIds);
  assert.equal(first.sourcePaymentId,sourceId);
  assert.equal(JSON.stringify(original),frozen);
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
 assert.deepEqual(lines.map(line=>line.assessmentYear),['2026-27','2025-26','2027-28','2026-27']);
 assert.deepEqual(lines.map(line=>line.amount),['10.00','20.00','5.00','5.00']);
 assert.equal(copy.formPayload.forSelf,true);
 assert.equal((copy.formPayload.additionalTaxpayers as unknown[]).length,2);
 assert.equal(copy.sourcePaymentId,'source-payment');
 assert.equal(Object.keys(copy.formPayload).some(key=>/challan|transaction|gateway|treasury|authorization|idempotency/i.test(key)),false);
 lines[0].amount='1.00';
 assert.equal(JSON.stringify(extended),before);
});
test('Pay Again keeps all non-Return SQL allocations even when the original parent was filed under one tax category',()=>{
  const originalId='11111111-2222-4333-8444-555555555555';
  const historicalIds=['historical-allocation-a','historical-allocation-b'];
  const original={...receipt,
    paymentTransactionId:originalId,paymentCategory:'ADVANCE_TAX' as const,
    allocationItems:receipt.allocationItems!.map((line,index)=>({
      ...line,allocationId:historicalIds[index]
    }))
  } as ChallanReceipt;
  const frozen=JSON.stringify(original);
  const repeated=reuseRecordedPayment([original],'signed-in-owner','1234567890123',originalId);
  // Both heads, beneficiaries, exact years and amounts belong to ONE new
  // editable composer, not a silently downgraded single-head payment.
  assert.equal(repeated.service,'OTHER_TAX_PAYMENT');
  assert.equal(repeated.formPayload.category,'OTHER_TAX_PAYMENT');
  assert.equal(repeated.sourcePaymentId,originalId);
  assert.deepEqual(repeated.sourceAllocationIds,historicalIds);
  const lines=repeated.formPayload.otherTaxLines as Array<{
    id:string;taxpayerId:string;headId:number;assessmentYear:string;amount:string
  }>;
  assert.equal(lines.length,2);
  assert.deepEqual(lines.map(line=>[line.headId,line.assessmentYear,line.amount]),[
    [1,'2026-27','10.00'],[2,'2025-26','20.00']
  ]);
  assert.equal(new Set(lines.map(line=>line.taxpayerId)).size,2);
  assert.equal(lines.some(line=>historicalIds.includes(line.id)),false);
  lines[0].amount='12.50';
  assert.equal(JSON.stringify(original),frozen);
  assert.throws(()=>reuseRecordedPayment([{...original,allocationItems:[original.allocationItems![0]]}],
    'signed-in-owner','1234567890123',originalId),/incomplete/);
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
   assessmentYear:'2026-27',items:[{...receipt.items[0],headId:155,
     economicCode:'1144102',headNameEn:'Travel tax — Test Passenger',totalAmount:30,taxAmount:30}],
   totalAmount:30,travelDetails:{
     mode:'LAND' as const,departurePort:'Benapole',destination:'India',travelDate:'2026-11-12',
     economicCode:'1144102',
     passengers:[{name:'Test Passenger',passportMasked:'••••1234',nationality:'BD' as const,
       country:'Bangladesh',ageBand:'ADULT' as const,age:34,amount:30}]
   }};
 const before=JSON.stringify(travel);
 const draft=reuseRecordedPayment([travel],'owner','1234567890123','travel-origin');
 assert.equal(draft.service,'TRAVEL_TAX');
 assert.equal(draft.sourcePaymentId,'travel-origin');
 assert.equal(draft.formPayload.travelDate,'');
 assert.equal(draft.formPayload.port,'Benapole');
 assert.equal(draft.formPayload.destination,'India');
 const people=draft.formPayload.passengers as Array<{passport:string;name:string;birthDate:string;identitySource:string}>;
 assert.deepEqual(people.map(p=>p.name),['Test Passenger']);
 assert.deepEqual(people.map(p=>p.passport),['']);
 assert.deepEqual(people.map(p=>p.birthDate),['']);
 assert.deepEqual(people.map(p=>p.identitySource),['PENDING']);
 assert.equal(JSON.stringify(draft).includes('••••1234'),false);
 for(const priorDocumentRef of ['SIM-1','SIM-token','SIM-TXN'])
  assert.equal(JSON.stringify(draft.formPayload).includes(priorDocumentRef),false);
 assert.equal(JSON.stringify(travel),before);
 assert.throws(()=>reuseRecordedPayment([{...travel,
   travelDetails:{...travel.travelDetails,passengers:[{...travel.travelDetails.passengers[0],amount:0}]}
 }],'owner','1234567890123','travel-origin'),/cannot be reconciled/);
});

test('M06 Pay Again preserves child and exempt passenger categories, but requires fresh identity and travel date',()=>{
 const original={
   ...receipt,paymentCategory:'TRAVEL_TAX' as const,totalAmount:1500,
   items:[
     {...receipt.items[0],headId:155,economicCode:'1144102',headNameEn:'Travel tax — Adult Traveller',
       totalAmount:1000,taxAmount:1000},
     {...receipt.items[1],headId:156,economicCode:'1144102',headNameEn:'Travel tax — Child Traveller',
       totalAmount:500,taxAmount:500},
     {...receipt.items[0],headId:157,economicCode:'1144102',headNameEn:'Travel tax — Exempt Traveller',
       totalAmount:0,taxAmount:0},
   ],
   travelDetails:{mode:'LAND' as const,departurePort:'Benapole',destination:'India',
     travelDate:'2026-11-12',economicCode:'1144102',
     passengers:[
       {name:'Adult Traveller',passportMasked:'••••3456',nationality:'BD' as const,
         country:'Bangladesh',ageBand:'ADULT' as const,age:34,amount:1000},
       {name:'Child Traveller',passportMasked:'••••4321',nationality:'FOREIGN' as const,
         country:'India',ageBand:'CHILD' as const,age:9,amount:500},
       {name:'Exempt Traveller',passportMasked:'••••8901',nationality:'FOREIGN' as const,
         country:'India',ageBand:'UNDER5' as const,age:3,amount:0},
     ]},
 };
 const before=JSON.stringify(original);
 const copy=reuseRecordedPayment([original],'owner','1234567890123','travel-origin');
 const people=copy.formPayload.passengers as Array<{
   name:string;ageBand:string;birthDate:string;passport:string;identitySource:string
 }>;
 assert.deepEqual(people.map(x=>x.ageBand),['ADULT','CHILD','UNDER5']);
 assert.deepEqual(people.map(x=>x.name),['Adult Traveller','Child Traveller','Exempt Traveller']);
 assert.deepEqual(people.map(x=>x.birthDate),['','','']);
 assert.deepEqual(people.map(x=>x.passport),['','','']);
 assert.deepEqual(people.map(x=>x.identitySource),['PENDING','MANUAL','MANUAL']);
 assert.equal(copy.formPayload.travelDate,'');
 assert.equal(JSON.stringify(copy).includes('••••3456'),false);
 assert.equal(JSON.stringify(original),before);
 // A previously recorded Travel Tax receipt must not carry a hidden fee into
 // the repeat wizard, even if the visible passenger/parent totals match.
 for(const feeKey of ['penaltyAmount','surchargeAmount','interestAmount'] as const){
   const invalid={...original,items:[
     {...original.items[0],[feeKey]:0.01},...original.items.slice(1)]};
   assert.throws(()=>reuseRecordedPayment([invalid],'owner','1234567890123','travel-origin'),
     /cannot be reconciled/,feeKey+' must not be hidden in a Travel Tax repeat');
 }
 assert.throws(()=>reuseRecordedPayment([{...original,items:[
   {...original.items[0],taxAmount:1000.0001},...original.items.slice(1)]}],
   'owner','1234567890123','travel-origin'),/cannot be reconciled/,
   'fractional-cent saved tax must not be rounded into a valid repeat');
 assert.throws(()=>reuseRecordedPayment([{...original,totalAmount:1500.0001}],
   'owner','1234567890123','travel-origin'),/incomplete|reconcile/,
   'fractional-cent original parent must not be rounded into a valid repeat');
 assert.equal(JSON.stringify(original),before);
 assert.throws(()=>reuseRecordedPayment([{...original,items:[
   {...original.items[0],headId:156},...original.items.slice(1)]}],
   'owner','1234567890123','travel-origin'),/cannot be reconciled/);
 assert.throws(()=>reuseRecordedPayment([{...original,items:[
   {...original.items[0],economicCode:'WRONG'},...original.items.slice(1)]}],
   'owner','1234567890123','travel-origin'),/cannot be reconciled/);
 assert.throws(()=>reuseRecordedPayment([{...original,travelDetails:{
   ...original.travelDetails,passengers:[
     original.travelDetails.passengers[0],{...original.travelDetails.passengers[1],ageBand:'UNKNOWN' as 'CHILD'},
     original.travelDetails.passengers[2]]}}],
   'owner','1234567890123','travel-origin'),/cannot be reconciled/);
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
  assert.equal(draft.formPayload.assessmentYear,'2025-26');
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
test('legacy Pay Again restores long bilingual remarks from original SQL parent',()=>{
  const remarks='Prior payment reference 190.\nবাংলা বিবরণ: পূর্ববর্তী করবর্ষের সংশোধিত চালান।';
  const source={
    id:'572659b2-4f41-496f-b72c-a9189a3ccb61',
    service:'ADVANCE_TAX',status:'SIMULATED_SUCCESS',amountMinor:2500,
    details:{payerId:'user1',taxpayerTin:'1111111111111',assessmentYear:'2025-26',
      paymentRemarks:remarks,
      lines:[{beneficiary:'user1',category:'ADVANCE_TAX',assessmentYear:'2025-26',amountMinor:2500}]}
  };
  assert.ok(remarks.length>20);
  const original=JSON.stringify(source);
  const draft=reuseLegacySingleHeadPayment(source,'user1','1111111111111');
  assert.equal(draft.formPayload.paymentRemarks,remarks);
  draft.formPayload.paymentRemarks='Changed only for new payment';
  assert.equal(source.details.paymentRemarks,remarks);
  assert.equal(JSON.stringify(source),original);
});

test('F-178 / US-181: legacy Pay Again restores canonical challanRemarks without losing multiline Bengali text',()=>{
  const remarks='Invoice note and payer explanation on a new line.\nবাংলা চালানের মন্তব্য: করদাতার বিস্তারিত বিবরণ।';
  const source={
    id:'a8a2c8b5-4d09-4e1b-8e5d-978259be45aa',
    service:'ADVANCE_TAX',status:'SIMULATED_SUCCESS',amountMinor:2500,
    details:{payerId:'user1',taxpayerTin:'1111111111111',assessmentYear:'2025-26',
      challanRemarks:remarks,
      lines:[{beneficiary:'user1',category:'ADVANCE_TAX',assessmentYear:'2025-26',amountMinor:2500}]}
  };
  const pristine=JSON.stringify(source);
  const draft=reuseLegacySingleHeadPayment(source,'user1','1111111111111');
  assert.ok(remarks.length>20);
  assert.ok(remarks.includes('\n'));
  assert.equal(draft.formPayload.paymentRemarks,remarks);
  draft.formPayload.paymentRemarks='New payment comment';
  assert.equal(JSON.stringify(source),pristine);
  assert.equal(source.details.challanRemarks,remarks);
  // Prefer the canonical SQL field if a legacy alias is also present.
  const duplicate={...source,details:{...source.details,paymentRemarks:'Stale alias'}};
  assert.equal(reuseLegacySingleHeadPayment(duplicate,'user1','1111111111111').formPayload.paymentRemarks,remarks);
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
  assert.equal(result.formPayload.assessmentYear,'2025-26');
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

test('Pay Again rejects multi-allocation Return receipts without changing the original',()=>{
  const returnReceipt={...receipt,paymentCategory:'TAX_WITH_RETURN' as const,
    items:receipt.items.map(item=>({...item,headId:125})),
    allocationItems:receipt.allocationItems!};
  const original=JSON.stringify(returnReceipt);
  assert.throws(()=>reuseRecordedPayment([returnReceipt],'ownerUid','1234567890123','return-payment-id'),
    /exactly one taxpayer and one assessment year/);
  assert.equal(JSON.stringify(returnReceipt),original);
});

test('Pay Again uses the single explicit Return allocation in the standard wizard',()=>{
  const single={...receipt,paymentCategory:'TAX_WITH_RETURN' as const,
    items:[{...receipt.items[0],headId:125}],totalAmount:10,
    allocationItems:[{...receipt.allocationItems![0],assessmentYear:'2025-26'}]};
  const copy=reuseRecordedPayment([single],'owner','1234567890123','single-source');
  assert.equal(copy.formPayload.assessmentYear,'2025-26');
  assert.deepEqual(copy.formPayload.otherTaxLines,[]);
  assert.deepEqual(copy.formPayload.selectedHeadIds,[125]);
  assert.deepEqual(copy.formPayload.amountInputs,{125:'10.00'});
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
  assert.deepEqual(copy.formPayload.otherTaxLines,[]);
  assert.deepEqual(copy.formPayload.selectedHeadIds,[125]);
});

test('Pay Again never merges two independent SQL receipts into a fabricated payment batch',()=>{
  const second={...receipt,
    id:'r2', paymentTransactionId:'different-original-payment', challanNo:'SIM-2',
    items:receipt.items.map((item,index)=>({...item,headId:index+31,
      headNameEn:'Second head '+index,economicCode:'H'+(index+31)})),
    allocationItems:receipt.allocationItems!.map((allocation,index)=>({
      ...allocation, taxpayerTin:index===0?'8888888888888':'7777777777777',
      paymentServiceEn:'Second head '+index,
      assessmentYear:'2027-28'})),
  } as ChallanReceipt;
  assert.throws(()=>reuseRecordedPayment([receipt,second],'payer','1234567890123',
    'r1'),/complete original batch|independent|source/i,
    'Separate original payment IDs must not silently become one repeatable receipt');
});

test('Pay Again keeps a genuine complete two-row batch as one editable copy',()=>{
 const first={...receipt,batchId:'batch-checked',batchItemCount:2,batchItemIndex:1};
 const second={...receipt,id:'r-batch-2',batchId:'batch-checked',batchItemCount:2,
   batchItemIndex:2,items:receipt.items.map((item,i)=>({...item,headId:i+51})),
   allocationItems:receipt.allocationItems!.map((item,i)=>({...item,
     taxpayerTin:i===0?'8888888888888':'7777777777777',assessmentYear:'2027-28'}))};
 const copy=reuseRecordedPayment([second,first],'payer','1234567890123','batch-checked');
 const lines=copy.formPayload.otherTaxLines as Array<{headId:number;assessmentYear:string;amount:string}>;
 assert.equal(lines.length,4);
 assert.deepEqual(lines.map(l=>l.headId),[1,2,51,52]);
 assert.deepEqual(lines.map(l=>l.assessmentYear),['2026-27','2025-26','2027-28','2027-28']);
 assert.equal(lines.reduce((total,line)=>total+Number(line.amount),0),60);
 assert.equal(copy.sourcePaymentId,'batch-checked');
});

test('Pay Again must bind the selected source ID to the original immutable SQL payment or complete batch',()=>{
 const originalId='11111111-2222-4333-8444-555555555555';
 const otherId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
 const recorded={...receipt,paymentTransactionId:originalId};
 assert.equal(reuseRecordedPayment([recorded],'owner','1234567890123',originalId).sourcePaymentId,originalId);
 assert.throws(()=>reuseRecordedPayment([recorded],'owner','1234567890123',otherId),
   /original payment|source payment|identity/i,'a different source ID must never be attached to a real recorded receipt');
 const batchId='99999999-aaaa-4ccc-8ddd-eeeeeeeeeeee';
 const batch={...recorded,batchId,batchItemCount:1,batchItemIndex:1};
 assert.equal(reuseRecordedPayment([batch],'owner','1234567890123',batchId).sourcePaymentId,batchId);
 assert.throws(()=>reuseRecordedPayment([batch],'owner','1234567890123',otherId),
  /original payment|source payment|batch/i,'a mismatched batch ID must never be attached to a receipt');
});

// The approved Pay Again entry is not limited to OTHER_TAX_PAYMENT. These
// recorded service journeys still use their existing single-head wizard and
// must not manufacture a new beneficiary, historical year or source payment.
test('single-head Pay Again service matrix retains editable source inputs and exact year rules',()=>{
  const services = ['ADVANCE_TAX','ASSESSED_DEMAND','PENALTY',
    'SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL'] as const;
  for(const service of services){
    const head=V11_PAYMENT_OPTIONS.find(item=>item.category===service && item.status==='ACTIVE');
    assert.ok(head,service+' must have an available source-catalogue head');
    for(const assessmentYear of ['2026-27','2025-26','2027-28'] as const){
      const original={...receipt,paymentCategory:service,taxpayerTin:'1234567890123',
        assessmentYear,allocationItems:undefined,
        items:[{...receipt.items[0],headId:head.id,economicCode:head.economicCode,
          headNameEn:head.nameEn,totalAmount:10,taxAmount:10}],totalAmount:10} as ChallanReceipt;
      const immutable=JSON.stringify(original);
      const sourceId=service+'-'+assessmentYear;
      const reused=reuseRecordedPayment([original],'ownerUid','1234567890123',sourceId);
      assert.equal(reused.service,service);
      assert.equal(reused.sourcePaymentId,sourceId);
      assert.equal(reused.formPayload.forSelf,true);
      assert.deepEqual(reused.formPayload.additionalTaxpayers,[]);
      assert.deepEqual(reused.formPayload.otherTaxLines,[]);
      assert.deepEqual(reused.formPayload.selectedHeadIds,[head.id]);
      assert.deepEqual(reused.formPayload.amountInputs,{[head.id]:'10.00'});
      assert.equal(reused.formPayload.assessmentYear,assessmentYear);
      assert.equal(JSON.stringify(original),immutable,'original payment must remain unchanged');
    }
  }
});

test('Pay Again offers one choice per recorded parent, never one per legacy batch line',()=>{
  const source=[
    {id:'payment-1',batchId:'batch-A',amountMinor:1500},
    {id:'payment-2',batchId:'batch-A',amountMinor:3500},
    {id:'batch-A',amountMinor:700},
    {id:'payment-3',batchId:'batch-B',amountMinor:900},
    {id:'payment-4',batchId:'batch-B',amountMinor:1100},
    {id:'payment-5',amountMinor:800},
  ];
  const original=JSON.stringify(source);
  const choices=oneChoicePerRecordedParent(source,payment=>payment.batchId);
  assert.deepEqual(choices.map(item=>item.id),['payment-1','batch-A','payment-3','payment-5']);
  // Grouped rows are display-only; all saved allocations stay available to
  // the existing complete-batch reconstruction and idempotency checks.
  assert.equal(source.length,6);
  assert.equal(JSON.stringify(source),original);
});


test('M09 Pay Again restores verified SQL accounting rows hidden from combined receipt display',()=>{
  const firstHead=V11_PAYMENT_OPTIONS.find(item=>item.category==='ADVANCE_TAX'&&item.status==='ACTIVE');
  const secondHead=V11_PAYMENT_OPTIONS.find(item=>item.category==='ASSESSED_DEMAND'&&item.status==='ACTIVE');
  assert.ok(firstHead&&secondHead);
  const originalId='5b126b38-9604-4e93-a24f-7c93fcf4f281';
  const source={
    id:originalId,service:'OTHER_TAX_PAYMENT',status:'SIMULATED_SUCCESS',amountMinor:3750,
    createdAt:'2026-11-15T07:30:00.000Z',
    details:{
      payerName:'Source Payer',payerTin:'1111111111111',
      paymentRemarks:'Multiple heads and years. বাংলা মন্তব্য।',
      allocationContractVersion:2,
      lines:[
        {beneficiary:'user1',taxpayerTin:'1111111111111',category:'OTHER_TAX_PAYMENT',
          headId:firstHead.id,assessmentYear:'2025-26',amountMinor:1250},
        {beneficiary:'user2',taxpayerTin:'2222222222222',category:'OTHER_TAX_PAYMENT',
          headId:secondHead.id,assessmentYear:'2026-27',amountMinor:2500},
      ],
      receiptLines:[
        {headId:firstHead.id,headNameEn:firstHead.nameEn,economicCode:firstHead.economicCode,
          taxAmount:12.5,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:12.5},
        {headId:secondHead.id,headNameEn:secondHead.nameEn,economicCode:secondHead.economicCode,
          taxAmount:25,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:25},
      ],
      allocations:[
        {taxpayerName:'Source Payer',taxpayerTin:'1111111111111',headId:firstHead.id,
          assessmentYear:'2025-26',amountMinor:1250},
        {taxpayerName:'Recipient Two',taxpayerTin:'2222222222222',headId:secondHead.id,
          assessmentYear:'2026-27',amountMinor:2500},
      ],
    },
  };
  const before=JSON.stringify(source);
  const receipt=makeConfirmedReceipt(source);
  assert.deepEqual(receipt.items,[],'receipt must continue to avoid duplicate accounting rows');
  assert.deepEqual(receipt.reusableAccountingLines?.map(h=>h.headId),[firstHead.id,secondHead.id]);
  const repeated=reuseRecordedPayment([receipt],'owner-1','1111111111111',originalId);
  assert.equal(repeated.service,'OTHER_TAX_PAYMENT');
  assert.equal(repeated.sourcePaymentId,originalId);
  assert.equal(repeated.formPayload.paymentRemarks,source.details.paymentRemarks);
  const allocations=repeated.formPayload.otherTaxLines as Array<{
    id:string;headId:number;assessmentYear:string;amount:string
  }>;
  assert.deepEqual(allocations.map(a=>[a.headId,a.assessmentYear,a.amount]),[
    [firstHead.id,'2025-26','12.50'],[secondHead.id,'2026-27','25.00'],
  ]);
  assert.equal(new Set(allocations.map(a=>a.id)).size,2);
  allocations[0].amount='18.00';
  assert.equal(JSON.stringify(source),before,'new Pay Again input never changes original SQL');
  assert.equal(JSON.stringify(receipt.items),'[]');

  // Missing saved head rows cannot be reverse-engineered from translated labels.
  assert.throws(()=>makeConfirmedReceipt({...source,details:{...source.details,receiptLines:undefined}}),
    /allocations could not be reconciled/);
  const partial={...receipt,reusableAccountingLines:undefined};
  assert.throws(()=>reuseRecordedPayment([partial],'owner-1','1111111111111',originalId),
    /incomplete and cannot be copied/);
  // A mismatched per-head amount must not be turned into an apparently valid draft.
  const badAmount={...source,details:{...source.details,
    receiptLines:[{...source.details.receiptLines[0],totalAmount:13},
      source.details.receiptLines[1]]}};
  assert.throws(()=>makeConfirmedReceipt(badAmount),/allocations could not be reconciled/);
});


test('M09 reuses v2 SQL accounting lines when no receiptLines or display snapshot was saved',()=>{
  const id='a5f1bf08-d3b1-4284-8d20-3356c25f64af';
  const headOne={headId:121,headNameEn:'Advance Tax',economicCode:'64',
    taxAmount:10,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:10};
  const headTwo={headId:145,headNameEn:'Tax on notice of demand',economicCode:'135',
    taxAmount:15,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:15};
  const original={
    id,service:'OTHER_TAX_PAYMENT',status:'SIMULATED_SUCCESS',amountMinor:2500,
    createdAt:'2026-11-15T08:00:00.000Z',
    details:{
      payerName:'Recorded payer',payerTin:'1111111111111',
      allocationContractVersion:2,
      lines:[headOne,headTwo],
      allocations:[
        {taxpayerName:'Recorded payer',taxpayerTin:'1111111111111',headId:121,
          assessmentYear:'2025-26',amountMinor:1000},
        {taxpayerName:'Recipient two',taxpayerTin:'2222222222222',headId:145,
          assessmentYear:'2026-27',amountMinor:1500},
      ],
    },
  };
  const before=JSON.stringify(original);
  const confirmed=makeConfirmedReceipt(original);
  assert.deepEqual(confirmed.items,[],'existing receipt display stays allocation-only');
  assert.deepEqual(confirmed.reusableAccountingLines?.map(item=>item.headId),[121,145]);
  const copy=reuseRecordedPayment([confirmed],'owner-1','1111111111111',id);
  assert.equal(copy.sourcePaymentId,id);
  assert.equal(copy.service,'OTHER_TAX_PAYMENT');
  assert.deepEqual((copy.formPayload.otherTaxLines as Array<{
    headId:number;assessmentYear:string;amount:string
  }>).map(item=>[item.headId,item.assessmentYear,item.amount]),[
    [121,'2025-26','10.00'],[145,'2026-27','15.00'],
  ]);
  assert.equal(JSON.stringify(original),before,'a new editable copy cannot rewrite original SQL');
  const malformed=makeConfirmedReceipt({...original,
    details:{...original.details,lines:[{...headOne,headNameEn:'Wrong head'},headTwo]}});
  assert.equal(malformed.reusableAccountingLines?.[0].headNameEn,'Wrong head',
    'the verified source head remains authoritative, not guessed from labels');
  assert.throws(()=>reuseRecordedPayment([{...confirmed,reusableAccountingLines:undefined}],
    'owner-1','1111111111111',id),/incomplete/);
});

test('Gift Tax Pay Again copies validated owned inputs only; historical receipt remains immutable',()=>{
 const sourceId='11111111-2222-4333-8444-555555555555';
 const giftDetails:NonNullable<ChallanReceipt['giftDetails']>={donor:{tin:'111111111111',name:'User 1'},donee:{tin:'222222222222',name:'User 2',tag:'friends_family',relationship:'father',otherLabel:null},giftAmountMinor:250000000,estimatedTaxMinor:27200000,giftDate:'2025-01-15',description:'Original description',remarks:'বাংলা exact comments'};
 const gift:ChallanReceipt={...receipt,paymentTransactionId:sourceId,challanNo:'SIM-GIFT-original',paymentCategory:'GIFT_TAX',assessmentYear:'2025-26',taxpayerTin:giftDetails.donor.tin,taxpayerName:giftDetails.donor.name,giftDetails,paymentRemarks:giftDetails.remarks,totalAmount:272000,items:[{headId:0,economicCode:'SIM-GIFT',headNameEn:'Gift Tax',taxAmount:272000,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:272000}],allocationItems:undefined,taxCreditStatus:'NOT_APPLICABLE',treasuryStatus:'INITIATED'};
 const before=JSON.stringify(gift);const copy=reuseRecordedPayment([gift],'user1','1111111111111',sourceId);
 assert.equal(copy.service,'GIFT_TAX');assert.equal(copy.sourcePaymentId,sourceId);
 const draft=parseGiftTaxReuseDraft(copy.formPayload);assert.ok(draft);assert.deepEqual(draft.giftDetails,giftDetails);
 assert.equal(copy.formPayload.idempotencyKey,undefined);assert.equal(copy.formPayload.paymentMethod,undefined);assert.equal(copy.formPayload.receiptSnapshot,undefined);
 draft.giftDetails.remarks='changed';assert.equal(JSON.stringify(gift),before);
 assert.throws(()=>reuseRecordedPayment([{...gift,totalAmount:272001}],'user1',null,sourceId));
 assert.throws(()=>reuseRecordedPayment([{...gift,paymentRemarks:'mismatch'}],'user1',null,sourceId));
 assert.throws(()=>reuseRecordedPayment([{...gift,taxCreditStatus:'CREDIT_POSTED' as ChallanReceipt['taxCreditStatus']}],'user1',null,sourceId));
 assert.throws(()=>reuseRecordedPayment([{...gift,giftDetails:{...giftDetails,donee:{...giftDetails.donee,tin:giftDetails.donor.tin}}}],'user1',null,sourceId));
 assert.throws(()=>reuseRecordedPayment([gift],'user1',null,'22222222-2222-4333-8444-555555555555'));
});
