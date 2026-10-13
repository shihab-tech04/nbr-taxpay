import assert from 'node:assert/strict';
import test from 'node:test';
import {demoTransactions,demoUserIds,getDemoUserAllocations,getDemoUserTransactions,appendValidatedDemoTransaction,validateDemoTransaction,demoCoverage,transactionTotalMinor} from '../src/data/demoPaymentTransactions.ts';
test('all eight payer/beneficiary structural categories are represented',()=>{
  assert.equal(Object.values(demoCoverage()).every(Boolean),true);
});
test('five seeded users and five empty users are isolated',()=>{
  for(const id of demoUserIds.slice(0,5))assert.ok(getDemoUserAllocations(id).length>0);
  for(const id of demoUserIds.slice(5)){
    assert.equal(getDemoUserAllocations(id).length,0);
    assert.equal(getDemoUserTransactions(id,demoTransactions,'payer').length,0);
  }
});
test('transaction amounts and event timeline ordering are deterministic',()=>{
  const ids=new Set<string>();
  for(const tx of demoTransactions){
    assert.deepEqual(validateDemoTransaction(tx),[]);
    assert.equal(transactionTotalMinor(tx),tx.allocations.reduce((v,a)=>v+a.amountMinor,0));
    assert.equal(ids.has(tx.id),false);ids.add(tx.id);
    assert.equal(tx.simulationOnly,true);
  }
});
test('payer sees full multi-beneficiary transaction while beneficiary sees only their lines',()=>{
  const t=demoTransactions.find(t=>t.id==='DEMO-TX-005')!;
  assert.equal(t.payer,'user4');
  assert.deepEqual(new Set(t.allocations.map(a=>a.beneficiary)),new Set(['user4','user1','user5']));
  assert.equal(getDemoUserTransactions('user1',demoTransactions,'payer').some(t=>t.id==='DEMO-TX-005'),false);
  assert.equal(getDemoUserAllocations('user1').some(e=>e.transaction.id==='DEMO-TX-005'),true);
});
test('new activity can be added to empty user and replay is rejected',()=>{
  const base=demoTransactions[0];
  const extra={...base,id:'DEMO-TX-010',allocations:[{...base.allocations[0],id:'DEMO-L-017',beneficiary:'user6' as const}],events:base.events.map((e,i)=>({...e,id:'DEMO-TX-010-'+i}))};
  const next=appendValidatedDemoTransaction(demoTransactions,extra);
  assert.equal(getDemoUserAllocations('user6',next).length,1);
  assert.equal(getDemoUserAllocations('user6').length,0);
  assert.throws(()=>appendValidatedDemoTransaction(next,extra));
});
