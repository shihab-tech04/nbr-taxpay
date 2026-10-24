import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('account sign-in at the breakpoint retains the selected service and starts Step 1', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'OTHER_TAX_PAYMENT', 'SELF');
  const selectedService = payment.locator('.tax-service-choice__selected-service strong');
  await expect(selectedService).toHaveText('Other Tax Payment');

  await payment.getByRole('button', { name: 'Continue with my account' }).click();
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();

  await expect(login).toHaveCount(0);
  await expect(payment).toBeVisible();
  await expect(selectedService).toHaveText('Other Tax Payment');
  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.locator('.payment-form-payer-confirmation')).toContainText('My own tax');
  await expect(payment.getByRole('radio', { name: 'My own tax' })).toHaveCount(0);
  await expect(payment.locator('#guest-tin')).toBeVisible();
  await expect(payment.locator('#guest-tin')).toHaveAttribute('readonly');
  await expect(payment.getByText('Continuing with your account')).toBeVisible();
  await expect(page).not.toHaveURL(/action=taxpayer_home/);
});

test('guest payment continues directly from the breakpoint without opening account records', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'OTHER_TAX_PAYMENT', 'OTHER');
  await payment.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(payment).toBeVisible();
  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.locator('.payment-form-payer-confirmation')).toContainText("Someone else's tax");
  await expect(payment.getByRole('radio', { name: "Someone else's tax" })).toHaveCount(0);
  await expect(payment.locator('#guest-tin')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
