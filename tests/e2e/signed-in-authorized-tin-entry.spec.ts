import { test, expect } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

const backend = '**/functions/v1/demo-story1-taxpay/authorizations?actor=user1';
const confirmed = {
  id: 'f938b463-fc7b-474d-9949-b5ab3917ae22',
  payerId: 'user1',
  taxpayerId: 'user2',
  status: 'ACTIVE',
  requestedAt: Date.now() - 86_400_000,
  codeExpiresAt: Date.now() - 3_600_000,
  consentCode: null,
  confirmedAt: Date.now() - 60_000,
  activeUntil: null,
  attempts: 0,
  revokedAt: null
};
async function openOtherTax(page: import('@playwright/test').Page) {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await login.getByLabel('Password', { exact: true }).fill('user1');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'OTHER_TAX_PAYMENT', 'OTHER');
  return payment;
}
test('a signed-in payer can enter a recognized 13-digit demo TIN without truncation and sees authorization count', async ({ page }) => {
  await page.route(backend, route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [confirmed], simulationOnly: true }) }));
  const payment = await openOtherTax(page);
  const beneficiary = payment.locator('#guest-tin');
  await beneficiary.fill('2222222222222');
  await expect(beneficiary).toHaveValue('2222222222222');
  await expect(payment.getByTestId('authorized-taxpayer-choices')).toContainText('Active authorizations: 1');
  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.getByText('Step 2 of 4')).toBeVisible();
});
test('13-digit demo beneficiaries are accepted in added rows while unapproved additional taxpayers cannot proceed', async ({ page }) => {
  await page.route(backend, route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [confirmed], simulationOnly: true }) }));
  const payment = await openOtherTax(page);
  await payment.locator('#guest-tin').fill('2222222222222');
  await payment.getByRole('button', { name: 'Add another taxpayer' }).click();
  const extra = payment.locator('input[id^="other-tax-tin-"]');
  await extra.fill('3333333333333');
  await expect(extra).toHaveValue('3333333333333');
  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.getByText(/No active authorization for this taxpayer/)).toBeVisible();
  await expect(payment.getByText('Step 2 of 4')).toHaveCount(0);
});
test('authorization service error must not expose a request action or allow a facilitated payment', async ({ page }) => {
  await page.route(backend, route => route.fulfill({ status: 503, contentType: 'application/json',
    body: JSON.stringify({ success: false, error: 'AUTHORIZATION_READ_FAILED' }) }));
  const payment = await openOtherTax(page);
  await payment.locator('#guest-tin').fill('2222222222222');
  await expect(payment.getByRole('button', { name: 'Request authorization for this TIN' })).toHaveCount(0);
  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.getByText(/Authorization could not be verified/)).toBeVisible();
  await expect(payment.getByText('Step 2 of 4')).toHaveCount(0);
});
