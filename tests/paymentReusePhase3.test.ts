import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {V11_PAYMENT_OPTIONS} from '../src/data/v11PaymentOptions.ts';
import {prepareCombinedOtherTaxPayment} from '../src/services/otherTaxCombinedPayment.ts';
import {V11_SOURCE_HEADS,isV11HeadReviewBlocked} from '../src/data/v11SourceHeads.ts';
import {BLOCKED_HEAD_IDS} from '../src/data/paymentHeads.ts';
import {reuseRecordedPayment} from '../src/services/paymentReuse.ts';
import type {ChallanReceipt,MasterPaymentHead,PaymentLineItem} from '../src/types/tax.ts';

/**
 * Phase 3: deterministic, disposable payment-scenario matrix.
 * These are source-to-new-request contract tests, NOT evidence that real money
 * was collected or that a hosted Taxpayer/Office SQL write occurred.
 * The immutable recorded receipt is never submitted again.
 */
const payerTin='1234567890123';
const otherTin='9876543210987';
const thirdTin='4567890123456';
const payerUid='payer-owner';
const years=['2024-25','2025-26','2026-27','2027-28'] as const;
const nonReturnEligible=new Set(V11_SOURCE_HEADS.filter(head =>
  head.active && head.map==='MAPPED' && head.purpose!=='return' &&
  !isV11HeadReviewBlocked(head) && !BLOCKED_HEAD_IDS.includes(head.id)
).map(head=>head.id));
const supported=V11_PAYMENT_OPTIONS.filter(head =>
  head.status==='ACTIVE' && (head.category==='TAX_WITH_RETURN'
    ? head.id===125 : nonReturnEligible.has(head.id)));
const nonReturn=supported.filter(head=>head.category!=='TAX_WITH_RETURN');
const amountText=(minor:number)=>String(Math.floor(minor/100))+'.'+String(minor%100).padStart(2,'0');

function paymentHead(head:MasterPaymentHead,minor:number):PaymentLineItem {
  const penalty=head.category==='PENALTY';
  return {
    headId:head.id,economicCode:head.economicCode,headNameEn:head.nameEn,
    serviceCode:head.category,isWithholding:head.isWithholding,
    taxAmount:penalty?0:minor/100,penaltyAmount:penalty?minor/100:0,
    surchargeAmount:0,interestAmount:0,totalAmount:minor/100,
  };
}
function receipt(
  head:MasterPaymentHead,recipientTin:string,year:string,minor:number,
  paymentId:string,allocationId:string,
):ChallanReceipt {
  return {
    id:'receipt-'+paymentId,paymentTransactionId:paymentId,
    challanNo:'SIM-'+paymentId,tokenNumber:'SIM-TOKEN-'+paymentId,
    paymentCategory:head.category,assessmentYear:year,payerName:'Payer',
    payerTin,taxpayerTin:recipientTin,taxpayerName:'Recipient',
    isRepresentativePayment:recipientTin!==payerTin,
    taxZone:'—',taxCircle:'—',isWithholding:head.isWithholding,
    items:[paymentHead(head,minor)],
    allocationItems:[{allocationId,taxpayerTin:recipientTin,taxpayerName:'Recipient',
      paymentServiceEn:head.nameEn,paymentServiceBn:head.nameBn,
      assessmentYear:year,amountMinor:minor,economicCode:head.economicCode}],
    totalAmount:minor/100,paymentMethod:'SIMULATED',
    gatewayTransactionId:'SIM-TXN-'+paymentId,treasuryStatus:'GATEWAY_SUCCESS',
    taxCreditStatus:'PENDING_RECONCILIATION',createdAt:'2026-11-16',
    isSimulatedDemo:true,paymentRemarks:'Recorded history, not new authority',
  };
}

