import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGuestAmount, parseGuestMinorUnits, sumGuestAmounts, sumGuestMinorUnits } from '../src/services/guestAmount';

test('guest amount accepts positive BDT values with at most two decimals', () => {
  assert.equal(parseGuestAmount('1200'), 1200);
  assert.equal(parseGuestAmount('0.25'), 0.25);
  assert.equal(parseGuestAmount('1200.50'), 1200.5);
  assert.equal(parseGuestAmount('111122241212'), 111122241212);
  assert.equal(parseGuestAmount('12214124442.75'), 12214124442.75);
  assert.equal(sumGuestAmounts(['111122241212', '12214124442.75', '10.25']), 123336365665);
});

test('minor-unit arithmetic preserves exact paisa before conversion for display', () => {
  assert.equal(parseGuestMinorUnits('90071992547400.01'), 9007199254740001n);
  assert.equal(parseGuestMinorUnits('9999999999.99'), 999999999999n);
  assert.equal(sumGuestMinorUnits(['0.01', '9999999999.98']), 999999999999n);
  assert.equal(sumGuestMinorUnits(['0.01', 'bad']), null);
});

test('guest amount rejects negative, invalid, zero and unsafe-looking amounts', () => {
  for (const input of ['', '0', '0.00', '-5', '1e9', '3.001', '1,000', '90071992547410', 'NaN', 'Infinity']) {
    assert.equal(parseGuestAmount(input), null, `Expected rejection of ${input}`);
  }
  assert.equal(sumGuestAmounts(['90071992547409.91', '1']), null);
});
