import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_USER_IDS, DEMO_USERS, getDemoUser } from '../src/data/demoUsers';
import { simulationUsers } from '../src/contracts/paymentSimulationContract';
import { demoUserIds } from '../src/data/demoPaymentTransactions';

test('55 preview profiles share the same published simulation identity contract', () => {
 assert.equal(DEMO_USER_IDS.length,55);
 assert.deepEqual([...simulationUsers],[...DEMO_USER_IDS]);
 assert.deepEqual([...demoUserIds],[...DEMO_USER_IDS]);
 assert.equal(new Set(DEMO_USER_IDS).size,55);
});
test('user1 identity is preserved, new fictional TINs are distinct and all IDs are bounded', () => {
 const profiles=DEMO_USER_IDS.map(id=>getDemoUser(id));
 assert.ok(profiles.every(Boolean));
 assert.equal(new Set(profiles.map(p=>p?.tin)).size,55);
 for(const profile of profiles)assert.match(profile!.tin,/^[0-9]{13}$/);
 assert.equal(DEMO_USERS.user1.nameEn,'Md. Arif Rahman');
 assert.equal(DEMO_USERS.user55.id,'user55');
 for(const invalid of ['user0','user56','admin'])assert.equal(getDemoUser(invalid),null);
});
