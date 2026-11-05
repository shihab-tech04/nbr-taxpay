import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {accountActivityRoute} from '../src/services/accountRouteActivity';

test('account activity stores only a canonical route, never private URL parameters',()=>{
  assert.equal(accountActivityRoute('payment_history'),'payment_history');
  assert.equal(accountActivityRoute('beneficiaries'),'beneficiaries');
  for(const route of ['/history','?tin=123456789012','payment_details?receiptId=private','', 'a'.repeat(81)]){
    assert.throws(()=>accountActivityRoute(route));
  }
});

test('verified account writes verify current Supabase owner and confirm inserted record',()=>{
  const activity=readFileSync('src/services/accountRouteActivity.ts','utf8');
  assert.match(activity,/db\.auth\.getUser\(\)/);
  assert.match(activity,/identity\.user\?\.id !== ownerUid/);
  assert.match(activity,/\.from\('taxpay_account_activity'\)/);
  assert.match(activity,/owner_uid:ownerUid,event_type:'ROUTE_VIEW',route/);
  assert.match(activity,/\.select\('id'\)\.single\(\)/);
  assert.match(activity,/if \(error \|\| !data\?\.id\)/);
  assert.doesNotMatch(activity,/sessionStorage|localStorage|user_metadata|taxpayerTin/);
});

test('navigation is recorded only for verified identity and pending activity flushes before logout',()=>{
  const state=readFileSync('src/services/taxState.tsx','utf8');
  const identity=readFileSync('src/services/accountIdentity.ts','utf8');
  assert.match(state,/if\(checkingAccount\|\|!accountUser\?\.id\)return/);
  assert.match(state,/saveAccountRouteVisit\(accountUser\.id,currentRoute\)/);
  assert.match(identity,/await flushAccountRouteVisits\(current\.user\.id\)/);
  assert.ok(identity.indexOf('await flushAccountRouteVisits') < identity.indexOf("await supabase.auth.signOut"));
});
