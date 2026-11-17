import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createBeneficiaryAutoRefreshGate} from '../src/services/beneficiaryAutoRefresh';

test('focus plus visibility resume shares one beneficiary read', () => {
  const gate = createBeneficiaryAutoRefreshGate(1250);
  assert.equal(gate.begin(1000), true);
  assert.equal(gate.begin(1001), false, 'Do not duplicate an in-flight read');
  gate.finish();
  assert.equal(gate.begin(1010), false, 'Do not repeat immediate focus/visibility events');
  assert.equal(gate.begin(2250), true, 'Allow a subsequent genuine focus refresh');
  gate.finish();
});

test('failed reads release the guard without treating stale data as current', () => {
  const gate = createBeneficiaryAutoRefreshGate(100);
  assert.equal(gate.begin(0), true);
  gate.finish();
  assert.equal(gate.begin(100), true);
  gate.finish();
  assert.equal(gate.begin(Number.NaN), false);
});

test('saved picker ignores list and TIN callbacks from a previous owner session', () => {
  const picker=readFileSync('src/components/screens/SavedBeneficiaryPicker.tsx','utf8');
  assert.match(picker,/ownerScopeRef\.current=ownerScope/);
  assert.equal((picker.match(/if\(cancelled\|\|ownerScopeRef\.current!==ownerScope\)return;/g)||[]).length,2);
  assert.match(picker,/finally\(\(\)=>\{if\(!cancelled&&ownerScopeRef\.current===ownerScope\)setLoading\(false\);\}\)/);
  assert.match(picker,/onAvailableTins\(Array\.from\(new Set\(result\.people/);
});


test('payment picker has no manual restore path and refreshes the account address book across browsers', () => {
  const picker=readFileSync('src/components/screens/SavedBeneficiaryPicker.tsx','utf8');
  assert.doesNotMatch(picker,/Restore saved lists|restoreSavedLists|recoverGuestBeneficiariesToProfile|recoverLegacyGuestBeneficiariesToPreview/);
  assert.match(picker,/loadBeneficiaries\(user\?\.id\?\?null,\{forceFresh:true\}\)/);
  assert.match(picker,/window\.addEventListener\('focus',refreshVisible\)/);
  assert.match(picker,/window\.addEventListener\('storage',refreshStorage\)/);
  assert.match(picker,/window\.setInterval\(refreshVisible,30000\)/);
  assert.match(picker,/window\.clearInterval\(interval\)/);
  assert.match(picker,/if\(renderOwnerScope!==ownerScope\)\{setLists\(\[\]\)/);
  assert.match(picker,/previous\.filter\(id=>existing\.has\(id\)\)/);
  assert.match(picker,/return ownerChanged\s*\?\s*containingSelection/);
});


test('beneficiary profile page refreshes from server without a restore control', () => {
  const page=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  assert.match(page,/loadBeneficiaries\(owner,\{forceFresh:true\}\)/);
  assert.equal((page.match(/loadBeneficiaries\(owner,\{forceFresh:true\}\)/g)||[]).length,3);
  assert.match(page,/window\.setInterval\(refresh,30000\)/);
  assert.match(page,/window\.addEventListener\('storage',refresh\)/);
  assert.match(page,/window\.clearInterval\(interval\)/);
  assert.match(page,/createBeneficiaryAutoRefreshGate\(\)/);
  assert.doesNotMatch(page,/Restore saved lists|restoreSavedLists/);
});
