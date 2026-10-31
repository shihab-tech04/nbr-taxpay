import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPrivateTaxpayerRoute, requiresTaxpayerSignIn } from '../src/services/privateRoutePolicy';

test('a published visitor must sign in for every private taxpayer route', () => {
  for (const route of ['taxpayer_home', 'dashboard', 'wizard', 'history', 'payment_details', 'ledger',
    'journey', 'certificates', 'corrections', 'notifications', 'account_notifications',
    'account_profile', 'account_settings', 'beneficiaries', 'services']) {
    assert.equal(isPrivateTaxpayerRoute(route, false), true, route);
    for (const role of ['GUEST', 'TAXPAYER_INDIVIDUAL', 'TAXPAYER_CORPORATE', 'WITHHOLDING_AGENT'] as const) {
      assert.equal(requiresTaxpayerSignIn(route, false, false, false, role), true,
        `${route} cannot be entered in production using ${role}`);
    }
  }
});

test('Beneficiaries requires sign-in just like neighboring account-only routes', () => {
  assert.equal(isPrivateTaxpayerRoute('beneficiaries', false), true);
  assert.equal(requiresTaxpayerSignIn('beneficiaries', false, false, false, 'GUEST'), true);
  assert.equal(requiresTaxpayerSignIn('beneficiaries', false, true, false, 'GUEST'), false);
  assert.equal(requiresTaxpayerSignIn('beneficiaries', false, false, true, 'TAXPAYER_INDIVIDUAL'), false);
  assert.equal(isPrivateTaxpayerRoute('manage_authorization', false), true);
  assert.equal(requiresTaxpayerSignIn('manage_authorization', false, false, false, 'GUEST'), true);
});

test('local sample review remains testable, while authorized accounts may enter the shell', () => {
  assert.equal(requiresTaxpayerSignIn('taxpayer_home', false, false, true, 'TAXPAYER_INDIVIDUAL'), false);
  assert.equal(requiresTaxpayerSignIn('taxpayer_home', false, false, true, 'GUEST'), true);
  assert.equal(requiresTaxpayerSignIn('taxpayer_home', false, true, false, 'GUEST'), false);
  for (const route of ['notifications', 'account_notifications', 'account_profile', 'account_settings']) {
    assert.equal(requiresTaxpayerSignIn(route, false, false, true, 'GUEST'), false,
      `${route} retains the local signed-out empty state`);
  }
  assert.equal(requiresTaxpayerSignIn('landing', false, false, false, 'GUEST'), false);
  assert.equal(requiresTaxpayerSignIn('secure_workspace', false, false, false, 'GUEST'), false);
  assert.equal(requiresTaxpayerSignIn('payment_details', true, false, false, 'GUEST'), false);
});
