import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Production-only, read-only acceptance of the approved three-stage Travel Tax
// workspace. Keep finance/checkout writes out of the live verification path.
const pageUrl = process.env.TAXPAY_LIVE_URL;
if (!pageUrl) throw new Error('TAXPAY_LIVE_URL is required');
const base = new URL(pageUrl);
if (base.protocol !== 'https:' || base.hostname !== 'shihab-tech04.github.io' ||
    !base.pathname.startsWith('/nbr-taxpay/')) {
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
    try {
      // Use bundled artwork fallback, not unrelated storage/CMS egress.
      await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**',
        route => route.abort('blockedbyclient'));
      const url = new URL(base);
      url.searchParams.set('action', 'landing');
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
      const hero = page.locator('.public-hero-carousel');
      await expect(hero).toBeVisible({ timeout: 30_000 });
      await hero.getByRole('button', { name: 'Pay Travel Tax' }).click();
      const modal = page.getByRole('dialog', { name: 'Travel tax' });
      await expect(modal).toBeVisible();
      await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passenger Information');
      await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '1');
      await expect(modal.locator('.travel-flow__summary')).toBeHidden();
      await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
      // Receipt contact now belongs to Final Preview, never the passport step.
      await expect(modal.locator('#travel-mobile')).toHaveCount(0);
      await expect(modal.getByTestId('travel-passenger-list')).toBeVisible();

      if (!mobile) {
        const expectedWidth = Math.min(1160, viewport.width - 32);
        await expect.poll(async () => {
          const bounds = await modal.boundingBox();
          return Math.abs((bounds?.width ?? 0) - expectedWidth);
        }, { timeout: 7_000 }).toBeLessThanOrEqual(2);
        const box = await modal.boundingBox();
        if (!box || box.height > viewport.height * 0.95) {
          throw new Error('Passenger stage extends outside the desktop viewport');
        }
      }
      const continueToTravel = modal.getByRole('button', { name: 'Continue to travel details' });
      await expect(continueToTravel).toBeDisabled();
      const passport = modal.locator('#travel-passport-first');
      const checkPassport = modal.locator('#travel-lookup-first');
      await expect(checkPassport).toBeDisabled();
      await expect(modal.locator('.travel-passenger-workspace__medical input[type="checkbox"]')).toBeVisible();
      await passport.click();
      const options = modal.locator('#travel-passport-suggestions-first [role="option"]');
      await expect(options).toHaveCount(10);
      await expect(options.first()).toBeVisible();
      const listGeometry = await modal.locator('#travel-passport-suggestions-first')
        .evaluate(el => ({ scroll: el.scrollHeight, visible: el.clientHeight }));
      if (listGeometry.scroll <= listGeometry.visible) {
        throw new Error('Ten passport suggestions must remain independently scrollable');
      }
      await options.filter({ hasText: 'TEST230005' }).click();
      await expect(checkPassport).toBeEnabled();
      await checkPassport.click();
      await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
      await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('2017-08-10');
      const addPassenger = modal.getByRole('button', { name: 'Add passenger', exact: true });
      await expect(addPassenger).toBeEnabled();
      await expect(continueToTravel).toBeDisabled();
      // Explicit confirmation lives inside the pending passenger editor.
      if (!(await addPassenger.evaluate(el =>
        !!el.closest('.travel-passenger-workspace__entry .travel-flow__confirm-row')))) {
        throw new Error('Passenger confirmation must remain inside the reviewed identity editor');
      }
      await addPassenger.click();
      await expect(addPassenger).toHaveCount(0);
      await expect(modal.locator('.travel-passenger-workspace__person')).toHaveCount(1);
      await expect(modal.locator('#travel-new-passport')).toBeVisible();
      await expect(continueToTravel).toBeEnabled();

      // Search for a duplicate passenger in the new compact editor, then cancel
      // the unconfirmed second entry without losing the confirmed first passenger.
      await modal.locator('#travel-new-passport').focus();
      const pending = modal.locator('.travel-passenger-workspace__entry');
      await expect(pending).toHaveCount(1);
      await pending.locator('input[role="combobox"]').fill('TEST230005');
      await expect(pending.getByText('Passport already added.', { exact: true })).toBeVisible();
      await expect(continueToTravel).toBeDisabled();
      await pending.locator('.travel-passenger-workspace__remove-editor').click();
      await expect(modal.locator('.travel-passenger-workspace__person')).toHaveCount(1);
      await expect(modal.locator('.travel-passenger-workspace__entry')).toHaveCount(0);
      await expect(continueToTravel).toBeEnabled();

      await continueToTravel.click();
      await expect(modal.locator('.taxpay-modal__title')).toHaveText('Travel Details');
      await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '2');
      const modes = modal.locator('#travel-tax-route-results');
      await expect(modes.locator('input[type=radio]')).toHaveCount(2);
      await expect(modes.locator('#travel-tax-route-0')).toBeChecked();
      await expect(modes).toContainText('By land');
      await modal.locator('#travel-port').selectOption('Benapole');
      await modal.locator('#travel-destination').fill('India');
      await modal.locator('#travel-departure-date').fill(
        new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Dhaka' })
          .format(new Date(Date.now() + 2 * 86_400_000)));
      await modal.getByRole('button', { name: 'Continue to review' }).click();
      await expect(modal.locator('.taxpay-modal__title')).toHaveText('Final Preview');
      await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '3');
      const contact = modal.getByTestId('travel-preview-receipt-contact');
      await expect(contact).toBeVisible();
      const phone = contact.locator('#travel-mobile');
      await expect(phone).toHaveValue('');
      await phone.fill('123');
      await expect(phone).toHaveAttribute('aria-invalid', 'true');
      await phone.fill('01712345678');
      await expect(phone).toHaveAttribute('aria-invalid', 'false');
      await expect(modal.getByRole('button', { name: 'Make Payment' })).toBeVisible();
      // The live test must NOT proceed to payment execution or write a challan.
      await modal.getByRole('button', { name: 'Edit travel details' }).click();
      await expect(modal.locator('#travel-port')).toHaveValue('Benapole');

      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error('Live Travel Tax has horizontal overflow: ' + overflow + 'px');
      await page.screenshot({ path: 'test-results/live-travel-passport-' + name + '.png', fullPage: false });
    } finally {
      await page.close();
    }
  }
  console.log('PASS: deployed three-stage Travel Tax, checked passenger, duplicate prevention, source-bound sample identity, preview-only receipt contact, EN and responsive geometry; no settlement');
} finally {
  await browser.close();
}
