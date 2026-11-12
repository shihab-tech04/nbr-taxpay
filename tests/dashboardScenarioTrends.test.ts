import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeOwnedScenarioMonths} from '../src/components/screens/DashboardScenarioTrends';
import {filterPrivateDashboardTransactionsByYear, type DashboardSimulationTransaction} from '../src/services/accountDashboardProjection';

const row=(id:string,createdAt:string,amountMinor:number,state:DashboardSimulationTransaction['state']='SIMULATED',
  participantView:DashboardSimulationTransaction['participantView']='payer',year='2026-27'):DashboardSimulationTransaction=>({
  id,transactionId:id,payer:'user1',state,createdAt,amountMinor,participantView,
  allocations:[{id:id+'-allocation',lineNo:1,beneficiary:'user2',category:'ADVANCE_TAX',assessmentYear:year,amountMinor}],
});

test('monthly chart includes only completed payments initiated by the signed-in scenario profile',()=>{
  const transactions=[
    row('oct','2026-10-20T12:00:00Z',10000),
    row('nov','2026-11-01T12:00:00Z',20500),
    row('ben','2026-11-02T12:00:00Z',100000,'SIMULATED','beneficiary'),
    row('pending','2026-11-03T12:00:00Z',90000,'PENDING'),
    row('failed','2026-11-04T12:00:00Z',80000,'FAILED'),
    row('reversed','2026-11-05T12:00:00Z',70000,'REVERSED'),
  ];
  const months=summarizeOwnedScenarioMonths(transactions,'en');
  assert.equal(months.length,6);
  assert.equal(months[0].month,'2026-06');
  assert.equal(months[4].month,'2026-10');
  assert.equal(months[4].amountMinor,10000n);
  assert.equal(months[5].month,'2026-11');
  assert.equal(months[5].amountMinor,20500n);
  assert.equal(months[5].count,1);
});

test('assessment-year filtering retains original allocation identities and prevents cross-year leakage',()=>{
  const transaction=row('multi','2026-10-30T12:00:00Z',30000);
  transaction.allocations=[
    {id:'ay-current',lineNo:1,beneficiary:'user2',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:10000},
    {id:'ay-previous',lineNo:2,beneficiary:'user3',category:'PENALTY',assessmentYear:'2025-26',amountMinor:20000},
  ];
  const current=filterPrivateDashboardTransactionsByYear([transaction],'2026-27');
  const older=filterPrivateDashboardTransactionsByYear([transaction],'2025-26');
  assert.deepEqual(current[0].allocations.map(item=>item.id),['ay-current']);
  assert.deepEqual(older[0].allocations.map(item=>item.id),['ay-previous']);
  assert.equal(summarizeOwnedScenarioMonths(current,'en')[5].amountMinor,10000n);
  assert.equal(summarizeOwnedScenarioMonths(older,'en')[5].amountMinor,20000n);
});

test('no owner-initiated completed payments produces an honest empty chart',()=>{
  assert.deepEqual(summarizeOwnedScenarioMonths([
    row('recipient','2026-11-05T12:00:00Z',100000,'SIMULATED','beneficiary'),
    row('pending','2026-11-05T12:00:00Z',10000,'PENDING'),
  ],'bn'),[]);
});
