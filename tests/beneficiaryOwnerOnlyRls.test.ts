import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync('supabase/migrations/20261105150000_taxpay_beneficiary_owner_only.sql','utf8');
test('later migration removes administrator cross-account read policies on BOTH private tables',()=>{
  assert.match(sql,/drop policy if exists beneficiary_lists_select_verified_portal_admin\s+on public\.taxpay_beneficiary_lists/i);
  assert.match(sql,/drop policy if exists beneficiaries_select_verified_portal_admin\s+on public\.taxpay_beneficiaries/i);
  assert.match(sql,/alter table public\.taxpay_beneficiary_lists enable row level security/i);
  assert.match(sql,/alter table public\.taxpay_beneficiaries enable row level security/i);
  assert.doesNotMatch(sql,/(?:drop policy if exists )?(?:beneficiary_lists|beneficiaries)_(?:select|insert|update|delete)_own\b/i);
  assert.doesNotMatch(sql,/disable row level security|revoke (?:select|insert|update|delete) on|truncate |drop table /i);
});
test('original owner policies remain intact and do not delegate to administrator',()=>{
  const prior=readFileSync('supabase/migrations/20261030090000_taxpay_private_beneficiary_lists.sql','utf8');
  assert.match(prior,/beneficiary_lists_select_own/);
  assert.match(prior,/beneficiaries_select_own/);
  assert.match(prior,/owner_uid\s*=\s*\(select auth\.uid\(\)\)/i);
});
