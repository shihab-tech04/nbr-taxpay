import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTinForUserNumber } from '../src/data/sampleTinSuggestions';
import { demoIncomeTaxTypeForTin, incomeTaxEntityTypeLabel } from '../src/services/demoIncomeTaxType';

test('requested fictional User 2 and User 3 entity classifications are preserved', () => {
  assert.equal(demoIncomeTaxTypeForTin(sampleTinForUserNumber(2)!), 'NON_COMPANY');
  assert.equal(demoIncomeTaxTypeForTin(sampleTinForUserNumber(3)!), 'COMPANY');
  assert.equal(incomeTaxEntityTypeLabel('NON_COMPANY', 'en'), 'Person other than company');
  assert.equal(incomeTaxEntityTypeLabel('COMPANY', 'en'), 'Company');
});

test('the thirty existing fictional accounts have metadata or an explicit classification gap', () => {
  for (let i = 1; i <= 30; i++) {
    const tin = sampleTinForUserNumber(i);
    assert.ok(tin);
    const type = demoIncomeTaxTypeForTin(tin!);
    if ([14, 21, 28].includes(i)) assert.equal(type, null);
    else assert.ok(type === 'NON_COMPANY' || type === 'COMPANY');
  }
});

test('TIN length or digits alone never determine legal entity classification', () => {
  assert.equal(demoIncomeTaxTypeForTin('123456789012'), null);
  assert.equal(demoIncomeTaxTypeForTin('1234567890123'), null);
});
