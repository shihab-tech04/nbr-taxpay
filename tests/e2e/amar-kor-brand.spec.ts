import { expect, test } from '@playwright/test';

test('approved Amar Kor branding stays consistent across public and taxpayer shells', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/আমার কর \| Amar Kor/);
  await expect(page.locator('.public-home-wordmark')).toHaveAttribute('alt', 'Amar Kor');
  await expect.poll(() => page.locator('.public-home-wordmark').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.public-home-brand__copy small')).toHaveText('Your tax, your records');
  await expect(page.locator('.public-footer__wordmark')).toHaveAttribute('alt', 'Amar Kor');
  await expect.poll(() => page.locator('.public-footer__wordmark').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.locator('.public-home-wordmark')).toHaveAttribute('alt', 'আমার কর');
  await expect(page.locator('.public-home-brand__copy small')).toHaveText('আপনার কর, আপনার হিসাব');
  await expect(page.locator('.public-footer__wordmark')).toHaveAttribute('alt', 'আমার কর');

  await page.goto('/?action=office_login&lang=bn');
  const bengaliDialog = page.getByRole('dialog', { name: 'আপনার আমার কর অ্যাকাউন্টে সাইন ইন করুন' });
  await expect(bengaliDialog).toBeVisible();
  await bengaliDialog.getByRole('button', { name: 'বন্ধ করুন' }).click();
  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.locator('.public-home-wordmark')).toHaveAttribute('alt', 'Amar Kor');
  await page.goto('/?action=office_login&lang=en');
  await expect(page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' })).toBeVisible();
});

test('flat wordmark footer stays readable without horizontal overflow', async ({ page }) => {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/?action=landing&lang=bn');
    const footer = page.getByRole('contentinfo', { name: 'আমার কর ফুটার' });
    await expect(footer.locator('.public-footer__wordmark')).toBeVisible();
    await expect(footer.getByRole('button', { name: 'ব্যবহার নির্দেশিকা' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
