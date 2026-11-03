import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BENEFICIARY_RELATIONS, BENEFICIARY_TAGS, beneficiaryTagLabel, validBeneficiaryClassification} from '../src/services/beneficiaryTags';

test('fixed beneficiary category choices and all required family relationships',()=>{
  assert.deepEqual([...BENEFICIARY_TAGS],['clients','friends_family','others']);
  assert.deepEqual([...BENEFICIARY_RELATIONS],['father','mother','siblings','son','daughter','spouse','friends']);
  assert.equal(validBeneficiaryClassification('',null),false);
  assert.equal(validBeneficiaryClassification('friends_family',null),false);
  assert.equal(validBeneficiaryClassification('clients','father'),false);
  assert.equal(validBeneficiaryClassification('others','friends'),false);
  assert.equal(validBeneficiaryClassification('clients',null),true);
  assert.equal(validBeneficiaryClassification('others',null),true);
  for(const relation of BENEFICIARY_RELATIONS)assert.equal(validBeneficiaryClassification('friends_family',relation),true);
  assert.equal(validBeneficiaryClassification('friends_family','cousin'),false);
});
test('classifications display without assigning any fabricated tag to historical contacts',()=>{
  assert.equal(beneficiaryTagLabel('friends_family','father','en'),'Friends & family members · Father');
  assert.equal(beneficiaryTagLabel('friends_family','father','bn'),'বন্ধু ও পরিবারের সদস্য · বাবা');
  assert.equal(beneficiaryTagLabel('clients',null,'en'),'Clients');
  assert.equal(beneficiaryTagLabel(null,null,'en'),'Previously saved · No tag');
  assert.equal(beneficiaryTagLabel(null,null,'bn'),'পূর্বের তথ্য · ট্যাগ নেই');
});
