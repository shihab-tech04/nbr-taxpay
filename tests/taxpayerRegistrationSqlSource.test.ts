import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {USER1_FICTIONAL_TIN_PROFILE as reference} from '../src/data/user1FictionalTinProfile';
import {isWellFormedTinProfile} from '../src/contracts/taxpayerTinProfile';

const migration=readFileSync(new URL('../supabase/migrations/20261111171500_taxpay_registration_profile_sql_source.sql',import.meta.url),'utf8');
const gateway=readFileSync(new URL('../supabase/functions/taxpay-guest-beneficiaries/index.ts',import.meta.url),'utf8');
const officeGateway=readFileSync(new URL('../supabase/functions/taxpay-office-registration-profiles/index.ts',import.meta.url),'utf8');
test('User1 certificate reference and the canonical SQL seed are exactly aligned',()=>{
 assert.ok(isWellFormedTinProfile(reference));
 assert.equal(reference.tin,'577935451798');
 const match=/values \('user1','577935451798','([^']+)'::jsonb\)/.exec(migration);
 assert.ok(match,'Missing immutable User1 seed');
 const stored=JSON.parse(match[1]);
 assert.deepEqual(stored,reference);
 assert.equal(stored.taxpayerStatus,'Individual');
 assert.equal(stored.taxesCircle,'Circle-245 (Company)');
 assert.equal(stored.taxesZone,'Taxes Zone-12, Dhaka');
 assert.equal(stored.certificateLastUpdatedOn,'04 Jun 2026, 05:06:20 PM');
 assert.equal(stored.emailAddress,'email@test.com');
});
test('registration is owner-scoped, Office read-only, and demo capability checked',()=>{
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/force row level security/i);
 assert.match(migration,/sim_payment_account_bindings/);
 assert.match(migration,/taxpay_portal_admins/);
 assert.match(migration,/revoke all on public\.taxpay_taxpayer_registration_profiles from public, anon, authenticated/);
 assert.doesNotMatch(migration,/create or replace function.*security definer/is);
 assert.match(migration,/grant select on public\.taxpay_taxpayer_registration_profiles to service_role/);
 assert.match(gateway,/verified\.capability!==token/);
 assert.match(gateway,/rpc\(client,'taxpay_demo_profile_login'/);
 assert.match(gateway,/action === 'demo-registration'/);
 assert.match(officeGateway,/office\.auth\.getUser\(token\)/);
 assert.match(officeGateway,/OFFICE_ADMIN_UID/);
 assert.match(officeGateway,/OFFICE_ADMIN_EMAIL/);
 assert.match(officeGateway,/from\('taxpay_taxpayer_registration_profiles'\)/);
 assert.doesNotMatch(officeGateway,/insert\(|update\(|delete\(/);
 assert.match(officeGateway,/\.gt\('account_id',cursor\)/);
 assert.match(officeGateway,/\.limit\(PAGE_SIZE\)/);
 assert.match(officeGateway,/PROFILE_RESULT_LIMIT/);
 assert.doesNotMatch(officeGateway,/\.limit\(100\);/);

});
