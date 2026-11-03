import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const pageUrl = process.env.TAXPAY_LIVE_URL;
if (!pageUrl) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(pageUrl);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' || !base.pathname.startsWith('/nbr-taxpay/')) {
  throw new Error('Travel Tax acceptance must run against the actual production GitHub Pages URL');
}
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, viewport, mobile] of [
    ['desktop', { width: 1280, height: 800 }, false],
    ['mobile', { width: 375, height: 812 }, true],
  ]) {
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
    const url = new URL(base);
    url.searchParams.set('action', 'landing');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const hero = page.locator('.public-hero-carousel');
    await expect(hero).toBeVisible({ timeout: 30_000 });
    await hero.getByRole('button', { name: 'Pay Travel Tax' }).click();
    const modal = page.getByRole('dialog', { name: 'Travel tax' });
    await expect(modal).toBeVisible();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passengers and receipt details');
    await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: 'Continue to travel details' })).toBeVisible();
    await modal.locator('#travel-passport-first').click();
    const options = modal.locator('#travel-passport-suggestions-first [role="option"]');
    await expect(options).toHaveCount(10);
    await expect(options.first()).toBeVisible();
    const suggestionGeometry = await modal.locator('#travel-passport-suggestions-first').evaluate(element => ({scroll:element.scrollHeight,visible:element.clientHeight}));
    if (suggestionGeometry.scroll <= suggestionGeometry.visible) throw new Error('Passport suggestion list should be independently scrollable with ten entries');
    await options.filter({ hasText: 'TEST230005' }).click();
    await modal.getByRole('button', { name: 'Check Passport' }).click();
    await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
    await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('2017-08-10');
    await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
    await modal.locator('#travel-mobile').fill('01712345678');
    await modal.getByRole('button', { name: 'Continue to travel details' }).click();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Travel details');
    await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '2');
    const modes = modal.locator('#travel-tax-route-results');
    await expect(modes.locator('input[type=radio]')).toHaveCount(2);
    await expect(modes.locator('#travel-tax-route-0')).toBeChecked();
    await expect(modes).toContainText('By land');
    await expect(modes).not.toContainText('স্থলপথে');
    await modal.locator('#travel-port').selectOption('Benapole');
    await modal.locator('#travel-destination').fill('India');
    await modal.locator('#travel-departure-date').fill('2026-11-20');
    await modal.getByRole('button', { name: 'Continue to review' }).click();
    await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '3');
    await modal.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(modal.locator('#travel-port')).toHaveValue('Benapole');
    if (mobile) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error('Live mobile Travel Tax has horizontal overflow: ' + overflow + 'px');
    }
    await page.screenshot({ path: 'test-results/live-travel-passport-' + name + '.png', fullPage: false });
    await page.close();
  }
  console.log('PASS: production Travel Tax passport suggestions, identity card, progressive travel fields, localized modes, stage navigation and mobile containment');
} finally {
  await browser.close();
}
