import { expect, test } from '@playwright/test';
import { publishedBannerRows } from './mock-published-banners';

const publishedLogo = 'branding/published/sohojkor-logo-v18.jpg';
test('CMS 402 retains real published visuals and does not open a retrying WebSocket', async ({ page }) => {
  let logoReads = 0, bannerReads = 0, brandingChannelJoins = 0;
  page.on('websocket', socket => {
    socket.on('framesent', frame => {
      if (/taxpay-site-logo-public|published-taxpay-banners/.test(String(frame.payload))) brandingChannelJoins += 1;
    });
  });
  await page.route('**/rest/v1/taxpay_site_logo**', async route => {
    logoReads += 1;
    await route.fulfill({ status: 402, contentType: 'application/json',
      body: JSON.stringify({ code: 'payment_required', message: 'restricted synthetic test' }) });
  });
  await page.route('**/rest/v1/taxpay_site_banners**', async route => {
    bannerReads += 1;
    await route.fulfill({ status: 402, contentType: 'application/json',
      body: JSON.stringify({ code: 'payment_required', message: 'restricted synthetic test' }) });
  });
  await page.goto('/?action=landing');
  await expect(page.locator('.public-hero-carousel__slide')).toHaveCount(5);
  await expect(page.locator('.public-home-wordmark')).toHaveAttribute('src', new RegExp(publishedLogo.replaceAll('/', '\\/')));
  await expect(page.locator('.public-hero-carousel__slide').first()).toHaveAttribute('data-banner-palette', 'image');
  await page.evaluate(() => { for (let i=0;i<20;i++) {
    window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online'));
  } });
  await page.waitForTimeout(250);
  expect(logoReads).toBeLessThanOrEqual(1);
  expect(bannerReads).toBeLessThanOrEqual(1);
  expect(brandingChannelJoins).toBe(0);
  await expect(page.locator('.public-hero-carousel--offline')).toHaveCount(0);
});

test('healthy CMS response replaces last verified snapshot with published edits', async ({ page }) => {
  let logoReads = 0, bannerReads = 0, brandingChannelJoins = 0;
  page.on('websocket', socket => {
    socket.on('framesent', frame => {
      if (/taxpay-site-logo-public|published-taxpay-banners/.test(String(frame.payload))) brandingChannelJoins += 1;
    });
  });
  await page.route('**/rest/v1/taxpay_site_logo**', async route => {
    logoReads += 1;
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ image_path: 'logos/04d6e79e-ab94-4303-97b7-0faa0d945362.jpg', version: 18 }) });
  });
  await page.route('**/rest/v1/taxpay_site_banners**', async route => {
    bannerReads += 1;
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(publishedBannerRows.map((b,i) => i===0
        ? { ...b, heading_en: 'Updated by Office CMS', mobile_heading_en: 'Updated by Office CMS', background_color: '#F7F5E6',
            heading_color: '#65531B', body_color: '#6D5F31', outline_color: '#7A651F' }
        : b)) });
  });
  await page.goto('/?action=landing');
  await expect(page.getByRole('heading', { name: 'Updated by Office CMS' })).toBeVisible();
  await expect(page.locator('.public-hero-carousel__slide')).toHaveCount(5);
  await page.evaluate(() => { for (let i=0;i<20;i++) window.dispatchEvent(new Event('focus')); });
  await page.waitForTimeout(250);
  expect(logoReads).toBeLessThanOrEqual(1);
  expect(bannerReads).toBeLessThanOrEqual(1);
  expect(brandingChannelJoins).toBe(0);
});
