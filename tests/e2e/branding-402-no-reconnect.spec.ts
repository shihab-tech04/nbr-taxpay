import { expect, test } from '@playwright/test';

// Run with a synthetic configured URL and publishable key. All requests are
// intercepted locally; this acceptance must never call the real Taxpayer SQL.
test('402 from public CMS stops logo/banner requests and Realtime reconnects', async ({ page }) => {
  let logoReads = 0;
  let bannerReads = 0;
  let socketAttempts = 0;
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, socket => {
    socketAttempts += 1;
    socket.close();
  });
  await page.route('**/rest/v1/taxpay_site_logo**', async route => {
    logoReads += 1;
    await route.fulfill({
      status: 402,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'exceed_db_size_quota', message: 'restricted for test' }),
    });
  });
  await page.route('**/rest/v1/taxpay_site_banners**', async route => {
    bannerReads += 1;
    await route.fulfill({
      status: 402,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'exceed_db_size_quota', message: 'restricted for test' }),
    });
  });
  await page.goto('/?action=landing');
  await expect(page.getByRole('button', { name: 'Retry banner loading' })).toBeVisible();
  await expect(page.locator('.public-home-wordmark')).toHaveCount(1);
  await page.evaluate(() => {
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
    }
  });
  await page.waitForTimeout(500);
  expect(logoReads + bannerReads).toBeGreaterThan(0);
  expect(logoReads).toBeLessThanOrEqual(1);
  expect(bannerReads).toBeLessThanOrEqual(1);
  expect(socketAttempts).toBe(0);
  // A rejected CMS request must not turn a 402 into a false 'published' banner.
  await expect(page.locator('.public-hero-carousel--offline')).toBeVisible();
});
