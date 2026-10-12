import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { privateDraftToInput, confirmPrivateDraftUpdate, confirmPrivateDraftReadBack } from '../src/services/privateDraftResume.ts';

const validDraft = {
  id: 'synthetic-draft-1',
  purpose: 'TAX_LIABILITY_PAYMENT',
  category: 'TAX_WITH_RETURN',
  assessment_year: '2026-27',
  amount_minor: 12345,
  memo: 'Synthetic planning note',
};

test('private draft resume reconstructs BDT decimal text exactly', () => {
  assert.deepEqual(privateDraftToInput(validDraft), {
    purpose: 'TAX_LIABILITY_PAYMENT',
    category: 'TAX_WITH_RETURN',
    assessmentYear: '2026-27',
    amount: '123.45',
    memo: 'Synthetic planning note',
  });
  assert.equal(privateDraftToInput({ ...validDraft, amount_minor: 1 })?.amount, '0.01');
  assert.equal(privateDraftToInput({ ...validDraft, amount_minor: 100 })?.amount, '1.00');
});

test('private draft resume fails closed on invalid stored data', () => {
  for (const row of [
    { ...validDraft, id: '' },
    { ...validDraft, purpose: 'UNSUPPORTED' },
    { ...validDraft, category: 'UNSUPPORTED' },
    { ...validDraft, category: 'SOURCE_TAX_DEPOSIT' },
    { ...validDraft, assessment_year: 'unknown' },
    { ...validDraft, amount_minor: 0 },
    { ...validDraft, amount_minor: Number.MAX_SAFE_INTEGER + 1 },
    { ...validDraft, memo: 'x'.repeat(301) },
  ]) assert.equal(privateDraftToInput(row), null);
});

test('draft update confirmation requires exactly one matching returned owner row', () => {
  assert.equal(confirmPrivateDraftUpdate('draft-1', [{ id: 'draft-1' }]), true);
  for (const rows of [[], null, undefined, [{}], [{ id: 'other' }], [{ id: 'draft-1' }, { id: 'draft-1' }], 'draft-1']) {
    assert.equal(confirmPrivateDraftUpdate('draft-1', rows), false);
  }
});

test('draft update migration limits columns and enforces owner-only RLS', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202610110001_taxpay_draft_owner_updates.sql', import.meta.url), 'utf8');
  assert.match(sql, /GRANT UPDATE\s*\(purpose, category, assessment_year, amount_minor, memo\)\s*ON public\.taxpay_payment_drafts TO authenticated/is);
  assert.match(sql, /CREATE POLICY taxpay_drafts_update_own[\s\S]*FOR UPDATE TO authenticated[\s\S]*USING \(\(select auth\.uid\(\)\) = owner_uid\)[\s\S]*WITH CHECK \(\(select auth\.uid\(\)\) = owner_uid\)/i);
  assert.doesNotMatch(sql, /GRANT\s+UPDATE\s+ON\s+public\.taxpay_payment_drafts/i);
  assert.doesNotMatch(sql, /GRANT UPDATE\s*\([^)]*\b(owner_uid|id|created_at|record_status)\b/i);
});

test('draft write requires exact authenticated owner and verified financial read-back', () => {
  const expected = { id: 'draft-a', owner_uid: 'owner-a', purpose: 'TAX_LIABILITY_PAYMENT',
    category: 'TAX_WITH_RETURN', assessment_year: '2026-27', amount_minor: 12345, memo: 'synthetic' };
  const returned = { ...expected, record_status: 'DRAFT', created_at: '2026-10-12T00:00:00Z' };
  assert.equal(confirmPrivateDraftReadBack(expected, [returned]), true);
  for (const response of [
    null, [], [{}], [returned, returned], [ { ...returned, owner_uid: 'owner-b' } ],
    [{ ...returned, record_status: 'SETTLED' }],
    [{ ...returned, amount_minor: 12344 }],
    [{ ...returned, memo: null }],
    [{ ...returned, assessment_year: '2025-26' }],
    [{ ...returned, category: 'ADVANCE_TAX' }],
    [{ ...returned, purpose: 'WITHHOLDING_TAX_DEPOSIT' }],
  ]) assert.equal(confirmPrivateDraftReadBack(expected, response), false);
  assert.equal(confirmPrivateDraftReadBack({ ...expected, id: '' }, [returned]), false);
  assert.equal(confirmPrivateDraftReadBack({ ...expected, amount_minor: 0 }, [returned]), false);
});

test('write-readback helper cannot equate HTTP acknowledgement to persistence', () => {
  const expected = { id: 'draft-a', owner_uid: 'owner-a', purpose: 'TAX_LIABILITY_PAYMENT',
    category: 'TAX_WITH_RETURN', assessment_year: '2026-27', amount_minor: 100, memo: null };
  assert.equal(confirmPrivateDraftReadBack(expected, [{ id: 'draft-a' }]), false);
  assert.equal(confirmPrivateDraftReadBack(expected, undefined), false);
});
