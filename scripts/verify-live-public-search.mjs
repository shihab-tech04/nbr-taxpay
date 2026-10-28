import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const liveUrl = process.env.TAXPAY_LIVE_URL;
if (!liveUrl) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(liveUrl);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' || !base.pathname.startsWith('/nbr-taxpay/')) {
  throw new Error('Search readback must target the actual TaxPay Pages production URL');
}
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, viewport, mobile] of [
    ['desktop', { width: 1280, height: 850 }, false],
    ['mobile', { width: 375, height: 812 }, true],
  ]) {
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
    const url = new URL(base);
    url.searchParams.set('action', 'landing');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const search = page.getByRole('searchbox', { name: 'Search payment records by reference' });
    const section = page.getByRole('region', { name: 'Find a payment record' });
    await expect(section).toBeVisible({ timeout: 30_000 });
    await search.fill('TKN-882190');
    await expect(section.getByRole('heading', { name: 'Matching sample references' })).toBeVisible();
    await expect(section.getByRole('button', { name: /TKN-882190/ })).toBeVisible();
    await expect(section.getByRole('link', { name: /Try sample reference: AC-2025-09-DEMO-REF-001/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 2) throw new Error(`Live ${name} public search horizontal overflow: ${overflow}px`);
    await page.screenshot({ path: `test-results/live-search-${name}.png`, fullPage: true });
    await section.getByRole('button', { name: /TKN-882190/ }).click();
    await expect(page).toHaveURL(/action=verify/);
    await expect(page.getByRole('textbox', { name: /Challan, token or transaction reference/ })).toHaveValue('TKN-882190');
    if (page.url().includes('TKN-882190')) throw new Error('Reference leaked into live URL');
    await page.close();
  }
  console.log('PASS: actual deployed TaxPay Pages search section, suggestions, sample links, desktop/mobile bounds and verification route');
} finally {
  await browser.close();
}
