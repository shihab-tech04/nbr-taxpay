/** HISTORICAL TEST ONLY: public sandbox endpoint permissions intentionally retired by protected-profile security policy. Original assertions preserved verbatim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 simulationUsers,loadSimulationHistory,loadSimulationNotices,
 parseSimulatedAmount,formatSimulatedAmount
} from '../src/services/simulatedPaymentsApi';

test('decimal taka conversion uses exact integer paisa',()=>{
 assert.equal(parseSimulatedAmount('100.25'),10025);
 assert.equal(parseSimulatedAmount('0.01'),1);
 assert.equal(parseSimulatedAmount('1'),100);
 assert.throws(()=>parseSimulatedAmount('-1'));
 assert.throws(()=>parseSimulatedAmount('1.234'));
 assert.throws(()=>parseSimulatedAmount('0'));
 assert.match(formatSimulatedAmount(10025),/100.25/);
});
test('hosted SQL simulation exposes exact seeded transaction and allocation graph',async()=>{
 const all=await loadSimulationHistory(null,'all');
 assert.ok(all.length>=9,'Seeded SQL transactions not available');
 assert.equal(new Set(all.map(t=>t.id)).size,all.length);
 const seeded=all.filter(t=>/^DEMO-TX-00[1-9]$/.test(t.id));
 assert.equal(seeded.length,9);
 assert.equal(seeded.reduce((n,t)=>n+t.allocations.length,0),16);
 assert.equal(seeded.reduce((n,t)=>n+t.totalMinor,0),5040000);
 for(const transaction of all){
   assert.equal(transaction.simulationOnly,true);
   assert.equal(transaction.allocations.reduce((n,l)=>n+l.amountMinor,0),transaction.totalMinor,transaction.id+' unequal allocations');
   assert.ok(transaction.events.length>=3,transaction.id+' events missing');
   for(let index=1;index<transaction.events.length;index++)
     assert.ok(new Date(transaction.events[index].occurredAt).getTime()>=new Date(transaction.events[index-1].occurredAt).getTime());
 }
});
test('taxpayer beneficiary, payer, notices match the shared SQL transaction projection',async()=>{
 const all=await loadSimulationHistory(null,'all');
 const views=await Promise.all(simulationUsers.map(async user=>({
  user,beneficiary:await loadSimulationHistory(user,'beneficiary'),
  payer:await loadSimulationHistory(user,'payer'),
  notices:await loadSimulationNotices(user)
 })));
 for(const {user,beneficiary,payer,notices} of views){
   const expectedBeneficiary=all.filter(tx=>tx.allocations.some(a=>a.beneficiary===user)).map(t=>t.transactionId).sort();
   const actualBeneficiary=beneficiary.map(t=>t.transactionId).sort();
   assert.deepEqual(actualBeneficiary,expectedBeneficiary,user+' beneficiary history');
   for(const tx of beneficiary)assert.ok(tx.allocations.every(line=>line.beneficiary===user),'Other beneficiary allocation disclosed');
   const expectedPayer=all.filter(tx=>tx.payer===user).map(t=>t.transactionId).sort();
   assert.deepEqual(payer.map(t=>t.transactionId).sort(),expectedPayer,user+' payer history');
   assert.ok(notices.every(n=>n.userId===user),'Notification recipient mismatch');
   const known=new Set(all.map(t=>t.transactionId));
   assert.ok(notices.every(n=>known.has(n.transactionId)),user+' notification has unknown transaction');
 }
});