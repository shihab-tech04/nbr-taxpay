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
// The original exact 9-transaction/16-allocation/10-user assertions moved intact
// to tests/integration/simulationGraphIntegrity.mjs under disposable Postgres.
test('hosted legacy anonymous graph cannot disclose protected transaction data',async()=>{
 await assert.rejects(()=>loadSimulationHistory(null,'all'),/permission denied|not authorized|forbidden|unauthorized/i);
 await assert.rejects(()=>loadSimulationHistory('user1','payer'),/permission denied|not authorized|forbidden|unauthorized/i);
});
test('hosted legacy anonymous notices cannot disclose bound profile activity',async()=>{
 await assert.rejects(()=>loadSimulationNotices('user1'),/permission denied|not authorized|forbidden|unauthorized/i);
});
