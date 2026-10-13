import test from 'node:test';
import assert from 'node:assert/strict';
import {
 loadSimulationHistory,loadSimulationNotices,submitSimulatedPayment,
 parseSimulatedAmount,formatSimulatedAmount
} from '../src/services/simulatedPaymentsApi';

test('integer taka/paisa parsing remains exact with negative/decimal boundaries',()=>{
 assert.equal(parseSimulatedAmount('100.25'),10025);
 assert.equal(parseSimulatedAmount('0.01'),1);
 assert.equal(parseSimulatedAmount('1'),100);
 assert.throws(()=>parseSimulatedAmount('-1'));
 assert.throws(()=>parseSimulatedAmount('1.234'));
 assert.throws(()=>parseSimulatedAmount('0'));
 assert.match(formatSimulatedAmount(10025),/100.25/);
});
test('hosted public sandbox no longer discloses payer or beneficiary ledgers',async()=>{
 await assert.rejects(()=>loadSimulationHistory(null,'all'),/permission denied|403|42501|HTTP 4/i);
 await assert.rejects(()=>loadSimulationHistory('user1','beneficiary'),/permission denied|403|42501|HTTP 4/i);
 await assert.rejects(()=>loadSimulationNotices('user1'),/permission denied|403|42501|HTTP 4/i);
});
test('hosted public anonymous token cannot create even fictional transactions',async()=>{
 const nonce='8bc16592-d79a-4f73-a62e-2cbb6c1e5f44';
 await assert.rejects(()=>submitSimulatedPayment('user1',[
  {beneficiary:'user1',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:100}
 ],nonce),/permission denied|403|42501|HTTP 4/i);
});
