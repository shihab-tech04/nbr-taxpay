import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPrivateTaxpayerRoute, requiresTaxpayerSignIn } from '../src/services/privateRoutePolicy';

test('a published visitor must sign in for every private taxpayer route', () => {
  for (const route of ['taxpayer_home', 'dashboard', 'wizard', 'history', 'payment_details', 'ledger',
    'journey', 'certificates', 'corrections', 'notifications', 'account_notifications',
    'account_profile', 'account_settings', 'services']) {
    assert.equal(isPrivateTaxpayerRoute(route), true, route);
    for (const role of ['GUEST', 'TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'] as const) {
      assert.equal(requiresTaxpayerSignIn(route, false, false, role), true,
        `${route} cannot be entered in production using ${role}`);
    }
  }
});

test('local sample review remains testable, while authorized accounts may enter the shell', () => {
  assert.equal(requiresTaxpayerSignIn('taxpayer_home', false, true, 'TAXPAYER_INDIVIDUAL'), false);
  assert.equal(requiresTaxpayerSignIn('taxpayer_home', false, true, 'GUEST'), true);
  assert.equal(requiresTaxpayerSignIn('taxpayer_home', true, false, 'GUEST'), false);
  for (const route of ['notifications', 'account_notifications', 'account_profile', 'account_settings']) {
    assert.equal(requiresTaxpayerSignIn(route, false, true, 'GUEST'), false,
      `${route} retains the local signed-out empty state`);
  }
  assert.equal(requiresTaxpayerSignIn('landing', false, false, 'GUEST'), false);
  assert.equal(requiresTaxpayerSignIn('secure_workspace', false, false, 'GUEST'), false);
  assert.equal(requiresTaxpayerSignIn('payment_details', false, false, 'GUEST'), true);
});
