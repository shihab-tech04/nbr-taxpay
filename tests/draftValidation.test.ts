import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDraft } from '../src/services/draftValidation.ts';
const valid = { purpose: 'TAX_LIABILITY_PAYMENT' as const, category: 'TAX_WITH_RETURN' as const, assessmentYear: '2026-27', amount: '1.25', memo: 'test' };
test('accepts a private liability draft and computes minor units exactly', () => {
  assert.deepEqual(validateDraft(valid), { amountMinor: 125, error: null });
});
test('withholding cannot be used under ordinary tax purpose', () => {
  assert.match(validateDraft({ ...valid, category: 'SOURCE_TAX_DEPOSIT' }).error || '', /cannot be mixed/);
});
test('normal category cannot be used under withholding purpose', () => {
  assert.ok(validateDraft({ ...valid, purpose: 'WITHHOLDING_TAX_DEPOSIT' }).error);
});
test('rejects invalid year labels, precision, zero and scientific notation', () => {
  for (const assessmentYear of ['2026-26', '2026-28', 'FY26']) assert.ok(validateDraft({ ...valid, assessmentYear }).error);
  for (const amount of ['0', '0.00', '-1', '1.000', '1e5', '01', '9999999999999', '']) assert.ok(validateDraft({ ...valid, amount }).error);
});
test('rejects oversized notes', () => {
  assert.ok(validateDraft({ ...valid, memo: 'x'.repeat(301) }).error);
});
test('withholding category is valid only for withholding purpose', () => {
  assert.equal(validateDraft({ ...valid, purpose: 'WITHHOLDING_TAX_DEPOSIT', category: 'SOURCE_TAX_DEPOSIT' }).error, null);
});
