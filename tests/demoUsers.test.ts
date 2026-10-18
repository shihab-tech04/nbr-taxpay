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
  assert.match(user.tin, /^\d{12}$/);
  assert.equal(user.taxCircle, `circle-${i}`);
 }
 assert.equal(getDemoUser('user1')?.role,'TAXPAYER_INDIVIDUAL');
 assert.equal(getDemoUser('user2')?.role,'TAXPAYER_CORPORATE');
 assert.equal(getDemoUser('user3')?.role,'WITHHOLDING_AGENT');
});
test('invalid IDs and crafted redirect fragments never produce a demo role', () => {
 for(const id of [null,'','user0','user11','admin','user1&action=officer_home','../user1']) assert.equal(getDemoUser(id),null);
});
