import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedActivityCategoryLabel} from '../src/services/activityRecordedCategory';
import {simulationCategories,simulationCategoryLabels} from '../src/contracts/paymentSimulationContract';
test('recorded payment labels cover dedicated services without widening submission categories',()=>{
  for(const c of simulationCategories)for(const l of ['en','bn'] as const)assert.equal(recordedActivityCategoryLabel(c,l),simulationCategoryLabels[c][l]);
  assert.equal(recordedActivityCategoryLabel('GIFT_TAX','en'),'Gift Tax');
  assert.equal(recordedActivityCategoryLabel('GIFT_TAX','bn'),'দানকর');
  assert.equal(recordedActivityCategoryLabel('TRAVEL_TAX','en'),'Travel Tax');
  assert.equal(recordedActivityCategoryLabel('TRAVEL_TAX','bn'),'ভ্রমণ কর');
  assert.equal(recordedActivityCategoryLabel('__proto__','en'),'Unrecognized payment category: __proto__');
  assert.equal(recordedActivityCategoryLabel(null,'en'),'Payment category unavailable');
  assert.equal((simulationCategories as readonly string[]).includes('GIFT_TAX'),false);
  assert.equal((simulationCategories as readonly string[]).includes('TRAVEL_TAX'),false);
});
