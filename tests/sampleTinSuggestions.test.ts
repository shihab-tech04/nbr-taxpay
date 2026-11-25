import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SAMPLE_TIN_SUGGESTIONS,sampleUserNumberForTin} from '../src/data/sampleTinSuggestions';
import {lookupSampleTaxpayer} from '../src/services/sampleTaxpayerLookup';
test('30 distinct 12-digit sample TINs resolve to existing taxpayer examples',()=>{
  assert.equal(SAMPLE_TIN_SUGGESTIONS.length,30);
  assert.equal(new Set(SAMPLE_TIN_SUGGESTIONS).size,30);
  for(const tin of SAMPLE_TIN_SUGGESTIONS){
    assert.match(tin,/^\d{12}$/);
    assert.ok(sampleUserNumberForTin(tin)!>=1);
    assert.ok(lookupSampleTaxpayer(tin)?.nameEn);
  }
  assert.equal(lookupSampleTaxpayer('111111111111')?.nameEn,'User 1');
  assert.equal(lookupSampleTaxpayer('000000000000')?.nameEn,'User 10');
  assert.equal(lookupSampleTaxpayer('909000000030')?.nameEn,'Taxpayer Account 30');
});
