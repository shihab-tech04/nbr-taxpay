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

// Guard the distinct identity models rather than assigning anonymous browser
// address-book data to whichever sample user is visible in the URL.
test('user1 sample stays browser-scoped until verified email sign-in',()=>{
  const state=readFileSync('src/services/taxState.tsx','utf8');
  const page=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  assert.match(state,/if \(route === 'secure_workspace' && previewAccount\)/);
  assert.match(page,/!owner&&previewAccount/);
  assert.match(page,/navigate\('secure_workspace',\{returnTo:'beneficiaries'\}\)/);
  assert.doesNotMatch(page,/owner=previewAccount|owner=demoUser|owner="user1"/);
});
