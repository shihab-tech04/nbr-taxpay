import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROUTES} from '../src/services/routeContract';

test('beneficiaries replace Authorization in desktop and mobile account navigation without deleting its protected route',()=>{
  for (const path of ['src/components/layout/CitizenNavigation.tsx','src/components/layout/TaxpayerReferenceRail.tsx']) {
    const text=readFileSync(path,'utf8');
    assert.match(text,/\{\s*route:\s*'beneficiaries'/,path);
    assert.doesNotMatch(text,/\{\s*route:\s*'manage_authorization'/,path);
  }
  const auth=readFileSync('src/components/screens/ManageAuthorization.tsx','utf8');
  assert.ok(auth.includes('Request authorization'));
  const beneficiary=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  assert.ok(beneficiary.includes("navigate('manage_authorization')"),'contextual access remains');
  assert.ok(ROUTES.includes('manage_authorization'));
  assert.ok(ROUTES.includes('beneficiaries'));
});
