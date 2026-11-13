import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPrivateDashboardTransactionsByYear,projectPrivateDashboardTransactions,selectCompletedPayerDashboardTransactions,summarizePrivateDashboardPaymentTotals} from '../src/services/accountDashboardProjection';

const transaction=(overrides:Record<string,unknown>={})=>({
  id:'SIM-PAY-001',transactionId:'00000000-0000-4000-8000-000000000001',payer:'user1',
  state:'SIMULATED',createdAt:'2026-10-29T10:00:00Z',simulationOnly:true,totalMinor:30000,
  allocations:[
    {id:'allocation-1',lineNo:1,beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:10000},
    {id:'allocation-2',lineNo:2,beneficiary:'user2',category:'PENALTY',assessmentYear:'2025-26',amountMinor:20000},
  ],events:[],...overrides
});

test('payer and beneficiary views deduplicate the same transaction and retain payer-owned totals',()=>{
  const payer=transaction();
  const beneficiary=transaction({...payer,allocations:[payer.allocations[0]]});
  const [row]=projectPrivateDashboardTransactions('user1',[payer],[beneficiary]);
  assert.equal(row.amountMinor,30000);
  assert.equal(row.participantView,'both');
  assert.equal(row.allocations.length,2);
});

test('beneficiary-only history reports only allocations returned for the bound profile',()=>{
  const source=transaction();
  const rowData=transaction({
    payer:'user1',
    allocations:[source.allocations[1]],
  });
  const [row]=projectPrivateDashboardTransactions('user2',[],[rowData]);
  assert.equal(row.amountMinor,20000);
  assert.equal(row.participantView,'beneficiary');
  assert.deepEqual(row.allocations.map(allocation=>allocation.beneficiary),['user2']);
});

test('rejects unowned, non-simulation, malformed and non-reconciling payment records',()=>{
  assert.throws(()=>projectPrivateDashboardTransactions('user2',[transaction()],[]),/different account/);
  assert.throws(()=>projectPrivateDashboardTransactions('user1',[transaction({simulationOnly:false})],[]),/Unrecognized account payment record/);
  assert.throws(()=>projectPrivateDashboardTransactions('user2',[],[transaction({allocations:[]})]),/does not contain this account/);
  assert.throws(()=>projectPrivateDashboardTransactions('user1',[transaction({totalMinor:1})],[]),/does not reconcile/);
});

test('sorts account records by their validated creation time',()=>{
  const older=transaction({id:'SIM-PAY-000',transactionId:'00000000-0000-4000-8000-000000000000',createdAt:'2026-10-28T10:00:00Z'});
  const newer=transaction({id:'SIM-PAY-002',transactionId:'00000000-0000-4000-8000-000000000002',createdAt:'2026-10-30T10:00:00Z'});
  assert.deepEqual(projectPrivateDashboardTransactions('user1',[older,newer],[]).map(row=>row.id),['SIM-PAY-002','SIM-PAY-000']);
});

test('assessment-year filtering recalculates only the selected allocations',()=>{
  const source=transaction({
    totalMinor:30000,
    allocations:[
      {id:'year-1',lineNo:1,beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:10000},
      {id:'year-2',lineNo:2,beneficiary:'user1',category:'ADVANCE_TAX',assessmentYear:'2025-26',amountMinor:20000},
    ],
  });
  const [row]=projectPrivateDashboardTransactions('user1',[source],[]);
  const filtered=filterPrivateDashboardTransactionsByYear([row],'2025-26');
  assert.equal(filtered.length,1);
  assert.equal(filtered[0].amountMinor,20000);
  assert.deepEqual(filtered[0].allocations.map(allocation=>allocation.assessmentYear),['2025-26']);
  assert.deepEqual(filterPrivateDashboardTransactionsByYear([row],'2024-25'),[]);
});

test('assessment-year filtering rejects malformed year values',()=>{
  assert.throws(()=>filterPrivateDashboardTransactionsByYear([],'2026-2027'),/Invalid dashboard assessment year/);
});


