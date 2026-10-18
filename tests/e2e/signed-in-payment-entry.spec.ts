import { expect, test } from '@playwright/test';

test('an already signed-in taxpayer starts payment without a second login prompt', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);

  // Sign-in lands in the taxpayer dashboard; the payment service chooser is on Home.
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Advance Tax/ }).click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.getByText('Continuing with your account')).toBeVisible();
  await expect(payment.getByRole('heading', { name: 'How would you like to continue?' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' })).toHaveCount(0);
});
