import test from 'node:test';
import assert from 'node:assert/strict';
import {beneficiaryProfilePayments,countsTowardBeneficiaryPaidTotal,missingOptionalSimulationBinding} from '../src/services/beneficiaryProfileHistory';
import {sampleTinForUserNumber} from '../src/data/sampleTinSuggestions';
import type {SimulationTransaction} from '../src/contracts/paymentSimulationContract';
import type {OwnedStoryPayment} from '../src/services/story1AccountPaymentHistory';
import {readFileSync} from 'node:fs';

const tin2=sampleTinForUserNumber(2)!;
const transaction:SimulationTransaction={
  id:'tx-a',transactionId:'tx-a',payer:'user1',state:'SIMULATED',
  createdAt:'2026-11-09T10:00:00Z',simulationOnly:true,totalMinor:30000,
  reviewStatus:'APPROVER_CLOSED',events:[],
  allocations:[
    {id:'a',lineNo:1,beneficiary:'user2',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:10000},
    {id:'b',lineNo:2,beneficiary:'user3',category:'PENALTY',assessmentYear:'2025-26',amountMinor:15000},
    {id:'c',lineNo:3,beneficiary:'user2',category:'OTHER_TAX_PAYMENT',assessmentYear:'2024-25',amountMinor:5000}
  ]
};

test('profile calculates only the selected TIN allocation, across heads and assessment years',()=>{
  const items=beneficiaryProfilePayments(tin2,[],[transaction],'user1','en');
  assert.equal(items.length,2);
  assert.equal(items.reduce((sum,item)=>sum+item.amountMinor,0),15000);
  assert.deepEqual(new Set(items.map(item=>item.assessmentYear)),new Set(['2026-27','2024-25']));
  assert.deepEqual(new Set(items.map(item=>item.paymentHead)),new Set(['Advance tax','Other tax payment']));
  assert.equal(new Set(items.map(item=>item.transactionId)).size,1,'one combined transaction, never two payments');
  assert.ok(items.every(item=>item.source==='simulation'&&countsTowardBeneficiaryPaidTotal(item)));
});

test('other beneficiaries and unmatched saved TINs remain out of this profile',()=>{
  const otherTin=sampleTinForUserNumber(3)!;
  assert.deepEqual(beneficiaryProfilePayments(otherTin,[],[transaction],'user1','bn').map(x=>x.amountMinor),[15000]);
  assert.deepEqual(beneficiaryProfilePayments('000000000000',[],[transaction],'user1','en'),[]);
});

test('pending, failed and reversed remain in activity but never inflate paid totals',()=>{
  const rows=([
    {...transaction,transactionId:'tx-p',id:'tx-p',state:'PENDING' as const},
    {...transaction,transactionId:'tx-f',id:'tx-f',state:'FAILED' as const},
    {...transaction,transactionId:'tx-r',id:'tx-r',state:'REVERSED' as const}
  ]);
  const records=beneficiaryProfilePayments(tin2,[],rows,'user1','en');
  assert.equal(records.length,6);
  assert.equal(records.filter(countsTowardBeneficiaryPaidTotal).length,0);
});

test('profile fails closed on a foreign payer record or corrupt allocation',()=>{
  assert.throws(()=>beneficiaryProfilePayments(tin2,[],[transaction],'user2','en'),/payer-scoped/);
  assert.throws(()=>beneficiaryProfilePayments(tin2,[],[{
    ...transaction,allocations:[{...transaction.allocations[0],amountMinor:-100}]
  }],'user1','en'),/allocation amount/);
  assert.throws(()=>beneficiaryProfilePayments('bad',[],[transaction],'user1','en'),/TIN/);
});

test('beneficiary profile remains within existing signed-in route and table actions',()=>{
  const directory=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  const profile=readFileSync('src/components/screens/BeneficiaryProfile.tsx','utf8');
  assert.match(directory,/<BeneficiaryProfile/);
  assert.match(directory,/beneficiary-directory__actions/);
  assert.match(directory,/onClick=\{\(\)=>payWith\(\[person\]\)\}/);
  assert.match(directory,/onClick=\{\(\)=>openPersonEditor\(person\)\}/);
  assert.match(profile,/onBack/);
  assert.match(profile,/loadBeneficiaryProfilePayments/);
  assert.match(profile,/ReceiptView receipt=\{selected.receipt\}/);
});

