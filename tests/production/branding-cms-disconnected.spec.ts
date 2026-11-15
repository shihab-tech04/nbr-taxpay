import { expect, test } from '@playwright/test';

const site = '/nbr-taxpay/';

// This is a real production-bundle check, with no test API mocks.
// A temporary CMS disconnect must not disable payment actions or navigation.
test('deployed bundle uses bundled logo and five banners without CMS API or Storage traffic', async ({ page }) => {
  const brandingRequests: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (/\\/rest\\/v1\\/taxpay_site_(?:logo|banners)(?:\\?|$)/.test(url) ||
        /\\/storage\\/v1\\/object\\/public\\/taxpay-(?:branding|banners)\\//.test(url)) {
      brandingRequests.push(url);
    }
  });
  await page.goto(site + '?action=landing');
  await expect(page.locator('.public-home-wordmark')).toHaveAttribute('src', /\\/assets\\//);
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