test('Phase 3: every supported active v11 head has 2 and 3 distinct individually recorded payments across years and self/others',()=>{
  assert.ok(supported.length>0 && nonReturn.length>0);
  const exercised=new Set<number>();
  let parentCount=0;
  for(const head of supported){
    exercised.add(head.id);
    for(const numberOfPayments of [2,3]){
      const originals=Array.from({length:numberOfPayments},(_,index)=>{
        const payee=[payerTin,otherTin,thirdTin][index];
        const year=years[(head.id+index)%years.length];
        return receipt(head,payee,year,1001+(head.id*7)+index,
          crypto.randomUUID(),crypto.randomUUID());
      });
      const originalSnapshot=JSON.stringify(originals);
      const allSources=new Set(originals.map(value=>value.paymentTransactionId));
      const newLineIds=new Set<string>();
      for(const source of originals){
        const sourceId=source.paymentTransactionId!;
        const copy=reuseRecordedPayment([source],payerUid,payerTin,sourceId);
        assert.equal(copy.sourcePaymentId,sourceId);
        assert.deepEqual(copy.sourceAllocationIds,[source.allocationItems![0].allocationId]);
        assert.equal(copy.formPayload.assessmentYear,source.assessmentYear==='2026-27'?source.assessmentYear:'');
        assert.equal(copy.formPayload.forSelf,source.taxpayerTin===payerTin);
        assert.equal(copy.formPayload.paymentRemarks,source.paymentRemarks);
        if(head.category==='OTHER_TAX_PAYMENT'){
          const lines=copy.formPayload.otherTaxLines as Array<{
            id:string;headId:number;assessmentYear:string;amount:string
          }>;
          assert.equal(lines.length,1);
          assert.equal(lines[0].headId,head.id);
          assert.equal(lines[0].assessmentYear,source.assessmentYear==='2026-27'?source.assessmentYear:'');
          assert.equal(lines[0].amount,amountText(source.allocationItems![0].amountMinor));
          assert.ok(!newLineIds.has(lines[0].id));
          newLineIds.add(lines[0].id);
          assert.notEqual(lines[0].id,source.allocationItems![0].allocationId);
          lines[0].amount='77.01';
        }else{
          assert.deepEqual(copy.formPayload.selectedHeadIds,[head.id]);
          assert.equal((copy.formPayload.amountInputs as Record<number,string>)[head.id],
            amountText(source.allocationItems![0].amountMinor));
          (copy.formPayload.amountInputs as Record<number,string>)[head.id]='77.01';
          assert.deepEqual(copy.formPayload.otherTaxLines,[]);
        }
        // A fresh attempt never reuses an original payment's parent identity.
        const nextAttemptId=crypto.randomUUID();
        assert.ok(!allSources.has(nextAttemptId));
        assert.equal(JSON.stringify(originals),originalSnapshot);
        parentCount++;
      }
    }
  }
  assert.equal(exercised.size,supported.length,'all current eligible heads are in the matrix');
  assert.equal(parentCount,supported.length*5,'two plus three source payments per head');
});

