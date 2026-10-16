import { expect, test } from '@playwright/test';

test('TaxPay does not register an NBR Officer login route', async ({ page }) => {
  await page.goto('/?action=office_login');
  await expect(page.getByRole('heading', { name: 'Understand tax payments. Stay in control.' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.office-auth')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Account email address' })).toHaveCount(0);
});