test('only an explicitly unbound synthetic profile is optional for signed-in story history',()=>{
  assert.equal(missingOptionalSimulationBinding(new Error('No approved synthetic profile binding')),true);
  assert.equal(missingOptionalSimulationBinding(new Error('Authentication required')),false);
  assert.equal(missingOptionalSimulationBinding(new Error('Permission denied')),false);
  assert.equal(missingOptionalSimulationBinding(new Error('Payment service unavailable')),false);
  assert.equal(missingOptionalSimulationBinding('No approved synthetic profile binding'),false);
});

test('replayed recorded payment is counted once in a beneficiary profile and retains original IDs',()=>{
  const sqlPayment:OwnedStoryPayment={
    id:'00000000-0000-4000-8000-000000000901',
    service:'ADVANCE_TAX',amountMinor:7500,status:'SIMULATED_SUCCESS',
    createdAt:'2026-11-12T00:00:00Z',
    details:{taxpayerTin:tin2,taxpayerName:'Two',payerName:'One',assessmentYear:'2026-27'}
  };
  const history=beneficiaryProfilePayments(tin2,[sqlPayment,{...sqlPayment}],[],'user1','en');
  assert.equal(history.length,1,'same immutable recorded payment must not be counted twice');
  assert.equal(history[0].amountMinor,7500);
  assert.equal(history[0].paymentId,sqlPayment.id);
  assert.equal(history[0].transactionId,sqlPayment.id);
  assert.equal(history[0].taxpayerTin,tin2);
});

test('conflicting recorded snapshots fail closed; a corrected later retry succeeds',()=>{
  const original:OwnedStoryPayment={
    id:'00000000-0000-4000-8000-000000000902',
    service:'ADVANCE_TAX',amountMinor:8500,status:'SIMULATED_SUCCESS',
    createdAt:'2026-11-12T00:00:00Z',
    details:{taxpayerTin:tin2,taxpayerName:'Two',payerName:'One',assessmentYear:'2026-27'}
  };
  assert.throws(()=>beneficiaryProfilePayments(tin2,[original,{...original,amountMinor:18500}],[],'user1','en'),
    /Conflicting recorded beneficiary payment history/);
  const corrected=beneficiaryProfilePayments(tin2,[original,{...original}],[],'user1','en');
  assert.equal(corrected.length,1);
  assert.equal(corrected[0].amountMinor,8500);
  assert.deepEqual(beneficiaryProfilePayments('000000000000',[original],[],'user1','en'),[],
    'even the same payer must never display a different recipient TIN as their own');
});


test('replayed payer simulation history counts each allocation once and keeps original transaction identity',()=>{
  const history=beneficiaryProfilePayments(tin2,[],[transaction,{...transaction}],'user1','en');
  assert.equal(history.length,2);
  assert.equal(history.reduce((sum,item)=>sum+item.amountMinor,0),15000);
  assert.deepEqual(new Set(history.map(item=>item.transactionId)),new Set(['tx-a']));
  assert.deepEqual(new Set(history.map(item=>item.assessmentYear)),new Set(['2026-27','2024-25']));
});

test('simulation history mismatches fail closed and corrected retry restores original allocations',()=>{
  const altered={...transaction,totalMinor:40000};
  assert.throws(()=>beneficiaryProfilePayments(tin2,[],[transaction,altered],'user1','en'),
    /Conflicting payer-scoped simulation history/);
  assert.throws(()=>beneficiaryProfilePayments(tin2,[],[altered],'user1','en'),
    /Unreconciled beneficiary allocation total/);
  const repaired=beneficiaryProfilePayments(tin2,[],[transaction,{...transaction}],'user1','en');
  assert.deepEqual(repaired.map(item=>item.amountMinor),[10000,5000]);
});

test('duplicate simulation recovery cannot bypass payer account isolation',()=>{
  assert.throws(()=>beneficiaryProfilePayments(tin2,[],[transaction,{...transaction}],'user2','en'),
    /Invalid payer-scoped payment activity/);
  const otherTin=sampleTinForUserNumber(3)!;
  const result=beneficiaryProfilePayments(otherTin,[],[transaction,{...transaction}],'user1','en');
  assert.equal(result.length,1);
  assert.equal(result[0].amountMinor,15000);
  assert.equal(result[0].transactionId,'tx-a');
});
