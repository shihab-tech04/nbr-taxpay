import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcile} from './phase4-reconcile.mjs';
const row={id:'8aeab741-1687-429b-abf3-ed8d0746c095',service_code:'OTHER_TAX_PAYMENT',amount_minor:5000,status:'SIMULATED_SUCCESS',
  data:{origin:'TAXPAY_UI',idempotencyKey:'safe-id',details:{payerTin:'111111111111',payerId:'payer',payerMode:'OTHER',
    taxpayerTin:'222222222222',assessmentYear:'2026-27',paymentSource:'BANK',receiptReference:'R',
    receiptSnapshot:{challanNo:'C',paymentTransactionId:'P',taxEventId:'E'},
    allocations:[{allocationId:'A',headId:121,taxpayerTin:'222222222222',assessmentYear:'2026-27',dhara:'verified-1',amountMinor:1500},
      {allocationId:'B',headId:145,taxpayerTin:'333333333333',assessmentYear:'2025-26',dhara:'verified-2',amountMinor:3500}],lines:[]}}};
const copy=x=>structuredClone(x);
test('historical parity preserves allocations but cannot prove payment success',()=>{
  const x=reconcile([row],[copy(row)]);
  assert.equal(x.parityPassed,true);assert.equal(x.matched,1);assert.equal(x.releaseVerified,false);assert.equal(x.simulated,1);
});
test('all requested fields flag changes without revealing personal identifiers',()=>{
  const changes={payer:x=>x.data.details.payerTin='999999999999',recipient:x=>x.data.details.taxpayerTin='999999999999',
    year:x=>x.data.details.assessmentYear='2025-26',dhara:x=>x.data.details.allocations[0].dhara='changed',
    source:x=>x.data.details.paymentSource='BRTA',amount:x=>x.amount_minor=5001,status:x=>x.status='PENDING',
    challan:x=>x.data.details.receiptSnapshot.challanNo='DIFFERENT',
    references:x=>x.data.details.receiptReference='DIFFERENT',
    allocations:x=>x.data.details.allocations[0].allocationId='DIFFERENT'};
  for(const [field,mutate] of Object.entries(changes)){
    const other=copy(row);mutate(other);const x=reconcile([row],[other]);
    assert.equal(x.parityPassed,false,field);
    assert.ok(x.issues.some(i=>i.field===field||i.field.startsWith(field+'.')||i.field.startsWith(field+'[')||
      (field==='recipient'&&i.field.startsWith('allocations'))||(field==='dhara'&&i.field.startsWith('allocations'))),field);
    assert.equal(JSON.stringify(x).includes('111111111111'),false);
    assert.equal(JSON.stringify(x).includes('222222222222'),false);
  }
});
test('duplicate, missing, unrequested and corrupted allocations block equality',()=>{
  assert.equal(reconcile([row],[]).issues[0].reason,'MISSING_OFFICE');
  assert.equal(reconcile([],[row]).issues[0].reason,'UNEXPECTED_OFFICE');
  assert.ok(reconcile([row,copy(row)],[row]).issues.some(i=>i.reason==='DUPLICATE'));
  const bad=copy(row);bad.data.details.allocations[1].amountMinor=3499;
  assert.ok(reconcile([bad],[copy(bad)]).issues.some(i=>i.reason==='INVALID_TOTAL_OR_IDENTITY'));
});
test('missing Dhara and challan never count as complete release proof',()=>{
  const bad=copy(row);delete bad.data.details.receiptSnapshot.challanNo;
  for(const a of bad.data.details.allocations)delete a.dhara;
  const x=reconcile([bad],[copy(bad)]);
  assert.equal(x.parityPassed,true);assert.equal(x.missingDhara,1);assert.equal(x.missingChallan,1);
  assert.equal(x.releaseVerified,false);
});
test('BigInt allocation arithmetic preserves amounts above JS safe integer range',()=>{
  const big=copy(row);big.amount_minor='9007199254740993';
  big.data.details.allocations[0].amountMinor='9007199254737493';
  assert.equal(reconcile([big],[copy(big)]).issues.length,0);
});
test('legacy fallback and V2 candidate form one deduplicated Office ledger',()=>{
  const next=copy(row);next.id='aaabb338-17cf-456f-a15e-ab2761b5e7a0';
  assert.equal(reconcile([row,next],[row]).issues[0].reason,'MISSING_OFFICE');
  assert.equal(reconcile([row,next],[row,next]).matched,2);
  assert.ok(reconcile([row,copy(row)],[row]).issues.some(i=>i.reason==='DUPLICATE'));
});

test('zero record populations are not reconciliation evidence',()=>{ assert.equal(reconcile([],[]).parityPassed,false); });


test('matching historical rows with absent allocation IDs are not field-complete',()=>{
  const legacy=copy(row); delete legacy.data.details.allocations[0].allocationId;
  delete legacy.data.details.allocations[1].allocationId;
  const x=reconcile([legacy],[copy(legacy)]);
  assert.equal(x.parityPassed,true);
  assert.equal(x.fieldComplete,false);
  assert.equal(x.missingAllocationIds,1);
  assert.equal(x.releaseVerified,false);
});
test('missing source is reported without inventing legal or payment provenance',()=>{
  const uncertain=copy(row);delete uncertain.data.details.paymentSource;
  const x=reconcile([uncertain],[copy(uncertain)]);
  assert.equal(x.parityPassed,true);
  assert.equal(x.missingSource,1);
  assert.equal(x.fieldComplete,false);
});

test('distinct source and application-origin provenance are compared separately',()=>{
  const changed=copy(row);changed.data.origin='QA_BROWSER';
  const result=reconcile([row],[changed]);
  assert.equal(result.parityPassed,false);
  assert.ok(result.issues.some(i=>i.field==='origin'));
  const complete=reconcile([row],[copy(row)]);
  assert.equal(complete.parityPassed,true);
  assert.equal(complete.fieldComplete,true);
  assert.equal(complete.releaseVerified,false);
});

test('Travel Tax does not require a taxpayer TIN or Dhara',()=>{
 const travel=copy(row);
 travel.service_code='TRAVEL_TAX';
 delete travel.data.details.taxpayerTin;
 delete travel.data.details.allocations;
 delete travel.data.details.dhara;
 const x=reconcile([travel],[copy(travel)]);
 assert.equal(x.parityPassed,true);
 assert.equal(x.missingDhara,0);
 assert.equal(x.missingRecipient,0);
 assert.equal(x.fieldComplete,true);
 assert.equal(x.releaseVerified,false);
});
test('non-Travel payment without a payer or recipient cannot claim field completeness',()=>{
 const missingPayer=copy(row);
 delete missingPayer.data.details.payerTin;
 delete missingPayer.data.details.payerId;
 const payerReport=reconcile([missingPayer],[copy(missingPayer)]);
 assert.equal(payerReport.parityPassed,true);
 assert.equal(payerReport.missingPayer,1);
 assert.equal(payerReport.fieldComplete,false);
 const missingRecipient=copy(row);
 delete missingRecipient.data.details.allocations;
 delete missingRecipient.data.details.taxpayerTin;
 missingRecipient.data.details.dhara='verified';
 const recipientReport=reconcile([missingRecipient],[copy(missingRecipient)]);
 assert.equal(recipientReport.parityPassed,true);
 assert.equal(recipientReport.missingRecipient,1);
 assert.equal(recipientReport.fieldComplete,false);
});
