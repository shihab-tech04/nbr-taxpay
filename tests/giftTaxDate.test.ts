import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validGiftDate} from '../src/services/giftTaxDate';

test('Gift Tax accepts a real past Dhaka calendar day and leap day', () => {
  assert.equal(validGiftDate('2024-02-29', '2026-11-23'), true);
  assert.equal(validGiftDate('2026-11-23', '2026-11-23'), true);
});

test('Gift Tax rejects impossible, future, malformed or timezone-shifted dates', () => {
  for (const value of ['2025-02-29','2026-02-30','2026-13-01','2026-00-01',
    '2026-11-24','2026-11-23T00:00:00Z','not-a-date','']) {
    assert.equal(validGiftDate(value, '2026-11-23'), false, value);
  }
});
