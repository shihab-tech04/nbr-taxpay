import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRestoredWalkInPayerTin } from '../src/services/walkInPayerTinDraft';

test('legacy saved 12-digit payer TIN resumes unchanged', () => {
  assert.equal(normalizeRestoredWalkInPayerTin('123456789012'), '123456789012');
});

test('parallel saved 13-digit payer TIN survives even through legacy draft entry', () => {
  assert.equal(normalizeRestoredWalkInPayerTin('9000000000019'), '9000000000019');
  assert.equal(normalizeRestoredWalkInPayerTin('9000 0000 0001 9'), '9000000000019');
});

test('restored payer TIN strips non-digits and never exceeds 13 digits', () => {
  assert.equal(normalizeRestoredWalkInPayerTin('12345678901234567'), '1234567890123');
  assert.equal(normalizeRestoredWalkInPayerTin(''), '');
  assert.equal(normalizeRestoredWalkInPayerTin('TIN-12 345 678 901 2'), '123456789012');
});
