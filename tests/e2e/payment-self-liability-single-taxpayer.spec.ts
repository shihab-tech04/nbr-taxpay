import { expect, test } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

// Preserve both existing entry routes: SELF always one taxpayer, OTHER may
// include additional recipients after the required TIN lookup/confirmation.
test('walk-in self is single taxpayer while facilitator can add another', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  const payment = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment, 'OTHER_TAX', 'SELF');
  const self = payment.getByTestId('other-tax-primary-taxpayer');
  await expect(self).toBeVisible();
  await self.locator('#guest-tin').fill('111111111111');
  await self.locator('.taxpayer-tin-lookup__search').click();
  await expect(self.getByRole('heading', { name: 'Taxpayer Information' })).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await expect(payment.getByTestId('other-tax-taxpayer')).toHaveCount(0);
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  const other = payment.getByTestId('other-tax-primary-taxpayer');
  await other.locator('#guest-tin').fill('111111111111');
  await other.locator('.taxpayer-tin-lookup__search').click();
  await other.getByRole('button', { name: 'Add taxpayer' }).click();
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
});

test('signed-in self has no saved beneficiary or additional taxpayer controls', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await login.getByLabel('Password', { exact: true }).fill('user1');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing&lang=en');
  const payment = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment, 'OTHER_TAX', 'SELF');
  await expect(payment.locator('#signed-in-account-taxpayer-card')).toBeVisible();
  await expect(payment.getByTestId('self-payment-add-beneficiaries')).toHaveCount(0);
  await expect(payment.getByTestId('saved-beneficiary-picker')).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
});
