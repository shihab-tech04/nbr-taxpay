import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTH_WINDOW_MS, approveDemoAuthorization, declineDemoAuthorization,
  effectiveAuthorizationStatus, requestDemoAuthorization, revokeDemoAuthorization,
  userIdForDemoTin,
} from '../src/services/demoAuthorizations';

const NOW = 1_800_000_000_000;

test('test user TINs map one-to-one, including the tenth account', () => {
  assert.equal(userIdForDemoTin('111111111111'), 'user1');
  assert.equal(userIdForDemoTin('222222222222'), 'user2');
  assert.equal(userIdForDemoTin('101010101010'), 'user10');
  assert.equal(userIdForDemoTin('1111111111111'), null);
  assert.equal(userIdForDemoTin('123456789012'), null);
});

test('payer requests; only target taxpayer can approve with the one-time code', () => {
  const pending = requestDemoAuthorization([], 'user1', 'user2', '483920', NOW, 'request-1');
  assert.equal(effectiveAuthorizationStatus(pending[0], NOW), 'PENDING');
  assert.throws(() => approveDemoAuthorization(pending, 'user1', 'request-1', '483920', NOW), /no longer available/);
  const approved = approveDemoAuthorization(pending, 'user2', 'request-1', '483920', NOW + 1000);
  assert.equal(effectiveAuthorizationStatus(approved[0], NOW + 1000), 'ACTIVE');
  assert.equal(approved[0].activeUntil, NOW + 1000 + AUTH_WINDOW_MS);
  assert.equal(effectiveAuthorizationStatus(approved[0], NOW + 1000 + AUTH_WINDOW_MS), 'EXPIRED');
  assert.throws(() => requestDemoAuthorization(approved, 'user1', 'user2', '123456', NOW + 1100), /already exists/);
  assert.equal(requestDemoAuthorization(approved, 'user1', 'user2', '123456', NOW + AUTH_WINDOW_MS + 2000, 'request-2').length, 2);
});

test('wrong OTP, denied request, expired request and self authorization fail closed', () => {
  const initial = requestDemoAuthorization([], 'user3', 'user4', '294673', NOW, 'request-3');
  assert.throws(() => requestDemoAuthorization(initial, 'user3', 'user3', '123456', NOW), /yourself/);
  assert.throws(() => approveDemoAuthorization(initial, 'user4', 'request-3', '294673', NOW + AUTH_WINDOW_MS), /no longer available/);
  const once = approveDemoAuthorization(initial, 'user4', 'request-3', '111111', NOW + 1);
  const twice = approveDemoAuthorization(once, 'user4', 'request-3', '222222', NOW + 2);
  const denied = approveDemoAuthorization(twice, 'user4', 'request-3', '333333', NOW + 3);
  assert.equal(effectiveAuthorizationStatus(denied[0], NOW + 3), 'DENIED');
  assert.throws(() => approveDemoAuthorization(denied, 'user4', 'request-3', '294673', NOW + 4), /no longer available/);
});

test('taxpayer can revoke or decline, and payer cannot revoke taxpayer consent', () => {
  const pending = requestDemoAuthorization([], 'user1', 'user2', '873294', NOW, 'request-4');
  const declined = declineDemoAuthorization(pending, 'user2', 'request-4', NOW + 1);
  assert.equal(declined[0].status, 'DENIED');
  assert.throws(() => declineDemoAuthorization(pending, 'user1', 'request-4', NOW + 1), /Only the taxpayer/);
  const active = approveDemoAuthorization(pending, 'user2', 'request-4', '873294', NOW + 2);
  assert.throws(() => revokeDemoAuthorization(active, 'user1', 'request-4', NOW + 3), /Only the authorizing taxpayer/);
  const revoked = revokeDemoAuthorization(active, 'user2', 'request-4', NOW + 3);
  assert.equal(effectiveAuthorizationStatus(revoked[0], NOW + 4), 'REVOKED');
});
