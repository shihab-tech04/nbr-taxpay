import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Regression gate: Office may inspect canonical TaxPay SQL only through an
// active verified Auth administrator; it never receives an edit policy.
test('verified portal administrator read-only Beneficiaries RLS is scoped to canonical records',()=>{
  const sql=readFileSync('supabase/migrations/20261102045900_taxpay_beneficiary_verified_admin_read.sql','utf8');
  assert.match(sql,/on public\.taxpay_beneficiary_lists for select to authenticated/);
  assert.match(sql,/on public\.taxpay_beneficiaries for select to authenticated/);
  assert.match(sql,/administrator\.user_uid = \(select auth\.uid\(\)\)/);
  assert.match(sql,/administrator\.active = true/);
  assert.match(sql,/administrator\.verified_at <= now\(\)/);
  assert.doesNotMatch(sql,/for (?:insert|update|delete) to authenticated/i);
  assert.doesNotMatch(sql,/taxpay_guest_private\.|alter policy|disable row level security/i);
});
