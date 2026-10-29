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
    const cardHeightBefore = await section.evaluate(element => element.getBoundingClientRect().height);
    const gapBefore = await page.evaluate(() => {
      const card = document.querySelector('.public-record-discovery').getBoundingClientRect();
      return document.querySelector('#public-how-it-works').getBoundingClientRect().top - card.bottom;
    });
    await search.fill('TKN-882190');
    await expect(section.getByRole('heading', { name: 'Matching references' })).toBeVisible();
    await expect(section.getByRole('button', { name: /TKN-882190/ })).toBeVisible();
    await expect(section.locator('.public-record-suggestions__examples')).toHaveCount(0);
    await expect(section.locator('.public-record-discovery__heading svg')).toHaveCount(0);
    await expect(section.getByText('Search by challan, token or transaction reference.')).toBeVisible();
    await expect(section.getByText(/For guest-payment records/)).toHaveCount(0);
    const flow = await section.evaluate(element => {
      const list = element.querySelector('.public-record-suggestions');
      const field = element.querySelector('.public-record-search');
      return {
        floating: getComputedStyle(list).position === 'absolute',
        belowInput: list.getBoundingClientRect().top >= field.getBoundingClientRect().bottom,
        cardHeight: element.getBoundingClientRect().height,
        gapToNext: document.querySelector('#public-how-it-works').getBoundingClientRect().top - element.getBoundingClientRect().bottom,
        dropdownOutsideCard: list.getBoundingClientRect().bottom > element.getBoundingClientRect().bottom,
      };
    });
    if (!flow.floating || !flow.belowInput || !flow.dropdownOutsideCard ||
        Math.abs(flow.cardHeight - cardHeightBefore) > 1 ||
        Math.abs(flow.gapToNext - gapBefore) > 1) {
      throw new Error(`Live ${name} search dropdown resized the card or detached from input: ${JSON.stringify(flow)}`);
    }
    const resultOption = section.getByRole('button', { name: /TKN-882190/ });
    await expect(resultOption).toHaveCSS('text-decoration-line', 'none');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 2) throw new Error(`Live ${name} public search horizontal overflow: ${overflow}px`);
    await page.screenshot({ path: `test-results/live-search-${name}.png`, fullPage: true });
    await section.getByRole('button', { name: /TKN-882190/ }).click();
    await expect(page).toHaveURL(/action=verify/);
    const receiptModal = page.getByRole('dialog', { name: 'Payment status & receipt' });
    await expect(receiptModal).toBeVisible();
    await expect(receiptModal.locator('.receipt-view--embedded')).toContainText('TKN-882190');
    await expect(page.locator('.citizen-header')).toHaveCount(0);
    await expect(page.locator('.public-home-header')).toBeVisible();
    if (page.url().includes('TKN-882190')) throw new Error('Reference leaked into live URL');
    await page.close();
  }
  console.log('PASS: actual deployed TaxPay Pages search, modal receipt, responsive bounds and no legacy blue-header route');
} finally {
  await browser.close();
}
