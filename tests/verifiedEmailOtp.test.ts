import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEmailOneTimeCode,isCompleteEmailOneTimeCode} from '../src/services/verifiedEmailOtp';

test('OTP input normalization keeps only six ASCII digits',()=>{
  assert.equal(normalizeEmailOneTimeCode(' 12 34-56 '),'123456');
  assert.equal(normalizeEmailOneTimeCode('123456789'),'123456');
  assert.equal(normalizeEmailOneTimeCode('ABCD'),'');
});
test('real OTP must be complete before calling Supabase Auth',()=>{
  for(const bad of ['','12345','1234567','123a56','11111 ']){
    assert.equal(isCompleteEmailOneTimeCode(bad),false);
  }
  assert.equal(isCompleteEmailOneTimeCode('009876'),true);
});
