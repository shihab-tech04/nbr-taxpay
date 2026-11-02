import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getIllustrativeDashboardYear,illustrativeDashboardYears,formatIllustrativeTaka} from '../src/data/dashboardIllustrativeExample';

test('illustrative 2025-26 v11 financial figures reconcile but never stand for an account ledger',()=>{
  const y=getIllustrativeDashboardYear('2025-2026');
  assert.ok(y);
  assert.equal(y.liability,180000);
  assert.equal(y.tds,48000);
  assert.equal(y.ait,32000);
  assert.equal(y.direct,75000);
  assert.equal(y.travel,6500);
  assert.equal(y.applied,155000);
  assert.equal(y.remaining,25000);
  assert.equal(y.tds+y.ait+y.direct+y.remaining,y.liability);
  assert.equal(y.months.find(m=>m.month==='2025-09')?.tds,27000);
  assert.equal(y.months.find(m=>m.month==='2026-09')?.direct,45000);
});
test('illustrative older years reconcile; years without a real example never invent a value',()=>{
  const y24=getIllustrativeDashboardYear('2024-2025');
  const y23=getIllustrativeDashboardYear('2023-2024');
  assert.ok(y24);
  assert.ok(y23);
  assert.equal(y24.applied,115000);
  assert.equal(y24.remaining,10000);
  assert.equal(y23.applied,90000);
  assert.equal(y23.remaining,0);
  assert.deepEqual(illustrativeDashboardYears,['2025-2026','2024-2025','2023-2024']);
  assert.equal(getIllustrativeDashboardYear('2026-2027'),null);
  assert.equal(getIllustrativeDashboardYear('not-year'),null);
});
test('Bangladesh taka formatting preserves locales and rejects unsafe values',()=>{
  assert.match(formatIllustrativeTaka(155000,'en'),/^৳ 155,000$/);
  assert.match(formatIllustrativeTaka(155000,'bn'),/^৳ /);
  assert.throws(()=>formatIllustrativeTaka(-10,'en'),/Invalid/);
  assert.throws(()=>formatIllustrativeTaka(Infinity,'en'),/Invalid/);
});
