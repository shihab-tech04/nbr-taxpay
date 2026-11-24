import { test } from 'node:test';
import assert from 'node:assert/strict';

import {initialActivityYear,compareActivityNewestFirst} from '../src/services/activityYearScope';

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
