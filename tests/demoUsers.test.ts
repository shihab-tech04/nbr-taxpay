import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_USERS, getDemoUser } from '../src/data/demoUsers';

test('ten explicitly identified synthetic scenarios remain distinct and non-authorizing', () => {
 assert.equal(Object.keys(DEMO_USERS).length,10);
 for(let i=1;i<=10;i++){
  const user=getDemoUser('user'+i);
  assert.ok(user);
  assert.equal(user.id,'user'+i);
  assert.ok(user.nameEn && user.nameBn && user.focusEn && user.focusBn);
  assert.match(user.tin, /^\d{13}$/);
  assert.equal(user.taxCircle, `circle-${i}`);
 }
 assert.equal(getDemoUser('user1')?.role,'TAXPAYER_INDIVIDUAL');
 assert.equal(getDemoUser('user2')?.role,'TAXPAYER_CORPORATE');
 assert.equal(getDemoUser('user3')?.role,'WITHHOLDING_AGENT');
 assert.equal(getDemoUser('user1')?.tin, '1111111111111');
 assert.equal(getDemoUser('user2')?.tin, '2222222222222');
 assert.equal(getDemoUser('user3')?.tin, '3333333333333');
 assert.equal(getDemoUser('user10')?.tin, '1010101010101');
});
test('invalid IDs and crafted redirect fragments never produce a demo role', () => {
 for(const id of [null,'','user0','user11','admin','user1&action=officer_home','../user1']) assert.equal(getDemoUser(id),null);
});
