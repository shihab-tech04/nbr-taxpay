import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEMO_USER_IDS,DEMO_USERS} from '../src/data/demoUsers';
import {TAXPAYER_PROFILE_FIELD_ORDER} from '../src/contracts/taxpayerProfileFieldLayout';
import {USER1_FICTIONAL_TIN_PROFILE} from '../src/data/user1FictionalTinProfile';

const recovery=readFileSync(new URL(
 '../supabase/migrations/20261114080000_taxpay_phase1_preview_accounts_recovery.sql',import.meta.url
),'utf8');
const original30=readFileSync(new URL(
 '../supabase/migrations/20261107090000_taxpay_thirty_profiles.sql',import.meta.url
),'utf8');
const extended55=readFileSync(new URL(
 '../supabase/migrations/20261115090000_taxpay_fiftyfive_preview_profiles.sql',import.meta.url
),'utf8');

test('Phase 1 retains all 30 fictional IDs and restores public/private rows without overwriting owners',()=>{
 assert.equal(DEMO_USER_IDS.length,30);
 assert.deepEqual(DEMO_USER_IDS,Array.from({length:30},(_,i)=>'user'+(i+1)));
 assert.match(recovery,/INSERT INTO public\.sim_payment_users/);
 assert.match(recovery,/INSERT INTO taxpay_guest_private\.demo_profiles\(demo_id\)/);
 assert.match(recovery,/generate_series\(2,30\)/);
 assert.match(recovery,/INSERT INTO public\.sim_payment_users\(id,role_code\) VALUES/);
 assert.match(recovery,/First-login User7-User10 preview profiles must remain empty/);
 assert.ok('20261114080000' < '20261115090000', 'Phase 1 recovery must run before 55-account expansion');
 assert.match(recovery,/generate_series\(11,30\)/);
 assert.match(recovery,/ON CONFLICT \(id\) DO NOTHING/g);
 assert.match(recovery,/ON CONFLICT \(demo_id\) DO NOTHING/);
 for(let i=2;i<=6;i++){
   assert.match(recovery,new RegExp("\\('user"+i+"','"));
 }
 assert.match(recovery,/missing_public<>0 OR missing_private<>0 OR mismatched_sessions<>0/);
 assert.match(recovery,/BEGIN;[\s\S]*COMMIT;/);
 assert.doesNotMatch(recovery,/\bTRUNCATE\b|\bDELETE FROM\b|\bUPDATE\s+(?:public\.sim_payment_users|taxpay_guest_private\.demo_profiles)\b/i);
});

test('Phase 1 never reclassifies fictional accounts as verified taxpayers or rewrites payment history',()=>{
 for(const id of DEMO_USER_IDS){
   assert.match(DEMO_USERS[id].tin,/^[0-9]{13}$/);
   assert.notEqual(DEMO_USERS[id].tin,USER1_FICTIONAL_TIN_PROFILE.tin);
 }
 assert.doesNotMatch(recovery,/\b(auth\.users|taxpay_taxpayer_registration_profiles|sim_payment_transactions|sim_payment_allocations|story_payments|service_role|password)\b/i);
 assert.match(original30,/demo_profiles_demo_id_check/);
 assert.match(extended55,/generate_series\(31,55\)/);
 assert.ok(!recovery.includes('DROP CONSTRAINT'));
 assert.equal(new Set(TAXPAYER_PROFILE_FIELD_ORDER.map(([field])=>field)).size,24);
});
