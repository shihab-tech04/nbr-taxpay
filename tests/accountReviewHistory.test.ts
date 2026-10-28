import test from 'node:test';
import assert from 'node:assert/strict';
import {formattedReviewAmount,safeReviewStatus} from '../src/services/accountReviewHistory';

test('bigint-paisa request amount is exact, and never treated as receipt',()=>{
  assert.equal(formattedReviewAmount('12345678901','en'),'৳ 123,456,789.01');
  assert.equal(formattedReviewAmount('1','en'),'৳ 0.01');
});
test('invalid financial inputs fail closed',()=>{
  for(const value of ['-100','10.009','abc',0,Number.NaN,'9223372036854775808']){
    assert.throws(()=>formattedReviewAmount(value,'en'));
  }
});
test('unknown review status is never called approved or paid',()=>{
  assert.equal(safeReviewStatus('FINANCIALLY_CREDITED'),'UNVERIFIED');
  assert.equal(safeReviewStatus('SUBMITTED_FOR_REVIEW'),'SUBMITTED_FOR_REVIEW');
});
