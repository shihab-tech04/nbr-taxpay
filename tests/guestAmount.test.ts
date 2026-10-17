import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGuestAmount } from '../src/services/guestAmount';

test('guest amount accepts positive BDT values with at most two decimals', () => {
  assert.equal(parseGuestAmount('1200'), 1200);
  assert.equal(parseGuestAmount('0.25'), 0.25);
  assert.equal(parseGuestAmount('1200.50'), 1200.5);
});

test('guest amount rejects negative, invalid, zero and unsafe-looking amounts', () => {
  for (const input of ['', '0', '0.00', '-5', '1e9', '3.001', '1,000', '10000000000', 'NaN', 'Infinity']) {
    assert.equal(parseGuestAmount(input), null, `Expected rejection of ${input}`);
  }
});
