import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The hosted auth/SQL acceptance job exercises data writes. This domain gate
// ensures future UI changes cannot silently bypass verification requirements.
test('browser beneficiary recovery requires current Auth UID and SQL readback',()=>{
  const service=readFileSync('src/services/beneficiaries.ts','utf8');
  const start=service.indexOf('export async function recoverGuestBeneficiariesToProfile(');
  const end=service.indexOf('export async function createBeneficiaryList(',start);
  assert.ok(start>=0&&end>start);
  const recovery=service.slice(start,end);
  assert.match(recovery,/db\.auth\.getUser\(\)/);
  assert.match(recovery,/data\.user\?\.id!==ownerUid/);
  assert.match(recovery,/await ensureOwner\(\)/);
  assert.match(recovery,/await loadBeneficiaries\(ownerUid\)/);
  assert.match(recovery,/savedTins\.has\(person\.tin\)/);
  assert.match(recovery,/destinations\.get\(guestList\.id\)/);
  assert.doesNotMatch(recovery,/removeGuest|deleteGuest|\.delete\(/);
  assert.match(service,/ignoreDuplicates:true/, 'retries must not overwrite saved names');
});

// Protect the identity boundary without reintroducing a promotional sign-in
// panel that is not part of the approved Beneficiaries layout.
test('sample beneficiaries stay browser-scoped without an unsolicited sign-in banner',()=>{
  const state=readFileSync('src/services/taxState.tsx','utf8');
  const page=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  assert.match(state,/if \(route === 'secure_workspace' && previewAccount\)/);
  assert.match(page,/const owner=user\?\.id\?\?null/);
  assert.match(page,/loadBeneficiaries\(owner\)/);
  assert.doesNotMatch(page,/owner=previewAccount|owner=demoUser|owner="user1"/);
  assert.doesNotMatch(page,/beneficiaries-account-sync|For lists across devices|Sign in with email/);
});

test('published payment picker uses the approved signed-in lists without email gate',()=>{
  const picker=readFileSync('src/components/screens/SavedBeneficiaryPicker.tsx','utf8');
  const app=readFileSync('src/App.tsx','utf8');
  const login=readFileSync('src/components/screens/TaxpayerLoginDialog.tsx','utf8');
  assert.match(picker,/loadBeneficiaries\(user\?\.id\?\?null\)/);
  assert.doesNotMatch(picker,/accountRequired|Sign in with your email/);
  assert.match(app,/previewReadOnlyRoutes\.has\(currentRoute\) \|\| currentRoute === 'beneficiaries'/);
  assert.doesNotMatch(app,/verifiedOnly/);
  assert.match(login,/id="taxpayer-login-user-id"/);
  assert.match(login,/id="taxpayer-login-password"/);
  assert.doesNotMatch(login,/supabase\.auth\.signInWithOtp|Sign in with email/);
});
