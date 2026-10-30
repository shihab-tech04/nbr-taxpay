import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPrivateDashboardTransactionsByYear,projectPrivateDashboardTransactions} from '../src/services/accountDashboardProjection';

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
