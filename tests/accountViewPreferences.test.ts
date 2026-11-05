import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {rememberedBeneficiaryListId,validSavedLanguage} from '../src/services/accountViewPreferences';

test('language preferences accept only EN or BN',()=>{
  assert.equal(validSavedLanguage('bn'),'bn');
  assert.equal(validSavedLanguage('en'),'en');
  assert.equal(validSavedLanguage('other'),null);
  assert.equal(validSavedLanguage(null),null);
});
test('last selected list is used only if present in the current owner-scoped list result',()=>{
  const own=[{id:'owner-a-list-1'},{id:'owner-a-list-2'}];
  assert.equal(rememberedBeneficiaryListId(own,'owner-a-list-2'),'owner-a-list-2');
  assert.equal(rememberedBeneficiaryListId(own,'owner-b-list-1'),'owner-a-list-1');
  assert.equal(rememberedBeneficiaryListId(own,null),'owner-a-list-1');
  assert.equal(rememberedBeneficiaryListId([],'owner-a-list-1'),'');
});
test('account preference writes require current Auth owner, not a URL or preview id',()=>{
  const source=readFileSync('src/services/accountViewPreferences.ts','utf8');
  assert.match(source,/readBrowserLanguage\(previewId:string\|null\):Language\|null \{\s*if\(!previewId\)return null/);
  assert.match(source,/saveBrowserLanguage\(previewId:string\|null,language:Language\):void \{\s*if\(!previewId\)return/);
  const state=readFileSync('src/services/taxState.tsx','utf8');
  const people=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  assert.match(source,/db\.auth\.getUser\(\)/);
  assert.match(source,/identity\.user\?\.id!==ownerUid/);
  assert.match(source,/db\.auth\.updateUser\(\{data:/);
  assert.match(state,/validSavedLanguage\(accountUser\.user_metadata\?\.taxpay_language\)/);
  assert.match(state,/saveAccountViewPreference\(accountUser\.id,'taxpay_language',lang\)/);
  assert.match(people,/rememberedBeneficiaryListId\(data\.lists,savedListId\)/);
  assert.match(people,/saveAccountViewPreference\(owner,'taxpay_last_beneficiary_list_id',id\)/);
  // Payment receipt and beneficiary ownership remain independent of preferences.
  assert.doesNotMatch(source,/\.from\('taxpay_beneficiar/);
  assert.doesNotMatch(source,/\.from\('taxpay_payment/);
});

test('sign-out never invalidates Auth before pending preference persistence is confirmed',()=>{
  const identity=readFileSync('src/services/accountIdentity.ts','utf8');
  const prefs=readFileSync('src/services/accountViewPreferences.ts','utf8');
  const workspace=readFileSync('src/components/screens/SecureWorkspace.tsx','utf8');
  assert.match(prefs,/unsavedPreferences=new Map/);
  assert.match(prefs,/outstanding\.set\(key,value\)/);
  assert.match(prefs,/if\(outstanding\.get\(key\)===value\)/);
  assert.match(prefs,/await saveAccountViewPreference\(ownerUid,key,value\)/);
  assert.match(identity,/if\(current\.user\)await flushAccountViewPreferences\(current\.user\.id\)/);
  assert.doesNotMatch(identity,/Promise\.race\(/);
  assert.ok(identity.indexOf('await flushAccountViewPreferences')<identity.indexOf("await supabase.auth.signOut"));
  assert.match(workspace,/await signOutApplicationAccount\(\)/);
  assert.doesNotMatch(workspace,/supabase\.auth\.signOut\(/);
});
