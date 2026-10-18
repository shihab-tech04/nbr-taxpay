import { expect, test } from '@playwright/test';

test('account sign-in at the breakpoint retains the selected service and starts Step 1', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Assessed Demand/ }).click();
  await payment.getByRole('button', { name: 'Continue' }).click();
  const selectedService = payment.locator('.tax-service-choice__selected-service strong');
  await expect(selectedService).toHaveText('Assessed Demand');

  await payment.getByRole('button', { name: 'Continue with my account' }).click();
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();

  await expect(login).toHaveCount(0);
  await expect(payment).toBeVisible();
  await expect(selectedService).toHaveText('Assessed Demand');
  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.locator('#guest-tin')).toHaveCount(0);
  const ownTaxChoice = payment.getByRole('radio', { name: 'My own tax' });
  await expect(ownTaxChoice).not.toBeChecked();
  await ownTaxChoice.check();
  await expect(payment.locator('#guest-tin')).toBeVisible();
  await expect(payment.getByText('Continuing with your account')).toBeVisible();
  await expect(page).not.toHaveURL(/action=taxpayer_home/);
});

test('guest payment continues directly from the breakpoint without opening account records', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Source Tax Deposit/ }).click();
  await payment.getByRole('button', { name: 'Continue' }).click();
  await payment.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(payment).toBeVisible();
  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.locator('#guest-tin')).toHaveCount(0);
  const otherTaxChoice = payment.getByRole('radio', { name: 'Paying for the agent' });
  await expect(otherTaxChoice).not.toBeChecked();
  await otherTaxChoice.check();
  await expect(payment.locator('#guest-tin')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
