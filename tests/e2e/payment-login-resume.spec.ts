import { expect, test } from '@playwright/test';

test('account sign-in returns to the exact selected service and preserves an in-progress payment', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Assessed Demand/ }).click();
  await payment.getByRole('button', { name: 'Continue' }).click();
  await expect(payment.getByText('Assessed Demand', { exact: true }).last()).toBeVisible();

  const tin = payment.locator('#guest-tin');
  await tin.fill('123456789012');
  await payment.getByRole('button', { name: 'Continue with my account' }).click();
  const requirement = page.getByRole('alertdialog', { name: 'Sign in required' });
  await expect(requirement).toBeVisible();
  await requirement.getByRole('button', { name: 'Go to login' }).click();

  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();

  await expect(login).toHaveCount(0);
  await expect(payment).toBeVisible();
  await expect(payment.getByText('Assessed Demand', { exact: true }).last()).toBeVisible();
  await expect(tin).toHaveValue('123456789012');
  await expect(payment.getByText('Account selected. Your payment details are still here.')).toBeVisible();
  await expect(page).not.toHaveURL(/action=taxpayer_home/);
});

test('guest payment continues without a login and no account records are opened', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Source Tax Deposit/ }).click();
  await payment.getByRole('button', { name: 'Continue' }).click();
  await payment.getByRole('button', { name: 'Continue with my account' }).click();
  await page.getByRole('alertdialog', { name: 'Sign in required' })
    .getByRole('button', { name: 'Continue without login' }).click();
  await expect(payment).toBeVisible();
  await expect(payment.getByText('You can pay without signing in.')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
