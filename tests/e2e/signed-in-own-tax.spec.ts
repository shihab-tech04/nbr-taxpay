import { expect, test } from '@playwright/test';

test('signed-in taxpayer skips the second login breakpoint and sees a read-only own-tax identity', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);

  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.getByRole('button', { name: /Advance Tax/ }).click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.getByRole('heading', { name: 'How would you like to continue?' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' })).toHaveCount(0);
  await payment.getByRole('radio', { name: 'My own tax' }).check();
  await expect(payment.getByRole('radio', { name: 'My own tax' })).toBeChecked();
  await expect(payment.locator('#guest-taxpayer-name')).toHaveAttribute('readonly');
  await expect(payment.locator('#guest-tin')).toHaveAttribute('readonly');
  await expect(payment.getByText(/no verified e-TIN link/i)).toBeVisible();

  await payment.getByRole('radio', { name: "Someone else's tax" }).check();
  await expect(payment.locator('#guest-tin')).not.toHaveAttribute('readonly');
  await expect(payment.locator('#guest-taxpayer-name')).toHaveCount(0);
  await payment.locator('#guest-tin').fill('123456789012');
  await expect(payment.locator('#guest-tin')).toHaveValue('123456789012');
});
