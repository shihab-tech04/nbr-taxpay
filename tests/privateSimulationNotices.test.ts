import assert from 'node:assert/strict';
import test from 'node:test';
import type {SimulationTransaction,SimulationNotice,SimulationUser} from '../src/contracts/paymentSimulationContract';
import {reconcilePrivateSimulationNotices} from '../src/services/privateSimulationNotices';

const tx=(id:string,payer:SimulationUser,totalMinor:number,beneficiary:SimulationUser='user1',allocation=totalMinor):SimulationTransaction=>({
  id,transactionId:id,payer,state:'SIMULATED',simulationOnly:true,totalMinor,
  createdAt:'2026-10-25T01:00:00Z',reviewStatus:'APPROVER_CLOSED',
  allocations:[{id:id+'-1',lineNo:1,beneficiary,category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:allocation}],
  events:[],
});
const notice=(transactionId:string,userId:SimulationUser='user1'):SimulationNotice=>({
  id:1,userId,transactionId,messageCode:'SIM_OFFICER_APPROVER_CLOSED',
  createdAt:'2026-10-25T01:00:00Z',isRead:false,
});

test('payer notification shows exact stored total and preserves SQL read state',()=>{
  const record=tx('owner','user1',120050);
  const rows=reconcilePrivateSimulationNotices('user1',[notice('owner')],[record],[record]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].amountMinor,120050);
  assert.equal(rows[0].perspective,'payer');
  assert.equal(rows[0].isRead,false);
});
test('beneficiary notification never exposes another payer total',()=>{
  const record=tx('shared','user4',13000,'user1',655);
  const rows=reconcilePrivateSimulationNotices('user1',[{...notice('shared'),isRead:true}],[],[record]);
  assert.equal(rows[0].amountMinor,655);
  assert.equal(rows[0].perspective,'beneficiary');
  assert.equal(rows[0].isRead,true);
  assert.notEqual(rows[0].amountMinor,record.totalMinor);
});
test('unmatched and non-simulated transactions never receive invented amounts',()=>{
  assert.equal(reconcilePrivateSimulationNotices('user1',[notice('unknown')],[],[])[0].amountMinor,null);
  assert.equal(reconcilePrivateSimulationNotices('user1',[notice('shared')],[],[tx('shared','user4',1000,'user2',1000)])[0].amountMinor,null);
  assert.equal(reconcilePrivateSimulationNotices('user1',[notice('unsafe')],[],[{...tx('unsafe','user4',1000),state:'PENDING'}])[0].amountMinor,null);
  assert.equal(reconcilePrivateSimulationNotices('user1',[notice('fraction')],[],[tx('fraction','user4',1000,'user1',12.5)])[0].amountMinor,null);
});
test('wrong-owner notification fails closed even if a transaction reference is shared',()=>{
  assert.throws(()=>reconcilePrivateSimulationNotices('user1',[notice('owner','user2')],[tx('owner','user1',1000)],[]),/owner mismatch/);
});
test('SQL notification history is not truncated to the preview-only 30 records',()=>{
  const records=Array.from({length:35},(_,i)=>tx('entry-'+i,'user1',100+i));
  const notices=records.map((record,i)=>({...notice(record.transactionId),id:i+1}));
  const rows=reconcilePrivateSimulationNotices('user1',notices,records,[]);
  assert.equal(rows.length,35);
  assert.equal(rows[34].amountMinor,134);
});
