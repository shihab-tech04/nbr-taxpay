import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordedPaymentCategoryLabel} from '../src/services/recordedPaymentCategoryLabel';
import {simulationCategories,simulationCategoryLabels} from '../src/contracts/paymentSimulationContract';

test('recorded history labels keep the composer contract and support Gift/Travel Tax',()=>{
  for(const lang of ['en','bn'] as const){
    for(const category of simulationCategories)
      assert.equal(recordedPaymentCategoryLabel(category,lang),simulationCategoryLabels[category][lang]);
    assert.equal(recordedPaymentCategoryLabel('GIFT_TAX',lang),lang==='en'?'Gift Tax':'দানকর');
    assert.equal(recordedPaymentCategoryLabel('TRAVEL_TAX',lang),lang==='en'?'Travel Tax':'ভ্রমণ কর');
    for(const value of ['UNRECOGNIZED','__proto__','constructor',null,undefined,42])
      assert.equal(recordedPaymentCategoryLabel(value,lang),lang==='en'?'Payment type unavailable':'কর ধরন পাওয়া যায়নি');
  }
  assert.equal(simulationCategories.length,7);
  assert.equal(simulationCategories.some(category=>String(category)==='GIFT_TAX'||String(category)==='TRAVEL_TAX'),false);
});
