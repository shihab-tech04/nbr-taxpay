import test from 'node:test';
import assert from 'node:assert/strict';
import { USER1_PAYMENT_AMOUNT_EXAMPLES, paymentAmountSuggestionFor } from '../src/services/paymentAmountSuggestions';
import { parseGuestAmount } from '../src/services/guestAmount';

test('User1 has seven distinct stable sample suggestions with valid amounts', () => {
  assert.equal(USER1_PAYMENT_AMOUNT_EXAMPLES.length, 7);
  assert.equal(new Set(USER1_PAYMENT_AMOUNT_EXAMPLES.map(item => item.id)).size, 7);
  assert.equal(new Set(USER1_PAYMENT_AMOUNT_EXAMPLES.map(item =>
    `${item.group}:${item.headId ?? 'return'}:${item.assessmentYear}`)).size, 7);
  for (const item of USER1_PAYMENT_AMOUNT_EXAMPLES) {
    assert.ok((parseGuestAmount(item.amount) ?? 0) > 0, item.id);
    assert.deepEqual(paymentAmountSuggestionFor('user1', item.group, item.assessmentYear, item.headId), item);
  }
});

test('other users and missing accounts never receive User1 suggestion amounts', () => {
  for (const userId of ['user2', 'user3', null, undefined] as const) {
    assert.equal(paymentAmountSuggestionFor(userId, 'Advance Tax', '2026-27', 121), null);
    assert.equal(paymentAmountSuggestionFor(userId, 'Tax with Return', '2026-27'), null);
  }
});

test('Other Tax suggestions only apply to the exact head and year', () => {
  assert.equal(paymentAmountSuggestionFor('user1', 'Advance Tax', '2026-27', 121)?.amount, '4500');
  assert.equal(paymentAmountSuggestionFor('user1', 'Advance Tax', '2024-25', 121)?.amount, '3200');
  assert.equal(paymentAmountSuggestionFor('user1', 'Advance Tax', '2026-27', 122), null);
  assert.equal(paymentAmountSuggestionFor('user1', 'Advance Tax', '2026-27'), null);
  assert.equal(paymentAmountSuggestionFor('user1', 'Advance Tax', '2025-26', 121), null);
  assert.equal(paymentAmountSuggestionFor('user1', 'Penalty', '2025-26', 133)?.amount, '850');
  assert.equal(paymentAmountSuggestionFor('user1', 'Penalty', '2026-27', 133), null);
  assert.equal(paymentAmountSuggestionFor('user1', 'Others', '2026-27', 150), null);
  assert.equal(paymentAmountSuggestionFor('user1', 'Source Tax', '2026-27', 121), null);
});
