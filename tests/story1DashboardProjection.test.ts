import test from 'node:test';
import assert from 'node:assert/strict';
import {projectStoredDashboardAllocations,summarizeStoredDashboardYear} from '../src/services/story1DashboardProjection';
import type {OwnedStoryPayment} from '../src/services/story1AccountPaymentHistory';

const batch='00000000-0000-4000-8000-000000000111';
const payment=(suffix:string,year:string,minor:number,extra:Record<string,unknown>={}):OwnedStoryPayment=>({
  id:'00000000-0000-4000-8000-'+suffix,
  service:'OTHER_TAX_PAYMENT',amountMinor:minor,status:'SIMULATED_SUCCESS',
  createdAt:'2026-11-12T04:00:00Z',
  details:{
    batchId:batch,batchItemIndex:suffix.endsWith('1')?1:2,batchItemCount:2,
    lines:[{beneficiary:'user2',category:'OTHER_TAX_PAYMENT',assessmentYear:year,amountMinor:minor}],
    ...extra,
  },
});

test('combined batch counts once per year and retains exact minor-unit allocation sums',()=>{
  const records=[
    payment('000000000001','2025-26',6550),
    payment('000000000002','2026-27',3450),
  ];
  const projected=projectStoredDashboardAllocations(records);
  assert.equal(projected.incompleteCount,0);
  assert.equal(projected.allocations.length,2);
  const older=summarizeStoredDashboardYear(projected,'2025-2026');
  const current=summarizeStoredDashboardYear(projected,'2026-2027');
  assert.equal(older.completedBatches,1);
  assert.equal(current.completedBatches,1);
  assert.equal(older.amountMinor,6550n);
  assert.equal(current.amountMinor,3450n);
  assert.deepEqual(older.allocations.map(row=>row.transactionId),[records[0].id]);
  assert.equal(current.monthlyPayments[0].amount,34.5);
  assert.equal(summarizeStoredDashboardYear(projected,'2024-2025').amountMinor,0n);
});

test('two heads within one payment and one year do not double count the combined receipt',()=>{
  const record=payment('000000000003','2026-27',10000,{
    batchId:batch,batchItemIndex:1,batchItemCount:1,
    lines:[
      {beneficiary:'user2',category:'OTHER_TAX_PAYMENT',assessmentYear:'2026-27',amountMinor:3000},
      {beneficiary:'user3',category:'OTHER_TAX_PAYMENT',assessmentYear:'2026-27',amountMinor:7000}
    ],
  });
  const year=summarizeStoredDashboardYear(projectStoredDashboardAllocations([record]),'2026-2027');
  assert.equal(year.completedBatches,1);
  assert.equal(year.allocations.length,2);
  assert.equal(year.amountMinor,10000n);
});

test('unattributed legacy and duplicate SQL readbacks cannot fabricate annual charts',()=>{
  const unknown:OwnedStoryPayment={
    ...payment('000000000004','2025-26',999),
    details:{assessmentYear:'2025-26, 2026-27'},
  };
  const projected=projectStoredDashboardAllocations([
    unknown,payment('000000000005','2026-27',1250,{batchItemIndex:1,batchItemCount:1}),
    payment('000000000005','2026-27',1250,{batchItemIndex:1,batchItemCount:1}),
  ]);
  assert.equal(projected.incompleteCount,2);
  assert.equal(projected.allocations.length,1);
  assert.equal(summarizeStoredDashboardYear(projected,'2025-2026').completedBatches,0);
  assert.equal(summarizeStoredDashboardYear(projected,'2026-2027').amountMinor,1250n);
});

test('partial or repeated members of a combined batch cannot appear in dashboard totals',()=>{
  const partial=projectStoredDashboardAllocations([
    payment('000000000011','2026-27',1000,{batchItemIndex:1,batchItemCount:2}),
  ]);
  assert.equal(partial.allocations.length,0);
  assert.equal(summarizeStoredDashboardYear(partial,'2026-2027').completedBatches,0);
  assert.equal(partial.incompleteCount,1);

  const duplicateIndex=projectStoredDashboardAllocations([
    payment('000000000021','2026-27',1000,{batchItemIndex:1,batchItemCount:2}),
    payment('000000000022','2026-27',2000,{batchItemIndex:1,batchItemCount:2}),
  ]);
  assert.equal(duplicateIndex.allocations.length,0);
  assert.equal(duplicateIndex.incompleteCount,1);
});
