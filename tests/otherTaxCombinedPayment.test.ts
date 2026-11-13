import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareCombinedOtherTaxPayment, MAX_COMBINED_ALLOCATIONS, saveCombinedOtherTaxRequest,
  loadCombinedOtherTaxRequest, clearCombinedOtherTaxRequest
} from '../src/services/otherTaxCombinedPayment.ts';
import {bindPreviewStoryPayer} from '../src/services/simulatedPaymentStory.ts';
import {makeConfirmedReceipt} from '../src/services/confirmedPaymentCertificate.ts';
import type {ChallanReceipt,PaymentLineItem} from '../src/types/tax.ts';
import type {StoryPaymentInput} from '../src/services/simulatedPaymentStory.ts';
import { V11_PAYMENT_OPTIONS } from '../src/data/v11PaymentOptions.ts';

const id='11111111-2222-4333-8444-555555555555';
const session='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const items:PaymentLineItem[]=[
 {headId:121,serviceCode:'ADVANCE_TAX',isWithholding:false,economicCode:'64',headNameEn:'Advance Tax',taxAmount:15,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:15},
 {headId:145,serviceCode:'ASSESSED_DEMAND',isWithholding:false,economicCode:'135',headNameEn:'Tax on notice of demand',taxAmount:35,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:35},
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
 assert.equal(result.payload.details.allocationContractVersion,3);
 assert.deepEqual(result.receipt.allocationItems?.map(x=>x.allocationId),['one','two']);
 assert.deepEqual((result.payload.details.allocations as Array<{allocationId:string}>).map(x=>x.allocationId),['one','two']);
 assert.deepEqual((result.payload.details.receiptSnapshot as ChallanReceipt).allocationItems?.map(x=>x.allocationId),['one','two']);
 assert.equal(result.payload.details.taxpayerCount,2);
 assert.equal((result.payload.details.allocations as unknown[]).length,2);
 assert.equal(result.payload.details.batchItemCount,undefined,'no split-payment record');
});
test('the signed-in payer keeps both saved beneficiaries inside one scoped SQL submission',()=>{
 const grouped=mk();
 const bound=bindPreviewStoryPayer(grouped.payload,{profileId:'user1',paymentSessionId:session});
 const signed=bound.details.lines as Array<Record<string,unknown>>;
 assert.equal(bound.details.payerId,'user1','payer must be bound to current profile');
 assert.equal(signed.length,2);
 assert.deepEqual(signed,items,'Office-facing accounting heads must never become synthetic beneficiary lines');
 const allocated=bound.details.allocations as Array<Record<string,unknown>>;
 assert.deepEqual(allocated.map(x=>x.amountMinor),[1500,3500]);
 assert.deepEqual(allocated.map(x=>x.taxpayerTin),['909000000013','000000000018']);
 assert.equal(bound.idempotencyKey,id);
 assert.deepEqual(allocated.map(x=>x.allocationId),['one','two']);
 assert.deepEqual(bound,bindPreviewStoryPayer(grouped.payload,{profileId:'user1',paymentSessionId:session}));
 const confirmed=makeConfirmedReceipt({id,service:'OTHER_TAX_PAYMENT',amountMinor:5000,
  status:'SIMULATED_SUCCESS',createdAt:'2026-11-08T12:00:00Z',details:bound.details});
 assert.equal(confirmed.totalAmount,50);
 assert.equal(confirmed.paymentTransactionId,id);
 assert.deepEqual(confirmed.allocationItems?.map(item=>item.allocationId),['one','two']);
 assert.deepEqual(confirmed.allocationItems?.map(item=>[item.taxpayerTin,item.economicCode,item.amountMinor]),
  [['909000000013','64',1500],['000000000018','135',3500]]);
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
test('quota or security denial cannot block the same request while the tab remains open',()=>{
 const request=mk(), disk=store();
 assert.equal(saveCombinedOtherTaxRequest(request,'READY',disk),true);
 const denied={
   getItem:(key:string)=>disk.getItem(key),
   setItem:(_key:string,_value:string)=>{throw new Error('QuotaExceededError');},
   removeItem:(_key:string)=>{throw new Error('SecurityError');},
 };
 assert.equal(saveCombinedOtherTaxRequest(request,'PENDING_BANK',denied),false);
 const held=loadCombinedOtherTaxRequest(session,denied);
 assert.equal(held?.phase,'PENDING_BANK','volatile exact-key request must supersede stale storage');
 assert.equal(held?.request.payload.idempotencyKey,id);
 assert.equal(loadCombinedOtherTaxRequest('99999999-aaaa-4ccc-8ddd-eeeeeeeeeeee',denied),null);
 clearCombinedOtherTaxRequest(session,denied);
 assert.equal(loadCombinedOtherTaxRequest(session,denied)?.phase,'READY','stale persistent entry is not deleted when removal is denied');
 clearCombinedOtherTaxRequest(session,disk);
 assert.equal(loadCombinedOtherTaxRequest(session,disk),null);
});

test('missing browser storage uses a temporary exact-request retry rather than failing payment setup',()=>{
 const denied={getItem:()=>{throw new Error('SecurityError');},
   setItem:()=>{throw new Error('SecurityError');},
   removeItem:()=>{throw new Error('SecurityError');}};
 const request=mk();
 assert.equal(saveCombinedOtherTaxRequest(request,'READY',denied),false);
 assert.equal(loadCombinedOtherTaxRequest(session,denied)?.request.payload.idempotencyKey,id);
 clearCombinedOtherTaxRequest(session,denied);
 assert.equal(loadCombinedOtherTaxRequest(session,denied),null);
});

test('fail closed for amount mismatch, invalid TIN, duplicate allocation and altered references',()=>{
 assert.throws(()=>prepareCombinedOtherTaxPayment({...input,amountMinor:4999},receipt,allocations),/COMBINED_TOTAL_MISMATCH/);
 assert.throws(()=>prepareCombinedOtherTaxPayment(input,receipt,[{...allocations[0],taxpayerTin:'INVALID'},allocations[1]]),/INVALID_COMBINED_ALLOCATION/);
 assert.throws(()=>prepareCombinedOtherTaxPayment(input,receipt,[allocations[0],{...allocations[1],sourceId:'one'}]),/INVALID_COMBINED_PAYMENT/);
 const storage=store(); const request=mk();
 assert.throws(()=>saveCombinedOtherTaxRequest({payload:request.payload,receipt:{...request.receipt,challanNo:'SIM-FORGED'}},'READY',storage),/INVALID_COMBINED_RECOVERY/);
});

test('pending combined retries reject altered beneficiary-head identities and receipt projections',()=>{
 const mutations: Array<[string,(request:ReturnType<typeof mk>)=>void]> = [
  ['changed SQL allocation head', request => {
    const entries=request.payload.details.allocations as Array<Record<string,unknown>>;
    entries[0].headId=145;
  }],
  ['changed immutable allocation ID', request => {
    const entries=request.payload.details.allocations as Array<Record<string,unknown>>;
    entries[0].allocationId='forged-line';
  }],
  ['changed receipt allocation ID', request => {
    request.receipt.allocationItems![0].allocationId='forged-line';
  }],
  ['changed visible receipt economic code', request => {
    request.receipt.allocationItems![0].economicCode='FORGED';
  }],
  ['changed Office-bound accounting head', request => {
    const lines=request.payload.details.lines as Array<Record<string,unknown>>;
    lines[0].headNameEn='Tax on notice of demand';
  }],
  ['changed persisted receipt allocation', request => {
    const snapshot=request.payload.details.receiptSnapshot as ChallanReceipt;
    snapshot.allocationItems![0].economicCode='FORGED';
  }],
  ['changed allocation count', request => {
    request.payload.details.allocationCount=99;
  }],
  ['changed allocation service category', request => {
    const entries=request.payload.details.allocations as Array<Record<string,unknown>>;
    entries[0].serviceCode='TAX_WITH_RETURN';
  }],
  ['changed withholding classification', request => {
    const entries=request.payload.details.allocations as Array<Record<string,unknown>>;
    entries[0].isWithholding=true;
  }],
  ['changed persisted receipt total', request => {
    const snapshot=request.payload.details.receiptSnapshot as ChallanReceipt;
    snapshot.totalAmount=51;
  }],
 ];
 for (const [description,mutate] of mutations) {
  const request=structuredClone(mk());
  mutate(request);
  assert.throws(()=>saveCombinedOtherTaxRequest(request,'READY',store()),/INVALID_COMBINED_RECOVERY/,description);
 }
 const storage=store();
 saveCombinedOtherTaxRequest(mk(),'READY',storage);
 const key='taxpay-other-tax-combined-v2:'+session;
 const saved=JSON.parse(storage.getItem(key)!);
 saved.request.payload.details.allocations[0].headId=145;
 storage.setItem(key,JSON.stringify(saved));
 assert.throws(()=>loadCombinedOtherTaxRequest(session,storage),/INVALID_COMBINED_RECOVERY/, 'tampered persistent retry must fail on load');
});

test('v2 pending combined requests remain byte-identical after the v3 upgrade',()=>{
 const v2=structuredClone(mk());
 v2.payload.details.allocationContractVersion=2;
 for(const a of v2.payload.details.allocations as Array<Record<string,unknown>>) delete a.allocationId;
 for(const item of [...v2.receipt.allocationItems!, ...(v2.payload.details.receiptSnapshot as ChallanReceipt).allocationItems!]) delete item.allocationId;
 const before=JSON.stringify(v2.payload);
 const storage=store();
 assert.equal(saveCombinedOtherTaxRequest(v2,'READY',storage),true);
 const loaded=loadCombinedOtherTaxRequest(session,storage);
 assert.equal(JSON.stringify(loaded?.request.payload),before);
 assert.deepEqual(loaded?.request.receipt.allocationItems,v2.receipt.allocationItems);
});

test('previous-version pending combined requests remain recoverable without changing their idempotency payload',()=>{
 const legacy=structuredClone(mk());
 delete legacy.payload.details.allocationContractVersion;
 for(const item of [...legacy.receipt.allocationItems!, ...(legacy.payload.details.receiptSnapshot as ChallanReceipt).allocationItems!]) delete item.allocationId;
 for(const allocation of legacy.payload.details.allocations as Array<Record<string,unknown>>){
  delete allocation.allocationId;
  delete allocation.serviceCode;
  delete allocation.isWithholding;
 }
 for(const line of [
  ...(legacy.payload.details.lines as PaymentLineItem[]),
  ...legacy.receipt.items,
  ...(legacy.payload.details.receiptSnapshot as ChallanReceipt).items,
 ]){delete line.serviceCode;delete line.isWithholding;}
 const storage=store();
 assert.equal(saveCombinedOtherTaxRequest(legacy,'READY',storage),true);
 const restored=loadCombinedOtherTaxRequest(session,storage);
 assert.equal(restored?.request.payload.idempotencyKey,id);
 assert.equal(restored?.request.payload.details.allocationContractVersion,undefined);
 assert.deepEqual(restored?.request.payload.details.allocations,legacy.payload.details.allocations);
});

test('one combined transaction supports more than twenty allocations without splitting',()=>{
 const heads = Array.from({length:21},(_,index)=>({
   sourceId:'bulk-'+index,
   taxpayerTin:String(100000000000+index),
   taxpayerName:'Beneficiary '+index,
   assessmentYear:index%2===0?'2025-26':'2026-27',
   amountMinor:100,
   line:{...items[0],totalAmount:1,taxAmount:1},
 }));
 const combinedReceipt:ChallanReceipt={...receipt,items:heads.map(a=>a.line),totalAmount:21};
 const combinedInput:StoryPaymentInput={...input,amountMinor:2100,details:{...input.details,lines:combinedReceipt.items}};
 const result=prepareCombinedOtherTaxPayment(combinedInput,combinedReceipt,heads);
 assert.equal(result.payload.details.combinedPayment,true);
 assert.equal(result.payload.details.allocationCount,21);
 assert.equal(result.payload.details.taxpayerCount,21);
 assert.equal(result.receipt.allocationItems?.length,21);
 assert.equal(result.payload.idempotencyKey,id);
 assert.equal(result.receipt.challanNo,'SIM-'+id);
 assert.equal(result.payload.amountMinor,2100);
 const bound=bindPreviewStoryPayer(result.payload,{profileId:'user1',paymentSessionId:session});
 assert.equal((bound.details.allocations as Array<unknown>).length,21);
});

test('one beneficiary can pay the same eligible head in different assessment years',()=>{
 const second={...allocations[0],sourceId:'another-year',assessmentYear:'2025-26',amountMinor:3500,line:{...items[0],totalAmount:35,taxAmount:35}};
 const combinedReceipt={...receipt,items:[allocations[0].line,second.line]};
 const result=prepareCombinedOtherTaxPayment({...input,details:{...input.details,lines:combinedReceipt.items}},combinedReceipt,[allocations[0],second]);
 assert.equal(result.payload.details.taxpayerCount,1);
 assert.equal((result.payload.details.allocations as Array<Record<string,unknown>>)[1].assessmentYear,'2025-26');
 assert.equal(result.payload.amountMinor,5000);
});

test('same TIN/head/year cannot be charged twice even under different source IDs',()=>{
 const duplicate={...allocations[0],sourceId:'different-source-key',amountMinor:3500,line:{...items[0],totalAmount:35,taxAmount:35}};
 const combinedReceipt={...receipt,items:[allocations[0].line,duplicate.line]};
 assert.throws(()=>prepareCombinedOtherTaxPayment({...input,details:{...input.details,lines:combinedReceipt.items}},combinedReceipt,[allocations[0],duplicate]),/DUPLICATE_COMBINED_ALLOCATION/);
});

test('configured capacity is explicit and one above the capacity is rejected before gateway',()=>{
 assert.ok(MAX_COMBINED_ALLOCATIONS>20);
 const rows=Array.from({length:MAX_COMBINED_ALLOCATIONS+1},(_,n)=>({...allocations[0],sourceId:'overflow-'+n}));
 assert.throws(()=>prepareCombinedOtherTaxPayment(input,receipt,rows),/INVALID_COMBINED_PAYMENT/);
});

test('a mapped Source Tax head combines with an Advance/Demand head across distinct beneficiaries',()=>{
 const sourceLine={...items[0],headId:8,serviceCode:'SOURCE_TAX_DEPOSIT' as const,isWithholding:true,economicCode:'50',headNameEn:'Deduction from Salary'};
 const newReceipt={...receipt,items:[sourceLine,items[1]]};
 const newInput={...input,details:{...input.details,lines:newReceipt.items}};
 const result=prepareCombinedOtherTaxPayment(newInput,newReceipt,[
   {...allocations[0],line:sourceLine},allocations[1],
 ]);
 assert.equal(result.payload.details.allocationCount,2);
 assert.equal(result.payload.details.taxpayerCount,2);
 assert.deepEqual((result.payload.details.allocations as Array<Record<string,unknown>>).map(a=>[
  a.serviceCode,a.isWithholding]),[['SOURCE_TAX_DEPOSIT',true],['ASSESSED_DEMAND',false]]);
 assert.deepEqual(result.receipt.items.map(a=>[a.serviceCode,a.isWithholding]),[
  ['SOURCE_TAX_DEPOSIT',true],['ASSESSED_DEMAND',false]]);
 assert.deepEqual(result.receipt.allocationItems?.map(a=>a.economicCode),['50','135']);
 assert.equal(result.receipt.challanNo,'SIM-'+id);
 assert.equal(result.payload.amountMinor,5000);
});
test('one batch preserves the actual service category for every eligible non-Return head group',()=>{
 const categories=['ADVANCE_TAX','ASSESSED_DEMAND','PENALTY','SOURCE_TAX_DEPOSIT','APPELLATE_TRIBUNAL','OTHER_TAX_PAYMENT'] as const;
 const sourceHeads=categories.map(serviceCode=>{
  const option=V11_PAYMENT_OPTIONS.find(head=>head.category===serviceCode&&head.status==='ACTIVE');
  assert.ok(option,`active mapped head missing for ${serviceCode}`);
  return option;
 });
 const mixedLines=sourceHeads.map((head,index)=>{
  const amount=1;
  return {sourceId:'category-'+index,taxpayerTin:index%2===0?'909000000013':'000000000018',
   taxpayerName:'Beneficiary '+index,assessmentYear:index%2===0?'2026-27':'2025-26',amountMinor:100,
   line:{headId:head.id,serviceCode:head.category,isWithholding:head.isWithholding,
    economicCode:head.economicCode,headNameEn:head.nameEn,taxAmount:head.category==='PENALTY'?0:amount,
    penaltyAmount:head.category==='PENALTY'?amount:0,surchargeAmount:0,interestAmount:0,totalAmount:amount}};
 });
 const mixedItems=mixedLines.map(item=>item.line);
 const mixedReceipt={...receipt,items:mixedItems,totalAmount:categories.length};
 const mixedInput={...input,amountMinor:categories.length*100,
  details:{...input.details,lines:mixedItems,totalAmount:categories.length}};
 const result=prepareCombinedOtherTaxPayment(mixedInput,mixedReceipt,mixedLines);
 const serialized=result.payload.details.allocations as Array<Record<string,unknown>>;
 assert.deepEqual(serialized.map(item=>item.serviceCode),categories);
 assert.deepEqual(serialized.map(item=>item.isWithholding),[false,false,false,true,false,false]);
 assert.equal(result.payload.service,'OTHER_TAX_PAYMENT','the aggregate parent remains one combined payment');
 assert.equal(result.payload.details.allocationContractVersion,3);
 assert.equal(result.payload.amountMinor,categories.length*100);
 assert.equal(result.receipt.challanNo,'SIM-'+id);
 assert.equal(result.receipt.items.length,categories.length);
});
test('Tax with Return never mixes into the non-return combined-payment service',()=>{
 const returnLine={...items[0],headId:125,serviceCode:'TAX_WITH_RETURN' as const,economicCode:'74',headNameEn:'Tax with return'};
 const newReceipt={...receipt,items:[returnLine,items[1]]};
 assert.throws(()=>prepareCombinedOtherTaxPayment({...input,details:{...input.details,lines:newReceipt.items}},newReceipt,[
   {...allocations[0],line:returnLine},allocations[1],
 ]),/INVALID_COMBINED_HEAD/);
});
