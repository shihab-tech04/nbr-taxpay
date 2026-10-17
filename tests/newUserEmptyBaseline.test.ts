import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_USERS, getDemoUser } from '../src/data/demoUsers';

test('user7 through user10 are retained as generic first-time taxpayer identities', () => {
  for (const n of [7,8,9,10]) {
    const id = `user${n}` as keyof typeof DEMO_USERS;
    const u = getDemoUser(id);
    assert.equal(u?.id,id);
    assert.equal(u?.role,'TAXPAYER_INDIVIDUAL');
    assert.match(u?.nameEn ?? '',/^New taxpayer/);
    assert.equal(u?.focusEn,'First-time payment');
    assert.doesNotMatch(u?.focusEn ?? '',/refund|withholding|correction|reversal/i);
  }
});
test('older six taxpayer identities remain available and retain their existing scenarios', () => {
  assert.equal(Object.keys(DEMO_USERS).length,10);
  for (const n of [1,2,3,4,5,6]) {
    const u=getDemoUser(`user${n}`);
    assert.ok(u);
    assert.doesNotMatch(u.nameEn,/^New taxpayer/);
  }
});
