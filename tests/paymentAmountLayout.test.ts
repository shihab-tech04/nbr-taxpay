import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { paymentAmountRowColumns } from '../src/services/paymentAmountLayout';

test('payment amounts use balanced full-width rows without an orphan field', () => {
  assert.deepEqual(paymentAmountRowColumns(0), []);
  assert.deepEqual(paymentAmountRowColumns(1), [1]);
  assert.deepEqual(paymentAmountRowColumns(2), [2, 2]);
  assert.deepEqual(paymentAmountRowColumns(3), [2, 2, 1]);
  assert.deepEqual(paymentAmountRowColumns(4), [2, 2, 2, 2]);
  assert.deepEqual(paymentAmountRowColumns(5), [2, 2, 2, 2, 1]);
  assert.deepEqual(paymentAmountRowColumns(6), [2, 2, 2, 2, 2, 2]);
  assert.deepEqual(paymentAmountRowColumns(7), [2, 2, 2, 2, 2, 2, 1]);
  assert.deepEqual(paymentAmountRowColumns(10), [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
});
