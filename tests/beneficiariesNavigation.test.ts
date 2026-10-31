import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROUTES} from '../src/services/routeContract';
import {collectBeneficiaryPages} from '../src/services/beneficiaries';

test('Beneficiaries stays in the signed-in taxpayer shell and is absent from guest navigation',()=>{
  const navigation=readFileSync('src/components/layout/CitizenNavigation.tsx','utf8');
  const guestLinks=navigation.slice(navigation.indexOf('const guestLinks:'),navigation.indexOf('const taxpayerLinks:'));
  const accountLinks=navigation.slice(navigation.indexOf('const accountLinks:'),navigation.indexOf('const guestServiceLinks:'));
  assert.doesNotMatch(guestLinks,/\{\s*route:\s*'beneficiaries'/);
  assert.match(accountLinks,/\{\s*route:\s*'beneficiaries'/);
  const rail=readFileSync('src/components/layout/TaxpayerReferenceRail.tsx','utf8');
  assert.match(rail,/\{\s*route:\s*'beneficiaries'/);
  const router=readFileSync('src\/App.tsx','utf8');
  assert.match(router,/privateTaxpayerRoute && !privateSampleGate/);
  assert.match(router,/taxpayerReference && !transactionRoute && <TaxpayerReferenceRail \/>/);
  const auth=readFileSync('src/components/screens/ManageAuthorization.tsx','utf8');
  assert.ok(auth.includes('Request authorization'));
  const beneficiary=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  assert.ok(ROUTES.includes('manage_authorization'));
  assert.ok(ROUTES.includes('beneficiaries'));
  const policy=readFileSync('src/services/privateRoutePolicy.ts','utf8');
  assert.match(policy,/['"]beneficiaries['"]/, 'Beneficiaries must require a signed-in taxpayer session');
  const routes=readFileSync('src/services/routeContract.ts','utf8');
  assert.match(routes,/['"]beneficiaries['"]/, 'Email sign-in must be able to return to Beneficiaries');
  const page=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  assert.doesNotMatch(page,/Sign in to manage saved beneficiaries|Sign in with your email/);
  assert.doesNotMatch(page,/canManageAuthorizations|userRole|manage_authorization|Manage taxpayer authorizations/);
  assert.doesNotMatch(page,/Saving a contact does not grant authorization|They do not grant access to tax records or authorize a payment/);
  assert.ok(page.includes('Create list'));
  assert.ok(page.includes('Search name or TIN'));
  assert.ok(page.includes('Pay Tax for Others'));
  const firstListStart=page.indexOf('!lists.length?');
  const firstListEnd=page.indexOf(':<>',firstListStart);
  const emptyListStart=page.indexOf('listPeople.length===0?');
  const emptyListEnd=page.indexOf(':filteredPeople.length===0?',emptyListStart);
  assert.ok(firstListStart>=0&&firstListEnd>firstListStart,'first-list empty state is present');
  // The empty state cannot duplicate the shared header actions.
  assert.doesNotMatch(page.slice(firstListStart,firstListEnd),/<UiButton/);
  assert.doesNotMatch(page,/\{lists\.length>0&&<div className="grid grid-cols-1/);
  assert.match(page,/Choose how to add beneficiaries/);
  assert.match(page,/Add one beneficiary/);
  assert.match(page,/Import from Excel/);
  assert.ok(emptyListStart>=0&&emptyListEnd>emptyListStart,'empty selected-list state is present');
  assert.doesNotMatch(page.slice(emptyListStart,emptyListEnd),/<UiButton/);
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

test('Beneficiaries uses shared controls without the retired two-card page structure',()=>{
  const page=readFileSync('src/components/screens/Beneficiaries.tsx','utf8');
  const shared=readFileSync('src/styles/taxpay-citizen.css','utf8');
  const taxpayer=readFileSync('src/styles/taxpay-taxpayer-reference.css','utf8');
  assert.match(shared,/\.taxpay-citizen-shell\s+\.taxpayer-account-center/);
  assert.match(shared,/\.taxpay-citizen-shell\s+\.taxpayer-page-heading/);
  assert.doesNotMatch(taxpayer,/\.taxpay-taxpayer-reference\s+\.taxpayer-page-heading/);
  assert.doesNotMatch(taxpayer,/\.taxpay-taxpayer-reference\s+\.taxpayer-account-(?:center|heading|panel)/);
  assert.ok(page.includes("import {UiButton,UiInput,UiSelect} from '../ui/Controls';"));
  assert.doesNotMatch(page,/TaxpayerPageHeading|taxpayer-account-center|taxpayer-account-panel/);
  assert.match(page,/md:hidden/);
  assert.match(page,/md:block/);
  assert.doesNotMatch(page,/taxpay-auth-(?:primary|outline)/);
  assert.doesNotMatch(taxpayer,/--reference-primary-active/);
});

test('saved-beneficiary payment action uses shared controls outside the account-only authorization shell',()=>{
  const picker=readFileSync('src/components/screens/SavedBeneficiaryPicker.tsx','utf8');
  const authorization=readFileSync('src/components/screens/ManageAuthorization.tsx','utf8');
  const taxpayer=readFileSync('src/styles/taxpay-taxpayer-reference.css','utf8');
  assert.match(picker,/import\s+\{\s*UiButton\s*\}\s+from\s+'\.\.\/ui\/Controls'/);
  assert.match(picker,/<UiButton[^>]*variant="outline"/);
  assert.doesNotMatch(picker,/taxpay-auth-outline/);
  assert.match(authorization,/className="taxpay-auth-outline"/);
  assert.match(taxpayer,/\.taxpay-taxpayer-reference\s+\.taxpay-auth-outline/);
});
