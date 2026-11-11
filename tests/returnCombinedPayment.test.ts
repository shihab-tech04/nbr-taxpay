import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareCombinedOtherTaxPayment,saveCombinedOtherTaxRequest,loadCombinedOtherTaxRequest,clearCombinedOtherTaxRequest} from '../src/services/otherTaxCombinedPayment.ts';
import {bindPreviewStoryPayer} from '../src/services/simulatedPaymentStory.ts';
import {V11_PAYMENT_OPTIONS} from '../src/data/v11PaymentOptions.ts';
import type {StoryPaymentInput} from '../src/services/simulatedPaymentStory.ts';
import type {ChallanReceipt,PaymentLineItem} from '../src/types/tax.ts';

const returnHead=V11_PAYMENT_OPTIONS.find(head=>head.id===125)!;
const otherHead=V11_PAYMENT_OPTIONS.find(head=>head.id===121)!;
const id='11111111-2222-4333-8444-555555555555';
const session='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const item=(head:typeof returnHead,amount:number):PaymentLineItem=>({
  headId:head.id,economicCode:head.economicCode,headNameEn:head.nameEn,
  taxAmount:amount,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:amount,
});
const items=[item(returnHead,10),item(returnHead,20)];
const receipt={
  id:'receipt',challanNo:'SIM-'+id,tokenNumber:'SIM-TOKEN-'+id,
  paymentCategory:'TAX_WITH_RETURN',assessmentYear:'2026-27',
  payerName:'Payer',payerTin:'1111111111111',receiptMobile:'01712345678',
  isRepresentativePayment:true,taxZone:'—',taxCircle:'—',isWithholding:false,
  items,totalAmount:30,paymentMethod:'BKASH',gatewayTransactionId:'SIM-TXN-'+id,
  treasuryStatus:'INITIATED',taxCreditStatus:'PENDING_RECONCILIATION',
  createdAt:'2026-11-11T12:00:00Z',isSimulatedDemo:true
} as ChallanReceipt;
const input={
  idempotencyKey:id,sessionId:session,service:'TAX_WITH_RETURN',amountMinor:3000,
  details:{payerMode:'OTHER',assessmentYear:'2026-27',taxpayerTin:'123456789012',
    payerName:'Payer',lines:items,receiptSnapshot:receipt,totalAmount:30}
} as StoryPaymentInput;
const allocations=[
  {sourceId:'first',taxpayerTin:'123456789012',taxpayerName:'First',assessmentYear:'2026-27',amountMinor:1000,line:items[0]},
  {sourceId:'second',taxpayerTin:'234567890123',taxpayerName:'Second',assessmentYear:'2025-26',amountMinor:2000,line:items[1]}
];
test('Return-only permits multiple beneficiaries and distinct years under one receipt',()=>{
  const result=prepareCombinedOtherTaxPayment(input,receipt,allocations);
  assert.equal(result.payload.service,'TAX_WITH_RETURN');
  assert.equal(result.receipt.paymentCategory,'TAX_WITH_RETURN');
  assert.equal(result.receipt.challanNo,'SIM-'+id);
  assert.equal(result.payload.amountMinor,3000);
  assert.equal(result.payload.details.taxpayerCount,2);
  assert.equal(result.receipt.allocationItems?.length,2);
  assert.deepEqual(result.receipt.allocationItems?.map(a=>a.assessmentYear),['2026-27','2025-26']);
  const bound=bindPreviewStoryPayer(result.payload,{profileId:'user1',paymentSessionId:session});
  assert.equal(bound.details.payerId,'user1');
  assert.equal((bound.details.allocations as unknown[]).length,2);
  assert.equal((bound.details.lines as unknown[]).length,2);
});
test('Return may not be mixed with any other tax head in the same payment',()=>{
  const mixed=[allocations[0],{...allocations[1],line:item(otherHead,20)}];
  const mixedReceipt={...receipt,items:[items[0],mixed[1].line]};
  assert.throws(()=>prepareCombinedOtherTaxPayment(input,mixedReceipt,mixed),/INVALID_COMBINED_HEAD/);
  assert.throws(()=>prepareCombinedOtherTaxPayment({...input,service:'OTHER_TAX_PAYMENT'},
    {...receipt,paymentCategory:'OTHER_TAX_PAYMENT'},allocations),/INVALID_COMBINED_HEAD/);
});
test('Return-only request recovery preserves exact owner session and accounting lines',()=>{
  const request=prepareCombinedOtherTaxPayment(input,receipt,allocations);
  const map=new Map<string,string>();
  const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},
    removeItem:(k:string)=>{map.delete(k);}};
  assert.equal(saveCombinedOtherTaxRequest(request,'READY',storage),true);
  assert.equal(loadCombinedOtherTaxRequest(session,storage)?.request.payload.service,'TAX_WITH_RETURN');
  assert.equal(loadCombinedOtherTaxRequest(session,storage)?.request.payload.idempotencyKey,id);
  clearCombinedOtherTaxRequest(session,storage);
  assert.equal(loadCombinedOtherTaxRequest(session,storage),null);
});
test('SQL migration keeps exclusive Return head and existing owner validation',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261111184000_taxpay_multi_beneficiary_return_only.sql',import.meta.url),'utf8');
  assert.match(sql,/v_head\.head_id <> 125/);
  assert.match(sql,/RETURN_HEAD_EXCLUSIVE/);
  assert.match(sql,/validate_demo_authorized_payment/);
  assert.doesNotMatch(sql,/disable row level security|drop policy|grant\s+all\s+on/i);
});
