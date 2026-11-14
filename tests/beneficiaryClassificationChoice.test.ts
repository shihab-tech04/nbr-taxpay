import assert from 'node:assert/strict';
import {test} from 'node:test';
import {beneficiaryChoiceParts,beneficiaryChoiceValue} from '../src/services/beneficiaryClassificationChoice';
import {BENEFICIARY_RELATIONS} from '../src/services/beneficiaryTags';

test('grouped category choice round-trips the original SQL tag and relationship columns',()=>{
  assert.deepEqual(beneficiaryChoiceParts('clients'),{tag:'clients',relationship:''});
  assert.deepEqual(beneficiaryChoiceParts('others'),{tag:'others',relationship:''});
  assert.equal(beneficiaryChoiceValue('clients',''),'clients');
  assert.equal(beneficiaryChoiceValue('others',''),'others');
  for(const relation of BENEFICIARY_RELATIONS){
    assert.deepEqual(beneficiaryChoiceParts('friends_family:'+relation),
      {tag:'friends_family',relationship:relation});
    assert.equal(beneficiaryChoiceValue('friends_family',relation),'friends_family:'+relation);
  }
});
test('incomplete and malformed category values fail closed',()=>{
  assert.deepEqual(beneficiaryChoiceParts('friends_family'),{tag:'',relationship:''});
  assert.deepEqual(beneficiaryChoiceParts('friends_family:alien'),{tag:'',relationship:''});
  assert.deepEqual(beneficiaryChoiceParts('none'),{tag:'',relationship:''});
  assert.equal(beneficiaryChoiceValue('friends_family',''),'');
});
