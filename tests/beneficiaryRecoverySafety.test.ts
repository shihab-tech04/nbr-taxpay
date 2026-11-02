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
