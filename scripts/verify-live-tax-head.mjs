import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/**
 * Read-only acceptance of the REAL, published Sohojkor walk-in Tax Head editor.
 * This deliberately does not use fixture routing, API mocking, financial writes
 * or user-owned sessions. A failure here is a real-production investigation
 * trigger, not proof that the independently tested source component is broken.
 */
const target = process.env.TAXPAY_LIVE_URL;
if (!target) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(target);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' ||
    base.pathname !== '/nbr-taxpay/') {
  throw new Error('Run the live Tax Head acceptance on the Sohojkor production URL only');
}
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const sample of [
    { name: 'desktop-en', width: 1280, height: 900, lang: 'en' },
    { name: 'mobile-375-en', width: 375, height: 812, lang: 'en' },
    { name: 'mobile-320-bn', width: 320, height: 720, lang: 'bn' },
  ]) {
    const bn = sample.lang === 'bn';
    const mobile = sample.width < 650;
    const page = await browser.newPage({
      viewport: { width: sample.width, height: sample.height },
      isMobile: mobile, hasTouch: mobile,
    });
    const financialWrites = [];
    page.on('request', request => {
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) return;
      try {
        const url = new URL(request.url());
        if (url.hostname.endsWith('.supabase.co') &&
          /\/rpc\/(?:sim_submit_payment|.*payment_confirm|.*settle_payment)|\/(?:transactions|credit_postings)\b/i.test(url.pathname)) {
          financialWrites.push(request.method() + ' ' + url.pathname);
        }
      } catch {}
    });
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const url = new URL(base);
      url.searchParams.set('action', 'landing');
      url.searchParams.set('lang', sample.lang);
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
      // The exact supported public v5 entry. Never bypass TIN lookup.
      await page.locator('.public-benefits__item[data-benefit="payments"]').click();
      const login = page.locator('.taxpay-modal[data-public-service="login"]');
      await expect(login).toBeVisible({ timeout: 20000 });
      await login.getByRole('button', {
        name: bn ? 'ওয়াক-ইন পেমেন্ট' : 'Walk-in Payment',
      }).click();

      const tin = page.getByTestId('unified-tin-input');
      const modal = page.locator('[role="dialog"]').filter({ has: tin });
      await expect(tin).toBeVisible({ timeout: 20000 });
      await tin.fill('111111111111'); // publicly approved fictional demo TIN
      await modal.getByRole('button', {
        name: bn ? 'করদাতার টিআইএন অনুসন্ধান' : 'Search taxpayer TIN',
      }).click();
      await expect(modal.getByTestId('unified-taxpayer-search-result'))
        .toBeVisible({ timeout: 20000 });
      await modal.getByRole('button', {
        name: bn ? 'করদাতা যোগ করুন' : 'Add taxpayer',
      }).click();
      await modal.getByRole('button', {
        name: bn ? 'পেমেন্ট খাতে এগিয়ে যান' : 'Continue to Payment Head',
      }).click();

      // The TIN input unmounts on stage transition; anchor to the stable Payment Head editor.
      const editor = page.getByTestId('other-tax-batch');
      const catalogue = editor.getByTestId('other-tax-head-catalogue');
      const groups = catalogue.locator('[data-head-group]');
      await expect(groups).toHaveCount(7);
      const heading = editor.locator('h3.other-tax-category-heading');
      await expect(heading).toHaveText(bn ? 'করের শ্রেণি নির্বাচন করুন' : 'Choose a tax category');
      await expect(heading).toHaveCSS('font-size', '16px');
      await expect(editor.locator('.other-tax-selection-status')).toHaveCSS('font-size', '14px');
      await expect(catalogue).toHaveCSS('row-gap', '6px');

      const advance = catalogue.locator('[data-head-group="Advance Tax"]');
      const advanceSummary = advance.locator('summary');
      await expect(advanceSummary).toHaveCSS('font-size', '16px');
      await expect(advance.locator('.other-tax-category-trigger__count')).toHaveCSS('font-size', '14px');
      const summaryBounds = await advanceSummary.boundingBox();
      if (!summaryBounds || summaryBounds.height < 43.5 || summaryBounds.height > 49) {
        throw new Error('Approved 44px Advance Tax row height drift: ' + JSON.stringify(summaryBounds));
      }
      await page.screenshot({
        path: 'test-results/live-tax-head-closed-' + sample.name + '.png',
        animations: 'disabled',
      });
      await advanceSummary.click();
      await expect(advance.locator('[data-head-row]')).toHaveCount(3);
      await expect(advance.locator('[data-head-row] > label > span.text-sm').first())
        .toHaveCSS('font-size', '16px');
      await expect(advance.locator('[data-head-row] span.text-xs').first())
        .toHaveCSS('font-size', '14px');
      await page.screenshot({
        path: 'test-results/live-tax-head-open-' + sample.name + '.png',
        animations: 'disabled',
      });
      await advanceSummary.click();

      const returnGroup = catalogue.locator('[data-head-group="Tax with Return"]');
      await returnGroup.locator('summary').click();
      await returnGroup.getByTestId('unified-v5-return-checkbox').check();
      await expect(returnGroup.locator('.other-tax-category-trigger__selected'))
        .toContainText(bn ? '1' : '1 selected');
      const allocation = returnGroup.getByTestId('other-tax-line');
      await expect(allocation).toHaveCount(1);
      await expect(allocation.locator('select[id^="other-tax-year-"]'))
        .toHaveValue('2026-27');
      await expect(allocation.locator('input[id^="other-tax-amount-"]')).toBeVisible();
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error('Live Payment Head horizontal viewport overflow: ' + overflow);
      if (financialWrites.length) throw new Error(
        'Tax Head selection attempted financial writes: ' + financialWrites.join(', '));
      console.log('PASS: REAL Sohojkor Tax Head ' + sample.name +
        ' 7 groups, 44px compact rows, 16/14 typography, year/amount editor, no overflow or financial writes');
    } catch (error) {
      await page.screenshot({
        path: 'test-results/live-tax-head-failure-' + sample.name + '.png',
        animations: 'disabled',
      }).catch(() => {});
      throw error;
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log('PASS: production seven-category walk-in Tax Head at desktop, mobile EN and mobile BN');
