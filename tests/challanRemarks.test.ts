import test from 'node:test';
import assert from 'node:assert/strict';
import {
  limitChallanRemarks,
  MAX_CHALLAN_REMARKS_CHARACTERS,
} from '../src/services/challanRemarks.ts';

test('challan remarks limit matches PostgreSQL Unicode character count', () => {
  const maximum = '😀'.repeat(MAX_CHALLAN_REMARKS_CHARACTERS);
  const overMaximum = maximum + '😀';

  assert.equal(Array.from(maximum).length, MAX_CHALLAN_REMARKS_CHARACTERS);
  assert.equal(maximum.length, MAX_CHALLAN_REMARKS_CHARACTERS * 2);
  assert.equal(limitChallanRemarks(maximum), maximum);
  assert.equal(limitChallanRemarks(overMaximum), maximum);
  assert.equal(Array.from(limitChallanRemarks(overMaximum)).length, MAX_CHALLAN_REMARKS_CHARACTERS);
});

test('challan remarks preserve Bengali text, line breaks and surrounding spaces', () => {
  const remarks = '  চালানের মন্তব্য\nবাংলা বিবরণ: করবর্ষ ২০২৬-২৭।  ';
  assert.equal(limitChallanRemarks(remarks), remarks);
});
