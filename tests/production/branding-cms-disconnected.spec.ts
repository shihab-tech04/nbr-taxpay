import { expect, test } from '@playwright/test';

const site = '/nbr-taxpay/';

// Test the real public production build. No synthetic CMS response is involved.
test('production preserves the approved published branding without Supabase CMS requests', async ({ page }) => {
  const unwantedRequests: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/rest/v1/taxpay_site_logo') ||
        url.includes('/rest/v1/taxpay_site_banners') ||
        url.includes('/storage/v1/object/public/taxpay-branding/') ||
        url.includes('/storage/v1/object/public/taxpay-banners/')) {
      unwantedRequests.push(url);
    }
  });
  await page.goto(site + '?action=landing');

  const logo = page.locator('.public-home-wordmark');
  await expect(logo).toHaveAttribute('src', /\/branding\/published\/sohojkor-logo-v18\.jpg$/);
  await expect(logo).toBeVisible();
  await expect(page.locator('.public-hero-carousel__slide')).toHaveCount(5);
  await expect(page.locator('.public-hero-carousel__slide').first()).toHaveAttribute('data-banner-palette', 'image');
  await expect(page.locator('.public-hero-carousel__service-image').first())
    .toHaveAttribute('src', /\/branding\/published\/banner-intro\.jpg$/);
  await expect(page.getByRole('button', { name: 'Pay Tax', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next banner' })).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  expect(unwantedRequests).toEqual([]);
  await expect(page.locator('.public-hero-carousel--offline')).toHaveCount(0);
});
