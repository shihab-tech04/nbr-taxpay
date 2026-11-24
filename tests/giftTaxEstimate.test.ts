import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateGiftTax, parseGiftValue} from '../src/services/giftTaxEstimate';

test('Gift Tax estimate uses Tk 20,000 annual allowance and progressive source-document brackets', () => {
  assert.equal(estimateGiftTax(0), 0);
  assert.equal(estimateGiftTax(20000), 0);
  assert.equal(estimateGiftTax(20001), 0.05);
  assert.equal(estimateGiftTax(520000), 25000);
  assert.equal(estimateGiftTax(1520000), 125000);
  assert.equal(estimateGiftTax(2520000), 275000);
  assert.equal(estimateGiftTax(3520000), 425000);
  assert.equal(estimateGiftTax(4520000), 625000);
  assert.equal(estimateGiftTax(2500000), 272000);
});

test('Gift Tax amount input rejects fractional paisa, negatives and unsafe amounts', () => {
  assert.equal(parseGiftValue('2,500,000.50'), 2500000.5);
  for (const input of ['', '-1', '0', 'NaN', '1.001', '10abc', '90071992547409999']) {
    assert.equal(parseGiftValue(input), null, input);
  }
  assert.equal(estimateGiftTax(Number.POSITIVE_INFINITY), null);
  assert.equal(estimateGiftTax(-1), null);
});