test('Phase 3: mixed heads, years and self/other allocations become editable new-payment requests; source remains immutable',()=>{
  assert.ok(nonReturn.length>=3);
  const selected=[
    nonReturn[0],
    nonReturn.find(head=>head.category!==nonReturn[0].category && head.id!==nonReturn[0].id)!,
    nonReturn.find(head=>head.id!==nonReturn[0].id && head.category!==nonReturn[0].category &&
      head.id!==nonReturn.find(next=>next.category!==nonReturn[0].category && next.id!==nonReturn[0].id)!.id)!,
  ];
  assert.ok(selected.every(Boolean));
  const oldPaymentId=crypto.randomUUID();
  const oldAllocationIds:string[]=selected.map(()=>crypto.randomUUID());
  const taxpayers=[payerTin,otherTin,thirdTin];
  const originalLines=selected.map((head,index)=>paymentHead(head,1011+index*109));
  const source=receipt(selected[0],payerTin,years[0],1011,oldPaymentId,oldAllocationIds[0]);
  source.paymentCategory='OTHER_TAX_PAYMENT';
  source.taxpayerTin=undefined;
  source.assessmentYear='Multiple years';
  source.items=originalLines;
  source.allocationItems=selected.map((head,index)=>({
    allocationId:oldAllocationIds[index],taxpayerTin:taxpayers[index],
    taxpayerName:'Recipient '+index,paymentServiceEn:head.nameEn,
    paymentServiceBn:head.nameBn,assessmentYear:years[index],
    amountMinor:1011+index*109,economicCode:head.economicCode,
  }));
  source.totalAmount=source.allocationItems.reduce((sum,item)=>sum+item.amountMinor,0)/100;
  const pristine=JSON.stringify(source);
  const newAttempts=new Set<string>();
  for(let repeat=0;repeat<2;repeat++){
    const draft=reuseRecordedPayment([source],payerUid,payerTin,oldPaymentId);
    const copiedLines=draft.formPayload.otherTaxLines as Array<{
      id:string;taxpayerId:string;headId:number;assessmentYear:string;amount:string
    }>;
    assert.equal(draft.service,'OTHER_TAX_PAYMENT');
    assert.equal(draft.formPayload.forSelf,false);
    assert.equal(draft.formPayload.tin,payerTin);
    assert.deepEqual(draft.sourceAllocationIds,oldAllocationIds);
    assert.deepEqual(copiedLines.map(line=>line.headId),selected.map(head=>head.id));
    assert.deepEqual(copiedLines.map(line=>line.assessmentYear),['','','2026-27']);
    assert.equal((draft.formPayload.additionalTaxpayers as unknown[]).length,2);
    // Edit one amount and year, without modifying any historical payment row.
    copiedLines[0].amount=repeat===0?'30.05':'31.05';
    copiedLines[0].assessmentYear=years[3];
     copiedLines[1].assessmentYear=years[1]; // explicit re-selection required by F-073
    const attemptId=crypto.randomUUID();
    assert.ok(!newAttempts.has(attemptId)&&attemptId!==oldPaymentId);
    newAttempts.add(attemptId);
    const newHeads=copiedLines.map((line,index)=>
      paymentHead(selected[index],Math.round(Number(line.amount)*100)));
    const newReceipt={
      ...source,id:'receipt-'+attemptId,paymentTransactionId:attemptId,
      challanNo:'SIM-'+attemptId,tokenNumber:'SIM-TOKEN-'+attemptId,
      gatewayTransactionId:'SIM-TXN-'+attemptId,items:newHeads,
      totalAmount:newHeads.reduce((sum,head)=>sum+head.totalAmount,0),
      allocationItems:undefined,
    } satisfies ChallanReceipt;
    const requests=copiedLines.map((line,index)=>({
      sourceId:line.id,taxpayerTin:taxpayers[index],taxpayerName:'Recipient '+index,
      assessmentYear:line.assessmentYear,
      amountMinor:Math.round(Number(line.amount)*100),line:newHeads[index],
    }));
    const combined=prepareCombinedOtherTaxPayment({
      idempotencyKey:attemptId,sessionId:'isolated-phase3-session',
      service:'OTHER_TAX_PAYMENT',
      amountMinor:requests.reduce((sum,line)=>sum+line.amountMinor,0),
      details:{
        payerMode:'OTHER',sourcePaymentId:oldPaymentId,
        sourceAllocationIds:[...oldAllocationIds],
      },
    },newReceipt,requests);
    assert.equal(combined.payload.idempotencyKey,attemptId);
    assert.equal(combined.payload.details.sourcePaymentId,oldPaymentId);
    assert.deepEqual(combined.payload.details.sourceAllocationIds,oldAllocationIds);
    assert.equal(combined.payload.details.allocationContractVersion,3);
    const newAllocationIds=(combined.payload.details.allocations as Array<{allocationId:string}>)
      .map(line=>line.allocationId);
    assert.deepEqual(newAllocationIds,copiedLines.map(line=>line.id));
    assert.ok(newAllocationIds.every(id=>!oldAllocationIds.includes(id)));
    assert.deepEqual((combined.payload.details.allocations as Array<{assessmentYear:string}>)
      .map(line=>line.assessmentYear),[years[3],years[1],years[2]]);
    assert.equal(combined.receipt.totalAmount,combined.payload.amountMinor/100);
    assert.equal(JSON.stringify(source),pristine);
  }
});

