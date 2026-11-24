import test from 'node:test';
import assert from 'node:assert/strict';
import {reuseRecordedPayment} from '../src/services/paymentReuse.ts';
import {resolvePaymentPartyIdentity} from '../src/services/paymentPartyIdentity.ts';
import {prepareCombinedOtherTaxPayment} from '../src/services/otherTaxCombinedPayment.ts';
import type {ChallanReceipt} from '../src/types/tax.ts';
import type {StoryPaymentInput} from '../src/services/simulatedPaymentStory.ts';

/** M04/US-005 — only isolated receipt facts; no SQL or Treasury writes. */
const sourceTin='1111111111111';
const otherTin='2222222222222';
const parent='11111111-2222-4333-8444-555555555555';
const head={headId:125,economicCode:'74',headNameEn:'Tax with return',
  taxAmount:19.75,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:19.75};
const allocation={allocationId:'source-allocation-1',taxpayerTin:sourceTin,taxpayerName:'Recorded taxpayer',
  paymentServiceEn:'Tax with return',paymentServiceBn:'রিটার্নসহ কর',
  assessmentYear:'2025-26',amountMinor:1975};
const receipt={
  id:'receipt-source',paymentTransactionId:parent,challanNo:'SIM-ORIGINAL',
  tokenNumber:'SIM-TOKEN',paymentCategory:'TAX_WITH_RETURN',
  assessmentYear:'2025-26',payerName:'Recorded taxpayer',payerTin:sourceTin,
  taxpayerTin:sourceTin,taxpayerName:'Recorded taxpayer',receiptMobile:'',
  isRepresentativePayment:false,taxZone:'—',taxCircle:'—',isWithholding:false,
  items:[head],allocationItems:[allocation],totalAmount:19.75,
  paymentMethod:'SIMULATED',gatewayTransactionId:'SIM-GATEWAY',
  treasuryStatus:'INITIATED',taxCreditStatus:'PENDING_RECONCILIATION',
  createdAt:'2026-11-15',isSimulatedDemo:true,
} as ChallanReceipt;

test('M04 F-026/F-027/F-028: valid single Return copy keeps head, amount and parent; noncurrent AY requires explicit selection',()=>{
  const original=JSON.stringify(receipt);
  const copy=reuseRecordedPayment([receipt],'owner-1',sourceTin,parent);
  assert.equal(copy.service,'TAX_WITH_RETURN');
  assert.equal(copy.formPayload.category,'TAX_WITH_RETURN');
  assert.equal(copy.formPayload.assessmentYear,'');
  assert.equal(receipt.assessmentYear,'2025-26');
  copy.formPayload.assessmentYear='2025-26';
  assert.deepEqual(copy.formPayload.selectedHeadIds,[125]);
  assert.deepEqual(copy.formPayload.amountInputs,{125:'19.75'});
  assert.deepEqual(copy.formPayload.otherTaxLines,[]);
  assert.deepEqual(copy.formPayload.additionalTaxpayers,[]);
  assert.equal(copy.sourcePaymentId,parent);
  assert.equal(JSON.stringify(receipt),original,'Pay Again cannot mutate an original receipt');
});

test('M04 F-027/F-028/F-029: extra taxpayer or AY and mixed Return head reject Pay Again',()=>{
  const another={...allocation,allocationId:'second-allocation',taxpayerTin:otherTin};
  const differentYear={...allocation,allocationId:'another-year',assessmentYear:'2026-27'};
  for(const extra of [another,differentYear]){
    const bad={...receipt,items:[head,head],allocationItems:[allocation,extra],totalAmount:39.50} as ChallanReceipt;
    assert.throws(()=>reuseRecordedPayment([bad],'owner-1',sourceTin,parent),
      /exactly one taxpayer and one assessment year/);
  }
  const mixed={...receipt,items:[{...head,headId:121}]} as ChallanReceipt;
  assert.throws(()=>reuseRecordedPayment([mixed],'owner-1',sourceTin,parent),
    /Tax with Return cannot be combined/);
  const input={service:'TAX_WITH_RETURN',amountMinor:1975,details:{payerMode:'SELF'}} as unknown as StoryPaymentInput;
  assert.throws(()=>prepareCombinedOtherTaxPayment(input,receipt,[]),
    /INVALID_COMBINED_PAYMENT/);
});

test('M04 F-030: third-party payer remains distinct from recipient without inheriting history access',()=>{
  const parties=resolvePaymentPartyIdentity({
    isSelf:false,recipientTin:sourceTin,recipientName:'Recorded taxpayer',
    payerTin:otherTin,payerName:'Different payer'
  });
  assert.equal(parties.payerTin,otherTin);
  assert.equal(parties.payerName,'Different payer');
  assert.equal(parties.taxpayerName,'Recorded taxpayer');
  const thirdParty={...receipt,payerTin:otherTin,payerName:'Different payer',
    isRepresentativePayment:true} as ChallanReceipt;
  const copy=reuseRecordedPayment([thirdParty],'payer-owner',otherTin,parent);
  assert.equal(copy.formPayload.forSelf,false);
  assert.equal(copy.formPayload.tin,sourceTin);
  assert.equal(copy.formPayload.payerName,'','payer must re-enter identity');
  assert.equal(copy.ownerUid,'payer-owner','a copy never grants access to recipient history');
  const self=resolvePaymentPartyIdentity({isSelf:true,recipientTin:sourceTin,
    recipientName:'Recorded taxpayer'});
  assert.equal(self.payerTin,sourceTin);
});

test('M04 F-028: an unsupported historical year is never replaced by the current year',()=>{
  const old={...receipt,assessmentYear:'2020-21',
    allocationItems:[{...allocation,assessmentYear:'2020-21'}]} as ChallanReceipt;
  const copy=reuseRecordedPayment([old],'owner-1',sourceTin,parent);
  assert.equal(copy.formPayload.assessmentYear,'',
    'explicit re-selection is required; never default a historical year');
});
