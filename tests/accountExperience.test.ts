import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {accountUiValue} from '../src/services/accountExperience';

test('only bounded display preferences are accepted as account state',()=>{
  assert.equal(accountUiValue('beneficiary_tag_filter','friends_family'),'friends_family');
  assert.equal(accountUiValue('beneficiary_relationship_filter','siblings'),'siblings');
  assert.equal(accountUiValue('payment_service','TAX_WITH_RETURN'),'TAX_WITH_RETURN');
  assert.equal(accountUiValue('payment_for_self','other'),'other');
  assert.equal(accountUiValue('last_route','beneficiaries'),'beneficiaries');
  assert.throws(()=>accountUiValue('beneficiary_tag_filter','000000000047'));
  assert.throws(()=>accountUiValue('payment_for_self','credit_approved'));
  assert.throws(()=>accountUiValue('last_route','../secret'));
});
test('User ID login uses server-confirmed Auth rather than browser-only preview in production',()=>{
  const source=readFileSync('src/components/screens/TaxpayerLoginDialog.tsx','utf8');
  const identity=readFileSync('src/services/syntheticTaxpayerIdentity.ts','utf8');
  assert.match(source,/await signInSyntheticTaxpayer\(userId,password\)/);
  assert.match(source,/sampleJourneysEnabled/);
  assert.match(identity,/auth\.signInWithPassword/);
  assert.match(identity,/taxpay_account_class/);
  assert.match(identity,/taxpay_synthetic_id/);
});
test('private interaction log and view-state are scoped to the Auth UID, never public TIN',()=>{
  const source=readFileSync('src/services/accountExperience.ts','utf8');
  const migration=readFileSync('supabase/migrations/20261105153000_taxpay_account_experience.sql','utf8');
  assert.match(source,/client\.auth\.getUser\(\)/);
  assert.match(source,/\.eq\('owner_uid',ownerUid\)/);
  assert.doesNotMatch(source,/taxpayerTin|payerTin|tax_credit|settlement/);
  assert.match(migration,/using\(owner_uid=\(select auth.uid\(\)\)\)/);
  assert.match(migration,/with check\(owner_uid=\(select auth.uid\(\)\)\)/);
});