test('Phase 3: Return remains exclusive; invalid mixed source and partial history cannot be repeated',()=>{
  const returnHead=supported.find(head=>head.category==='TAX_WITH_RETURN')!;
  const otherHead=nonReturn[0];
  assert.ok(returnHead&&otherHead);
  const source=receipt(returnHead,payerTin,years[0],1201,crypto.randomUUID(),crypto.randomUUID());
  const mixed={...source,items:[...source.items,paymentHead(otherHead,1500)],
    allocationItems:[...source.allocationItems!,{...source.allocationItems![0],
      allocationId:crypto.randomUUID(),amountMinor:1500,assessmentYear:years[1]}],
    totalAmount:27.01};
  const pristine=JSON.stringify(mixed);
  assert.throws(()=>reuseRecordedPayment([mixed],payerUid,payerTin,source.paymentTransactionId!),
    /Tax with Return/);
  assert.equal(JSON.stringify(mixed),pristine);
  const historical=receipt(otherHead,otherTin,years[0],1301,crypto.randomUUID(),crypto.randomUUID());
  assert.throws(()=>reuseRecordedPayment([{...historical,allocationItems:[]}],
    payerUid,payerTin,historical.paymentTransactionId!),/incomplete/);
});

test('Phase 3: Return head hidden under a non-Return parent is refused without modifying history',()=>{
  const returnHead=supported.find(head=>head.category==='TAX_WITH_RETURN')!;
  const otherHead=nonReturn[0];
  assert.equal(returnHead.id,125);
  const original=receipt(otherHead,payerTin,years[0],1234,crypto.randomUUID(),crypto.randomUUID());
  original.items=[paymentHead(returnHead,1234)];
  original.allocationItems=[{...original.allocationItems![0],
    paymentServiceEn:returnHead.nameEn,paymentServiceBn:returnHead.nameBn,
    economicCode:returnHead.economicCode}];
  for(const category of ['OTHER_TAX_PAYMENT',otherHead.category] as const){
    const damaged={...original,paymentCategory:category};
    const untouched=JSON.stringify(damaged);
    assert.throws(()=>reuseRecordedPayment([damaged],payerUid,payerTin,original.paymentTransactionId!),
      /Tax with Return cannot be combined/);
    assert.equal(JSON.stringify(damaged),untouched);
  }
});

test('Phase 3: starting another checkout clears immutable Pay Again provenance',()=>{
  const source=readFileSync(new URL('../src/components/screens/GuestPayment.tsx',import.meta.url),'utf8');
  const reset=source.split('const startAnotherBatch = () => {')[1]?.split('\n  };')[0];
  assert.ok(reset,'new checkout reset handler must exist');
  assert.match(reset,/setSourcePaymentId\(null\)/);
  assert.match(reset,/setSourceAllocationIds\(\[\]\)/);
});

test('Phase 3: Pay Again invalid resumed draft exposes validation instead of disabling Continue',()=>{
  const source=readFileSync(new URL('../src/components/screens/GuestPayment.tsx',import.meta.url),'utf8');
  assert.ok(source.includes('disabled={!initialReuse && otherBatch && (!batchValid || !storyAmountSupported)}'),
    'Pay Again must allow the review action to report the precise error');
  assert.ok(source.includes('if (!storyAmountSupported && !(storyAmountMinor !== null && storyAmountMinor > MAX_STORY_AMOUNT_MINOR))'),
    'Invalid amounts must still be rejected before checkout');
});