test('completed dashboard payer totals exclude beneficiary-only payments but keep both-view payer transactions',()=>{
  const [payer]=projectPrivateDashboardTransactions('user1',[transaction()],[]);
  const [recipient]=projectPrivateDashboardTransactions('user2',[],[
    transaction({allocations:[transaction().allocations[1]]})
  ]);
  const [both]=projectPrivateDashboardTransactions('user1',[transaction()],[transaction({
    allocations:[transaction().allocations[0]]
  })]);
  const completed=selectCompletedPayerDashboardTransactions([payer,recipient,
    {...payer,transactionId:'failed',state:'FAILED' as const}
  ]);
  assert.deepEqual(completed.map(row=>row.transactionId),[payer.transactionId]);
  assert.equal(completed.reduce((sum,row)=>sum+row.amountMinor,0),30000);
  assert.equal(completed.some(row=>row.participantView==='beneficiary'),false);
  assert.deepEqual(selectCompletedPayerDashboardTransactions([both]).map(row=>row.participantView),['both']);
});

test('dashboard totals count each payer parent once and split self, other and received allocations',()=>{
  const payer=transaction({totalMinor:30000,allocations:[
    {id:'payer-self',lineNo:1,beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:10000},
    {id:'payer-other',lineNo:2,beneficiary:'user2',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:20000},
  ]});
  const received=transaction({
    id:'SIM-PAY-RECEIVED',transactionId:'00000000-0000-4000-8000-000000000003',
    payer:'user2',totalMinor:9000,
    allocations:[{id:'received-1',lineNo:1,beneficiary:'user1',category:'PENALTY',assessmentYear:'2026-27',amountMinor:4000}],
  });
  const rows=projectPrivateDashboardTransactions('user1',[payer],[
    {...payer,allocations:[payer.allocations[0]]},received,
  ]);
  const totals=summarizePrivateDashboardPaymentTotals(
    filterPrivateDashboardTransactionsByYear(rows,'2026-27'),'user1',
  );
  assert.equal(totals.payerTotalMinor,30000n);
  assert.equal(totals.selfAllocationMinor,10000n);
  assert.equal(totals.paidForOthersMinor,20000n);
  assert.equal(totals.receivedTotalMinor,4000n);
});

test('dashboard totals follow the selected year and do not create payer totals for received-only activity',()=>{
  const payer=transaction({totalMinor:50000,allocations:[
    {id:'payer-current-self',lineNo:1,beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:10000},
    {id:'payer-current-other',lineNo:2,beneficiary:'user2',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:20000},
    {id:'payer-prior-self',lineNo:3,beneficiary:'user1',category:'PENALTY',assessmentYear:'2025-26',amountMinor:5000},
    {id:'payer-prior-other',lineNo:4,beneficiary:'user3',category:'SOURCE_TAX_DEPOSIT',assessmentYear:'2025-26',amountMinor:15000},
  ]});
  const [projectedPayer]=projectPrivateDashboardTransactions('user1',[payer],[]);
  const prior=summarizePrivateDashboardPaymentTotals(
    filterPrivateDashboardTransactionsByYear([projectedPayer],'2025-26'),'user1',
  );
  assert.equal(prior.payerTotalMinor,20000n);
  assert.equal(prior.selfAllocationMinor,5000n);
  assert.equal(prior.paidForOthersMinor,15000n);
  assert.equal(prior.receivedTotalMinor,0n);

  const received=transaction({
    id:'SIM-PAY-RECEIVED-ONLY',transactionId:'00000000-0000-4000-8000-000000000004',
    payer:'user2',totalMinor:9000,
    allocations:[{id:'received-only',lineNo:1,beneficiary:'user1',category:'PENALTY',assessmentYear:'2026-27',amountMinor:4000}],
  });
  const [recipient]=projectPrivateDashboardTransactions('user1',[],[received]);
  const receivedOnly=summarizePrivateDashboardPaymentTotals([recipient],'user1');
  assert.equal(receivedOnly.payerTotalMinor,0n);
  assert.equal(receivedOnly.selfAllocationMinor,0n);
  assert.equal(receivedOnly.paidForOthersMinor,0n);
  assert.equal(receivedOnly.receivedTotalMinor,4000n);
});

test('failed or pending activity is excluded from completed payer and received totals',()=>{
  const payer=transaction({state:'FAILED'});
  const received=transaction({
    id:'SIM-PAY-PENDING-RECEIVED',transactionId:'00000000-0000-4000-8000-000000000005',
    payer:'user2',state:'PENDING',totalMinor:9000,
    allocations:[{id:'pending-received',lineNo:1,beneficiary:'user1',category:'PENALTY',assessmentYear:'2026-27',amountMinor:4000}],
  });
  const rows=projectPrivateDashboardTransactions('user1',[payer],[received]);
  const totals=summarizePrivateDashboardPaymentTotals(rows,'user1');
  assert.equal(totals.payerTotalMinor,0n);
  assert.equal(totals.receivedTotalMinor,0n);
});
