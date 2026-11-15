import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_USER_IDS, DEMO_USERS, getDemoUser } from '../src/data/demoUsers';
import { simulationUsers } from '../src/contracts/paymentSimulationContract';
import { demoUserIds } from '../src/data/demoPaymentTransactions';

test('30 defined fictional profiles remain bounded inside the 55-ID Office-shared contract', () => {
 assert.equal(DEMO_USER_IDS.length,30);
 assert.equal(simulationUsers.length,55);
 assert.equal(new Set(simulationUsers).size,55);
 assert.deepEqual([...simulationUsers].slice(0,DEMO_USER_IDS.length),[...DEMO_USER_IDS]);
 assert.deepEqual([...demoUserIds],[...DEMO_USER_IDS]);
 assert.equal(new Set(DEMO_USER_IDS).size,30);
 // The larger shared type is not permission to create local accounts or TINs.
 assert.ok(simulationUsers.slice(30).every(id=>getDemoUser(id)===null));
});
test('user1 identity is preserved, new fictional TINs are distinct and all IDs are bounded', () => {
 const profiles=DEMO_USER_IDS.map(id=>getDemoUser(id));
 assert.ok(profiles.every(Boolean));
 assert.equal(new Set(profiles.map(p=>p?.tin)).size,30);
 for(const profile of profiles)assert.match(profile!.tin,/^[0-9]{13}$/);
 assert.equal(DEMO_USERS.user1.nameEn,'Md. Arif Rahman');
 assert.equal(DEMO_USERS.user30.id,'user30');
 for(const invalid of ['user0','user31','admin'])assert.equal(getDemoUser(invalid),null);
});
