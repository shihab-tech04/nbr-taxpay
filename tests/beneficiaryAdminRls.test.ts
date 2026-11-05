import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Historical migration granted admin access. The later forward-only migration
// must cancel it while preserving all owner-scoped operations.
test('beneficiary address-book access is taxpayer owner only, not a portal-admin privilege',()=>{
  const oldSql=readFileSync('supabase/migrations/20261102045900_taxpay_beneficiary_verified_admin_read.sql','utf8');
  const newSql=readFileSync('supabase/migrations/20261105150000_taxpay_beneficiary_owner_only.sql','utf8');
  assert.match(oldSql,/create policy beneficiary_lists_select_verified_portal_admin/i);
  assert.match(oldSql,/create policy beneficiaries_select_verified_portal_admin/i);
  assert.match(newSql,/drop policy if exists beneficiary_lists_select_verified_portal_admin/i);
  assert.match(newSql,/drop policy if exists beneficiaries_select_verified_portal_admin/i);
  assert.doesNotMatch(newSql,/create policy [^;]*verified_portal_admin/i);
  assert.doesNotMatch(newSql,/taxpay_guest_private\.|disable row level security/i);
});
