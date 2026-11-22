import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const pageUrl = process.env.TAXPAY_LIVE_URL;
if (!pageUrl) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(pageUrl);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' || !base.pathname.startsWith('/nbr-taxpay/'))
  throw new Error('Travel Tax acceptance must run against the production GitHub Pages URL');

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, viewport, mobile] of [
    ['desktop', { width: 1280, height: 800 }, false],
    ['mobile', { width: 375, height: 812 }, true],
  ]) {
    const page = await browser.newPage({ viewport, isMobile: mobile, hasTouch: mobile });
    // Avoid remote CMS asset cost; do not intercept application or payment APIs.
    await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**', route => route.abort('blockedbyclient'));
    try {
      const url = new URL(base);
      url.searchParams.set('action', 'landing');
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
      const hero = page.locator('.public-hero-carousel');
      await expect(hero).toBeVisible({ timeout: 30_000 });
      await hero.getByRole('button', { name: 'Pay Travel Tax' }).click();
      const modal = page.getByRole('dialog', { name: 'Travel tax' });
      await expect(modal).toBeVisible();
      await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passenger Information');
      await expect(modal.locator('.taxpay-modal__subtitle')).toHaveText('Walk-in Payment');
      await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuemax', '3');
      await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '1');
      await expect(modal.locator('.travel-flow__summary')).toBeHidden();
      await expect(modal.getByText('This is a fictional passport for UX testing, not a government lookup.')).toHaveCount(0);
      await expect(modal.locator('#travel-mobile')).toHaveCount(0);
      if (!mobile) {
        const expectedWidth = Math.min(1160, viewport.width - 32);
        await expect.poll(async () => Math.abs((await modal.boundingBox())?.width - expectedWidth), { timeout: 7000 }).toBeLessThanOrEqual(2);
      }
      const passenger = modal.locator('[data-passenger-id="first"]');
      const checkPassport = modal.locator('#travel-lookup-first');
      const addPassenger = passenger.getByRole('button', { name: 'Add passenger', exact: true });
      const continueToTravel = modal.getByRole('button', { name: 'Continue to travel details' });
      await expect(checkPassport).toBeDisabled();
      await expect(continueToTravel).toBeDisabled();
      await modal.locator('#travel-passport-first').fill('TEST230001');
      await checkPassport.click();
      await expect(addPassenger).toBeEnabled();
      await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER TWO');
      const medical = passenger.locator('.travel-flow__identity-card .travel-passenger-workspace__medical');
      await expect(medical).toBeVisible();
      const checkbox = medical.getByRole('checkbox', { name: 'Request manual medical assessment at departure port' });
      await checkbox.check();
      await expect(addPassenger).toBeDisabled();
      await checkbox.uncheck();
      await expect(addPassenger).toBeEnabled();
      // Source identity result and medical assessment remain in the same card.
      await expect(passenger.locator('.travel-flow__identity-card')).toContainText('Date of birth');
      await addPassenger.click();
      await expect(addPassenger).toHaveCount(0);
      await expect(modal.locator('.travel-passenger-workspace__rail .travel-passenger-workspace__person')).toHaveCount(1);
      await expect(modal.locator('.travel-passenger-workspace__rail-title span')).toHaveText('1');
      await expect(modal.locator('#travel-new-passport')).toBeVisible();
      await expect(continueToTravel).toBeEnabled();
      await continueToTravel.click();
      await expect(modal.locator('.taxpay-modal__title')).toHaveText('Travel Details');
      await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '2');
      await modal.locator('#travel-port').selectOption('Benapole');
      await modal.locator('#travel-destination').fill('India');
      await modal.locator('#travel-departure-date').fill(new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Dhaka'})
        .format(new Date(Date.now() + 86_400_000)));
      await modal.getByRole('button', { name: 'Continue to review' }).click();
      await expect(modal.locator('.taxpay-modal__title')).toHaveText('Final Preview');
      await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '3');
      const receipt = modal.locator('[data-testid="travel-preview-receipt-contact"]');
      await expect(receipt).toBeVisible();
      await expect(receipt.locator('#travel-mobile')).toHaveValue('');
      await receipt.locator('#travel-mobile').fill('01712345678');
      await modal.getByRole('button', { name: 'Make Payment' }).click();
      // Payment channel is a separate checkout, not an invented fourth step.
      await expect(modal.locator('.taxpay-modal__title')).toHaveText('Payment channel');
      await expect(modal.locator('[data-testid="travel-payment-channel-screen"]')).toBeVisible();
      await expect(modal.locator('.taxpay-modal__progress')).toHaveCount(0);
      // Never initiate a payment or simulate bank settlement in the production smoke test.
      if (mobile) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 2) throw new Error('Live mobile Travel Tax has horizontal overflow: ' + overflow + 'px');
      }
      await page.screenshot({ path: 'test-results/live-travel-passport-' + name + '.png', fullPage: false });
      console.log('PASS: live travel tax passenger/medical, 3-stage preview, separate checkout and responsive ' + name);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
