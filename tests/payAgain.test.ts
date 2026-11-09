import test from 'node:test';
import assert from 'node:assert/strict';
import {copyPreviousPayment,canPayAgain,PAY_AGAIN_YEAR_OPTIONS} from '../src/services/payAgain.ts';
const old={payer:'user1',state:'SIMULATED',allocations:[
 {beneficiary:'user1',category:'OTHER_TAX_PAYMENT',assessmentYear:'2026-27',amountMinor:123456},
 {beneficiary:'user2',category:'PENALTY',assessmentYear:'2025-26',amountMinor:10005},
 {beneficiary:'user2',category:'ADVANCE_TAX',assessmentYear:'2027-28',amountMinor:223},
 {beneficiary:'user3',category:'ASSESSED_DEMAND',assessmentYear:'2026-27',amountMinor:101}]};
const people=['user1','user2','user3'],categories=['OTHER_TAX_PAYMENT','PENALTY','ADVANCE_TAX','ASSESSED_DEMAND'];
test('copies every payer/head/year combination; resets only non-current years; keeps source immutable',()=>{
 const before=JSON.stringify(old);const copy=copyPreviousPayment(old,'user1','payer',people,categories);
 assert.equal(copy.clearedYears,2);assert.equal(copy.lines.length,4);
 assert.deepEqual(copy.lines.map(l=>l.assessmentYear),['2026-27','','','2026-27']);
 assert.deepEqual(copy.lines.map(l=>l.amount),['1234.56','100.05','2.23','1.01']);
 copy.lines[0].amount='9.00';assert.equal(JSON.stringify(old),before);
});
test('requires same payer and payer-view recorded payment; refuses revoked access',()=>{
 assert.equal(canPayAgain(old,'user2','payer'),false);
 assert.equal(canPayAgain(old,'user1','beneficiary'),false);
 assert.equal(canPayAgain({...old,state:'FAILED'},'user1','payer'),false);
 assert.throws(()=>copyPreviousPayment(old,'user1','payer',['user1'],categories),/no longer available/);
});
test('blocks malformed amounts/categories and more than 20 allocations',()=>{
 assert.equal(canPayAgain({...old,allocations:Array(21).fill(old.allocations[0])},'user1','payer'),false);
 assert.throws(()=>copyPreviousPayment(old,'user1','payer',people,['PENALTY']),/category/);
 assert.throws(()=>copyPreviousPayment({...old,allocations:[{...old.allocations[0],amountMinor:0}]},'user1','payer',people,categories));
});
test('every configured historical tax year independently follows current-year rule',()=>{
 for(const y of PAY_AGAIN_YEAR_OPTIONS){
 const copy=copyPreviousPayment({...old,allocations:[{...old.allocations[0],assessmentYear:y}]},'user1','payer',people,categories);
 assert.equal(copy.lines[0].assessmentYear,y==='2026-27'?y:'');
 }
});
