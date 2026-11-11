import test from 'node:test';
import assert from 'node:assert/strict';
import {fitsCombinedAllocationCapacity, MAX_COMBINED_ALLOCATIONS} from '../src/services/otherTaxCombinedPayment';

test('combined allocation capacity matches existing SQL hard limit',()=>{
  assert.equal(MAX_COMBINED_ALLOCATIONS,256);
  assert.equal(fitsCombinedAllocationCapacity(0),true);
  assert.equal(fitsCombinedAllocationCapacity(1),true);
  assert.equal(fitsCombinedAllocationCapacity(21),true);
  assert.equal(fitsCombinedAllocationCapacity(256),true);
  assert.equal(fitsCombinedAllocationCapacity(257),false);
  assert.equal(fitsCombinedAllocationCapacity(334),false);
  for (const invalid of [-1,1.1,Infinity,NaN]) assert.equal(fitsCombinedAllocationCapacity(invalid),false);
});
