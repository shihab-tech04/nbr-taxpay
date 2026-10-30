import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROUTES} from '../src/services/routeContract';
import {collectBeneficiaryPages} from '../src/services/beneficiaries';

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

test('all account-private beneficiary rows load beyond the first 1,000 in deterministic pages',async()=>{
  const rows=Array.from({length:1205},(_,i)=>({id:String(i),tin:String(i).padStart(12,'0')}));
  const ranges:Array<[number,number]>=[];
  const actual=await collectBeneficiaryPages(async(from,to)=>{
    ranges.push([from,to]);
    return rows.slice(from,to+1);
  });
  assert.deepEqual(actual,rows);
  assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]]);
  assert.deepEqual(await collectBeneficiaryPages(async()=>[]),[]);
  await assert.rejects(collectBeneficiaryPages(async()=>[],0),/page size/);
});
