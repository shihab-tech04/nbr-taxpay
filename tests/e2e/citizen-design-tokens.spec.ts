import { mockPublishedBannerCms } from './mock-published-banners';
import { setWorkspaceLanguage } from './workspace-language';
import { expect, test } from '@playwright/test';

test('citizen design locks the primary blue and unified public payment entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.public-info-topic[data-taxpay-service]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.getByText('User ID')).toBeVisible();
  await expect(dialog.getByText('Password', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sign In to Pay Tax' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Walk-in Payment' })).toBeVisible();

  const shell = page.locator('.taxpay-citizen-shell');
  expect((await shell.evaluate(el => getComputedStyle(el).getPropertyValue('--citizen-primary').trim())).toLowerCase()).toBe('#2c5ead');
  expect(await shell.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Poppins');
  await dialog.getByRole('button', { name: 'Walk-in Payment' }).click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
});

test('Bangla text uses Noto Sans Bengali in the new payer-first service flow', async ({ page }) => {
  await page.goto('/');
  await setWorkspaceLanguage(page,'bn');
  await expect(page.locator('#public-how-it-works')).toBeHidden();
  await page.getByRole('button', { name: 'কর পরিশোধ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'কর পরিশোধ' });
  await expect(dialog.getByRole('button', { name: 'ওয়াক-ইন পেমেন্ট' })).toBeVisible();
  await dialog.getByRole('button', { name: 'ওয়াক-ইন পেমেন্ট' }).click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('করদাতার তথ্য');
  const font = await page.locator('.taxpay-citizen-shell').evaluate(element => getComputedStyle(element).fontFamily);
  expect(font).toMatch(/^['"]?Noto Sans Bengali/);
});

test('Sobaike-level flat elevation is consistent across the public hero, section cards and mobile layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const checkElevation = async () => page.evaluate(() => {
    const selectors = [
      '.public-information-hub .public-record-discovery',
      '.public-information-hub .public-benefits',
    ];
    const shadows = selectors.map(selector => {
      const surface = document.querySelector<HTMLElement>(selector);
      if (!surface) throw new Error(`Missing public surface: ${selector}`);
      return getComputedStyle(surface).boxShadow;
    });
    const header = document.querySelector<HTMLElement>('.public-home-header');
    if (!header) throw new Error('Missing public header');
    const hero = document.querySelector<HTMLElement>('.public-information-hero');
    if (!hero) throw new Error('Missing public hero');
    return { shadows, headerShadow: getComputedStyle(header).boxShadow, heroShadow: getComputedStyle(hero).boxShadow };
  });

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const elevation = await checkElevation();
    expect(elevation.heroShadow).toBe('none');
    // Retired hidden sections are gone; the actual visible sections are flat.
    expect(elevation.shadows).toEqual(['none','none']);
    expect(elevation.headerShadow).toBe('none');
  }
  await expect(page.locator('[data-banner-service="intro"] .public-hero-carousel__image-layer[data-visible="true"] .public-information-hero__image')).toBeVisible();
  await expect(page.locator('.public-information-hero .public-information-guide')).toHaveCount(0);
});

// Banner-dependent browser checks use explicitly published CMS rows;
// unavailable CMS must not revive unpublished bundled artwork.
test.beforeEach(async ({ page }) => { await mockPublishedBannerCms(page); });
