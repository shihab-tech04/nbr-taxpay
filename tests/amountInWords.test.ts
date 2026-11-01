import test from 'node:test';
import assert from 'node:assert/strict';
import { amountInTakaWords } from '../src/services/amountInWords';

test('whole Taka uses cheque wording with Bangladeshi crore/lakh groups', () => {
  assert.equal(amountInTakaWords(0), 'Zero Taka only');
  assert.equal(amountInTakaWords(10), 'Ten Taka only');
  assert.equal(amountInTakaWords(1250), 'One Thousand Two Hundred Fifty Taka only');
  assert.equal(amountInTakaWords(12345678), 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Taka only');
});
test('paisa is spelled correctly without floating-point artefacts', () => {
  assert.equal(amountInTakaWords(10.5), 'Ten Taka and Fifty Paisa only');
  assert.equal(amountInTakaWords(0.01), 'Zero Taka and One Paisa only');
  assert.equal(amountInTakaWords(99.99), 'Ninety Nine Taka and Ninety Nine Paisa only');
  assert.equal(amountInTakaWords(10.5, 'bn'), 'দশ টাকা এবং পঞ্চাশ পয়সা মাত্র');
  assert.equal(amountInTakaWords(10, 'bn'), 'দশ টাকা মাত্র');
});
test('invalid or incomplete totals cannot produce misleading cheque wording', () => {
  for (const value of [null, -1, Number.POSITIVE_INFINITY, NaN, 90071992547409.92]) {
    assert.equal(amountInTakaWords(value), null);
  }
});
