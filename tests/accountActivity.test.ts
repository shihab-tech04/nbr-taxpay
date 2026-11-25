import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('account activity migration matches the hosted owner-only table contract',()=>{
 const sql=readFileSync('supabase/migrations/20261105163812_taxpay_private_account_activity_20261105.sql','utf8');
 assert.match(sql,/owner_uid uuid not null references auth\.users\(id\)/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/force row level security/);
 assert.match(sql,/for select to authenticated\s+using \(owner_uid=\(select auth\.uid\(\)\)\)/);
 assert.match(sql,/for insert to authenticated\s+with check \(owner_uid=\(select auth\.uid\(\)\)\)/);
 assert.doesNotMatch(sql,/grant .*update|grant .*delete/i);
 assert.doesNotMatch(sql,/PAYMENT_CONFIRMED|TREASURY_SETTLED|TAX_CREDIT/);
});

test('activity writes and reads require the current owner and allow only nonfinancial events',()=>{
 const service=readFileSync('src/services/accountActivity.ts','utf8');
 assert.match(service,/data\.user\?\.id!==ownerUid/);
 assert.match(service,/\.eq\('owner_uid',ownerUid\)/);
 assert.match(service,/const allowedTypes/);
 assert.match(service,/\.select\('id,owner_uid,event_type,route,occurred_at'\)/);
 assert.doesNotMatch(service,/localStorage|sessionStorage/);
 assert.doesNotMatch(service,/payment_amount|tin:|display_name:/i);
});

test('navigation, language, beneficiary list, payment start and profile save use the account journal',()=>{
 const state=readFileSync('src/services/taxState.tsx','utf8');
 const profile=readFileSync('src/components/screens/AccountCenter.tsx','utf8');
 const beneficiaries=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
 const payment=readFileSync('src/components/screens/PaymentServiceChoiceDialog.tsx','utf8');
 assert.match(state,/recordAccountActivity\(accountUser\.id,'PAGE_OPENED',route\)/);
 assert.match(state,/recordAccountActivity\(accountUser\.id,'LANGUAGE_CHANGED',lang\)/);
 assert.match(beneficiaries,/recordAccountActivity\(owner,'BENEFICIARY_LIST_SELECTED','beneficiaries'\)/);
 assert.match(payment,/recordAccountActivity\(verifiedUser\.id,'PAYMENT_STARTED','wizard'\)/);
 assert.match(profile,/recordAccountActivity\(requestUid,'PROFILE_SAVED','account_settings'\)/);
 assert.match(profile,/if \(!isCurrentUid\(requestUid\)\) return;/);
 assert.match(profile,/<AccountRecentActivity ownerUid=\{user\.id\} language=\{language\}/);
});

test('activity presentation localizes saved route and language values',()=>{
 const screen=readFileSync('src/components/screens/AccountRecentActivity.tsx','utf8');
 assert.match(screen,/account_settings:\{en:'Profile settings',bn:'প্রোফাইল সেটিংস'\}/);
 assert.match(screen,/bn:\{en:'Bangla',bn:'বাংলা'\}/);
 assert.match(screen,/beneficiaries:\{en:'Beneficiaries',bn:'উপকারভোগী'\}/);
 assert.doesNotMatch(screen,/row\.route\.replaceAll/);
});

test('M02 F-017 sign-out rechecks Auth owner after asynchronous settings flush and prevents stale account navigation',()=>{
 const identity=readFileSync('src/services/accountIdentity.ts','utf8');
 const account=readFileSync('src/components/screens/AccountCenter.tsx','utf8');
 assert.match(identity,/const signingOutUid=current\.user\?\.id\?\?null/);
 assert.match(identity,/flushAccountViewPreferences\(signingOutUid\)/);
 assert.match(identity,/const \{data:beforeSignOut,error:sessionError\}=await supabase\.auth\.getUser\(\)/);
 assert.match(identity,/\(beforeSignOut\.user\?\.id\?\?null\)!==signingOutUid/);
 assert.match(identity,/supabase\.auth\.signOut\(\{scope:'local'\}\)/);
 assert.ok(identity.indexOf('beforeSignOut.user') < identity.indexOf("supabase.auth.signOut({scope:'local'})"),
   'must check the latest Auth owner before local session revocation');
 assert.match(account,/const requestUid=user\.id;\s*setBusy\(true\); setFeedback\(null\);\s*try \{\s*const result = await signOutApplicationAccount\(\)/);
 assert.match(account,/if\(currentUidRef\.current && !isCurrentUid\(requestUid\)\)return/);
 assert.match(account,/if\(!currentUidRef\.current \|\| isCurrentUid\(requestUid\)\)setBusy\(false\)/);
});
