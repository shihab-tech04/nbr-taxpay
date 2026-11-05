import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('nonfinancial account activity SQL is isolated to verified auth.uid()',()=>{
 const sql=readFileSync('supabase/migrations/20261105222000_taxpay_private_account_activity.sql','utf8');
 assert.match(sql,/owner_uid uuid not null references auth\.users\(id\)/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/force row level security/);
 assert.match(sql,/for select to authenticated\s+using \(owner_uid=\(select auth\.uid\(\)\)\)/);
 assert.match(sql,/for insert to authenticated\s+with check \(owner_uid=\(select auth\.uid\(\)\)\)/);
 assert.doesNotMatch(sql,/grant .*update|grant .*delete/i);
 assert.doesNotMatch(sql,/PAYMENT_CONFIRMED|TREASURY_SCROLLED/);
});
test('account activity is read/write only for the verified current owner, with safe event types',()=>{
 const service=readFileSync('src/services/accountActivity.ts','utf8');
 assert.match(service,/identity\.user\?\.id!==uid/);
 assert.match(service,/\.eq\('owner_uid',uid\)/);
 assert.match(service,/\.order\('occurred_at',\{ascending:false\}\)/);
 assert.match(service,/const allowedTypes/);
 assert.doesNotMatch(service,/localStorage|sessionStorage/);
 assert.doesNotMatch(service,/payment_amount|tin:|display_name:/i);
});
test('account activity is connected to navigation, preference and profile screens',()=>{
 const state=readFileSync('src/services/taxState.tsx','utf8');
 const profile=readFileSync('src/components/screens/AccountCenter.tsx','utf8');
 const beneficiaries=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
 assert.match(state,/recordAccountActivity\(accountUser\.id,'PAGE_OPENED',route\)/);
 assert.match(state,/recordAccountActivity\(accountUser\.id,'LANGUAGE_CHANGED'/);
 assert.match(beneficiaries,/recordAccountActivity\(owner,'BENEFICIARY_LIST_SELECTED'/);
 assert.match(profile,/<AccountRecentActivity ownerUid=\{user\.id\} language=\{language\}/);
});
