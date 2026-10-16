import { expect, test } from '@playwright/test';

test('TaxPay sign-in requires email and password; preview labels never act as credentials', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  const email = page.getByRole('textbox', { name: 'Account email address' });
  const password = page.getByLabel('Password', { exact: true });
  await expect(email).toBeEnabled();
  await expect(password).toBeEnabled();
  await expect(page.getByText(/user1[–-]user10|no password needed|example account access/i)).toHaveCount(0);

  await email.fill('user1');
  await password.fill('user1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter your account email address');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toHaveCount(0);
  expect(await page.evaluate(() => new URLSearchParams(location.search).get('demoUser'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
});

test('legacy Office login URL resolves to the public TaxPay home', async ({ page }) => {
  await page.goto('/?action=office_login');
  await expect(page.getByRole('heading', { name: 'Understand tax payments. Stay in control.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.office-auth')).toHaveCount(0);
});
