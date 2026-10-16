import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getSecureWorkspaceCopy,
  localizeDraftValidationError,
  SECURE_WORKSPACE_COPY,
} from '../src/services/secureWorkspaceCopy';

function assertSameKeys(english: unknown, bengali: unknown, path = 'copy') {
  assert.equal(typeof english, typeof bengali, path + ' has a different value type');
  if (english === null || typeof english !== 'object') return;
  const englishRecord = english as Record<string, unknown>;
  const bengaliRecord = bengali as Record<string, unknown>;
  assert.deepEqual(Object.keys(bengaliRecord).sort(), Object.keys(englishRecord).sort(), path + ' keys differ');
  for (const key of Object.keys(englishRecord)) {
    assertSameKeys(englishRecord[key], bengaliRecord[key], path + '.' + key);
  }
}

function assertNonEmptyStrings(value: unknown, path = 'copy') {
  if (typeof value === 'string') {
    assert.ok(value.trim(), path + ' is empty');
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assertNonEmptyStrings(child, path + '.' + key);
  }
}

test('secure workspace English and Bengali copy have matching coverage', () => {
  assertSameKeys(SECURE_WORKSPACE_COPY.en, SECURE_WORKSPACE_COPY.bn);
  assertNonEmptyStrings(SECURE_WORKSPACE_COPY.bn, 'bn');
  assert.equal(getSecureWorkspaceCopy('bn').workspaceTitle, 'নিরাপদ আমার কর ওয়ার্কস্পেস');
  assert.equal(getSecureWorkspaceCopy('en').workspaceTitle, 'Secure Amar Kor workspace');
});

test('draft validation errors use Bengali copy while English copy remains unchanged', () => {
  const errors = [
    'Withholding deposits and tax-liability categories cannot be mixed.',
    'Enter a correctly formatted assessment-year label such as 2026-27. This does not verify its legal applicability.',
    'Enter a positive BDT amount with at most two decimal places.',
    'Amount is outside the permitted draft range.',
    'Notes must be 300 characters or fewer.',
  ];
  for (const english of errors) {
    assert.equal(localizeDraftValidationError(english, 'en'), english);
    assert.notEqual(localizeDraftValidationError(english, 'bn'), english, english);
  }
  assert.equal(
    localizeDraftValidationError(errors[2], 'bn'),
    'দশমিকের পরে সর্বোচ্চ দুই অঙ্কসহ শূন্যের বেশি BDT পরিমাণ লিখুন।',
  );
  assert.equal(localizeDraftValidationError('New validation error', 'bn'), 'New validation error');
});
