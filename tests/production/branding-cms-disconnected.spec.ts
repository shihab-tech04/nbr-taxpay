import { expect, test } from '@playwright/test';

const site = '/nbr-taxpay/';

test('production keeps a bundled logo and five local slides without branding Supabase traffic', async ({ page }) => {
  const brandingRequests: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/rest/v1/taxpay_site_logo') ||
        url.includes('/rest/v1/taxpay_site_banners') ||
        url.includes('/storage/v1/object/public/taxpay-branding/') ||
        url.includes('/storage/v1/object/public/taxpay-banners/')) {
      brandingRequests.push(url);
    }
  });
  await page.goto(site + '?action=landing');
  await expect(page.locator('.public-home-wordmark')).toHaveAttribute('src', /assets/);
  await expect(page.locator('.public-hero-carousel__slide')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Pay Tax', exact: true }).first()).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  expect(brandingRequests).toEqual([]);
});
