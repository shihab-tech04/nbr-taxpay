import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedOwnerRecordCount} from '../src/services/accountActivityCounts';

test('zero means a verified empty owned dataset, not a payment balance',()=>{
  assert.equal(checkedOwnerRecordCount(0),0);
  assert.equal(checkedOwnerRecordCount(9),9);
});
test('unknown or noninteger response must not be displayed as zero',()=>{
  for(const n of [null,-1,NaN,Infinity,1.5]){
    assert.throws(()=>checkedOwnerRecordCount(n));
  }
});
