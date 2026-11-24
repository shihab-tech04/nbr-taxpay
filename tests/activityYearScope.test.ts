import { test } from 'node:test';
import assert from 'node:assert/strict';

import {initialActivityYear,compareActivityNewestFirst,allowLocalActivityExamples,selectActivitySource} from '../src/services/activityYearScope';

test('ordinary signed-in Activity includes all years; explicit filters and dashboard scope survive',()=>{
  assert.equal(initialActivityYear(null,'2025-2026',true,false),'all');
  assert.equal(initialActivityYear('2026-2027','2025-2026',true,false),'2026-2027');
  assert.equal(initialActivityYear('all','2025-2026',true,false),'all');
  assert.equal(initialActivityYear(null,'2025-2026',true,true),'2025-2026');
  assert.equal(initialActivityYear(null,'2025-2026',false,false),'2025-2026');
  assert.equal(initialActivityYear('garbage','2025-2026',true,false),'all');
});
test('latest recorded payment wins within the same calendar day',()=>{
  const older={date:'2026-11-24',occurredAt:'2026-11-24T05:40:17Z'};
  const newest={date:'2026-11-24',occurredAt:'2026-11-24T05:47:29Z'};
  const example={date:'2026-10-12'};
  assert.deepEqual([older,example,newest].sort(compareActivityNewestFirst),[newest,older,example]);
});

test('production Activity never contains hardcoded examples even with a local QA flag',()=>{
  const sql=[{id:'recorded-payment'}];
  const examples=[{id:'DEMO-PAY-01'}];
  for(const signedIn of [true,false]){
    assert.equal(allowLocalActivityExamples(false,signedIn,true),false);
    assert.deepEqual(selectActivitySource(sql,examples,false),sql);
    assert.deepEqual(selectActivitySource([],examples,false),[]);
  }
  assert.equal(allowLocalActivityExamples(true,true,false),false);
  assert.equal(allowLocalActivityExamples(true,true,true),true);
  assert.equal(allowLocalActivityExamples(true,false,false),true);
});
