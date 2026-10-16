import { expect, test } from '@playwright/test';

test('approved Amar Kor branding stays consistent across public and taxpayer shells', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/আমার কর \| Amar Kor/);
  await expect(page.locator('.public-home-brand__copy strong')).toHaveText('Amar Kor');
  await expect(page.locator('.public-home-brand__copy small')).toHaveText('Your tax, your records');
  await expect(page.locator('.public-footer__identity strong')).toHaveText('Amar Kor');

  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.locator('.public-home-brand__copy strong')).toHaveText('আমার কর');
  await expect(page.locator('.public-home-brand__copy small')).toHaveText('আপনার কর, আপনার হিসাব');
  await expect(page.locator('.public-footer__identity strong')).toHaveText('আমার কর');

  await page.goto('/?action=office_login&lang=bn');
  await expect(page.locator('.login-form-brand-title')).toHaveText('আমার কর');
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.locator('.login-form-brand-title')).toHaveText('Amar Kor');
});
