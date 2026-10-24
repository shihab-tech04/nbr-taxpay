import assert from 'node:assert/strict';
import test from 'node:test';
import {reconcileDemoSimulationActivity} from '../src/services/demoSimulationActivity';
import type {SimulationTransaction,SimulationUser} from '../src/contracts/paymentSimulationContract';

const tx=(id:string,payer:SimulationUser,totalMinor:number,beneficiary:SimulationUser='user1',share:number=totalMinor):SimulationTransaction=>({
  id:'SIM-'+id,transactionId:id,payer,state:'SIMULATED',simulationOnly:true,
  createdAt:'2026-10-24T12:00:00Z',totalMinor,reviewStatus:'MIRRORED_TO_OFFICE',
  allocations:[{id:'line-'+id,lineNo:1,beneficiary,category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:share}],
  events:[]
});
test('beneficiary sees only allocated paisa, never another payer total or government credit',()=>{
  const incoming=tx('other-user','user4',120000,'user1',3250);
  const x=reconcileDemoSimulationActivity('user1',[],[incoming]);
  assert.equal(x.length,1);
  assert.equal(x[0].perspective,'beneficiary');
  assert.equal(x[0].payer,'user4');
  assert.equal(x[0].amountMinor,3250);
  assert.notEqual(x[0].amountMinor,incoming.totalMinor);
});
test('payer and beneficiary entries for the same transaction are not duplicated',()=>{
  const own=tx('own-payment','user1',150050);
  const x=reconcileDemoSimulationActivity('user1',[own],[own]);
  assert.equal(x.length,1);
  assert.equal(x[0].amountMinor,150050);
  assert.equal(x[0].perspective,'payer');
});
test('invalid, other-user and overallocated records fail closed',()=>{
  assert.deepEqual(reconcileDemoSimulationActivity('user1',[],[tx('wrong','user4',1000,'user2',1000)]),[]);
  assert.deepEqual(reconcileDemoSimulationActivity('user1',[],[tx('overspent','user4',1000,'user1',1001)]),[]);
  assert.deepEqual(reconcileDemoSimulationActivity('user1',[],[tx('fractional','user4',1000,'user1',12.5)]),[]);
  assert.deepEqual(reconcileDemoSimulationActivity('user1',[],[{...tx('official','user4',1000),simulationOnly:false as true}]),[]);
  assert.deepEqual(reconcileDemoSimulationActivity('user1',[],[{...tx('unknown','user4',1000),state:'PENDING'}]),[]);
});
