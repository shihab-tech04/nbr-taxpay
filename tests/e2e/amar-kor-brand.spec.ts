import { setWorkspaceLanguage } from './workspace-language';
import { expect, test } from '@playwright/test';

test('approved Korbritto branding stays consistent across public and taxpayer shells', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/করবৃত্ত \| Korbritto/);
  await expect(page.locator('.public-home-wordmark')).toHaveAttribute('alt', 'Korbritto');
  await expect.poll(() => page.locator('.public-home-wordmark').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.public-home-brand__copy small')).toHaveCount(0);
  await expect(page.locator('.public-footer__wordmark')).toHaveAttribute('alt', 'Korbritto');
  await expect.poll(() => page.locator('.public-footer__wordmark').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await setWorkspaceLanguage(page, 'bn');
  await expect(page.locator('.public-home-wordmark')).toHaveAttribute('alt', 'করবৃত্ত');
  await expect(page.locator('.public-home-brand__copy small')).toHaveCount(0);
  await expect(page.locator('.public-footer__wordmark')).toHaveAttribute('alt', 'করবৃত্ত');

  await page.goto('/?action=office_login&lang=bn');
  const bengaliDialog = page.getByRole('dialog', { name: 'আপনার করবৃত্ত অ্যাকাউন্টে সাইন ইন করুন' });
  await expect(bengaliDialog).toBeVisible();
  await bengaliDialog.getByRole('button', { name: 'বন্ধ করুন' }).click();
  await setWorkspaceLanguage(page, 'en');
  await expect(page.locator('.public-home-wordmark')).toHaveAttribute('alt', 'Korbritto');
  await page.goto('/?action=office_login&lang=en');
  await expect(page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' })).toBeVisible();
});

test('Korbritto primary logo stays solid brand blue and 20 percent smaller across header breakpoints', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?action=landing');
  const logo = page.locator('.public-home-wordmark');
  await expect(logo).toHaveAttribute('src', /^(data:image\/svg\+xml|.*korbritto-brand-locked-)/);
  await expect(logo).toHaveCSS('width', '123px');
  await expect(logo).toHaveCSS('height', '42px');

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(logo).toHaveCSS('width', '98px');
  await expect(logo).toHaveCSS('height', '34px');
});

test('flat wordmark footer stays readable without horizontal overflow', async ({ page }) => {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/?action=landing&lang=bn');
    const footer = page.getByRole('contentinfo', { name: 'করবৃত্ত ফুটার' });
    await expect(footer.locator('.public-footer__wordmark')).toBeVisible();
    await expect(footer.getByRole('button', { name: 'পেমেন্টের অবস্থা ও রসিদ' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test('public footer is a single compact row on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?action=landing&lang=en');
  const footer = page.getByRole('contentinfo', { name: 'Korbritto footer' });
  const positions = await footer.locator('.public-footer__identity, .public-footer__navs, .public-footer__bottom').evaluateAll(
    elements => elements.map(element => element.getBoundingClientRect().top)
  );
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(20);
  const height = await footer.evaluate(element => element.getBoundingClientRect().height);
  expect(height).toBeLessThan(95);
  const links = footer.getByRole('navigation', { name: 'Footer navigation' });
  for (const duplicatedLabel of ['Home', 'User guide', 'Report']) {
    await expect(links.getByRole('button', { name: duplicatedLabel, exact: true })).toHaveCount(0);
  }
  for (const utilityLabel of ['Payment status & receipt', 'Receipts & corrections', 'Security & support']) {
    await expect(links.getByRole('button', { name: utilityLabel, exact: true })).toBeVisible();
  }
  await expect(links.getByRole('link', { name: 'NBR publications' })).toBeVisible();
});
