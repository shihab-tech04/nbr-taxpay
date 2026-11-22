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
    // Keep this browser check independent from remote CMS storage bytes.
    await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**', route => route.abort('blockedbyclient'));
    const url = new URL(base);
    url.searchParams.set('action', 'landing');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const hero = page.locator('.public-hero-carousel');
    await expect(hero).toBeVisible({ timeout: 30_000 });
    await hero.getByRole('button', { name: 'Pay Travel Tax' }).click();

    const modal = page.getByRole('dialog', { name: 'Travel tax' });
    await expect(modal).toBeVisible();
    // Approved parallel Travel Tax journey (PR #955): passenger first, travel
    // details second, final preview third, checkout a separate subsequent view.
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Passenger Information');
    if (!mobile) {
      const expectedWidth = Math.min(1160, viewport.width - 32);
      await expect.poll(async () => {
        const bounds = await modal.boundingBox();
        return Math.abs((bounds?.width ?? 0) - expectedWidth);
      }, { timeout: 7_000 }).toBeLessThanOrEqual(2);
      const bounds = await modal.boundingBox();
      if (!bounds || bounds.height > viewport.height * 0.95) {
        throw new Error('Passenger Information extends outside the desktop viewport');
      }
    }
    await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
    await expect(modal.locator('#travel-mobile')).toHaveCount(0);
    const addPassenger = modal.getByRole('button', { name: 'Add passenger', exact: true });
    const continueToTravel = modal.getByRole('button', { name: 'Continue to travel details' });
    const first = modal.locator('.travel-passenger-workspace__entry[data-passenger-id="first"]');
    await expect(first).toBeVisible();
    await expect(addPassenger).toHaveCount(0);
    await expect(continueToTravel).toBeDisabled();
    await expect(modal.locator('#travel-lookup-first')).toBeDisabled();

    const medical = first.getByTestId('travel-passenger-medical-control');
    const medicalBounds = await medical.boundingBox();
    const passengerBounds = await first.boundingBox();
    if (!medicalBounds || !passengerBounds || medicalBounds.width < .8 * passengerBounds.width) {
      throw new Error('Manual assessment must use the available passenger editor width');
    }
    // The manual-assessment option must still block an ineligible online journey.
    await medical.getByRole('checkbox').check();
    await expect(modal.getByTestId('travel-manual-assessment-blocker')).toBeVisible();
    await medical.getByRole('checkbox').uncheck();
    await expect(modal.getByTestId('travel-manual-assessment-blocker')).toHaveCount(0);

    await modal.locator('#travel-passport-first').click();
    const options = modal.locator('#travel-passport-suggestions-first [role="option"]');
    await expect(options).toHaveCount(10);
    await expect(options.first()).toBeVisible();
    const geometry = await modal.locator('#travel-passport-suggestions-first')
      .evaluate(element => ({ scroll: element.scrollHeight, visible: element.clientHeight }));
    if (geometry.scroll <= geometry.visible) throw new Error('Ten sample passport suggestions should scroll independently');
    await options.filter({ hasText: 'TEST230005' }).click();
    await expect(modal.locator('#travel-lookup-first')).toBeEnabled();
    await expect(addPassenger).toHaveCount(0);
    await modal.getByRole('button', { name: 'Check Passport' }).click();
    await expect(addPassenger).toBeEnabled();
    await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
    await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('2017-08-10');
    await expect(continueToTravel).toBeDisabled();

    // Replacing a checked identity invalidates confirmation until rechecked.
    await modal.locator('#travel-passport-first').fill('TEST230001');
    await expect(addPassenger).toHaveCount(0);
    await expect(modal.getByTestId('travel-passenger-name-first')).toHaveCount(0);
    await modal.getByRole('button', { name: 'Check Passport' }).click();
    await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER TWO');
    await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('1988-11-10');
    await expect(addPassenger).toBeEnabled();

    const inOwnerCard = await addPassenger.evaluate(button => {
      const editor = button.closest('.travel-passenger-workspace__entry');
      const row = button.closest('.travel-flow__confirm-row');
      const assessment = editor?.querySelector('.travel-passenger-workspace__medical');
      return editor?.getAttribute('data-passenger-id') === 'first' &&
        row?.parentElement === editor && !!assessment &&
        !!(assessment.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    if (!inOwnerCard) throw new Error('Add passenger must remain within the checked passenger editor after medical review');
    await addPassenger.click();
    const confirmed = modal.locator('.travel-passenger-workspace__rail .travel-passenger-workspace__person');
    await expect(confirmed).toHaveCount(1);
    await expect(confirmed.first()).toHaveAttribute('data-passenger-id', 'first');
    await expect(confirmed.first()).toHaveAttribute('data-complete', 'true');
    await expect(addPassenger).toHaveCount(0);
    await expect(continueToTravel).toBeEnabled();

    // Confirmed people occupy the rail; a new identity is edited separately.
    await modal.locator('.travel-passenger-workspace__blank')
      .getByRole('button', { name: 'Bangladeshi', exact: true }).click();
    const second = modal.locator('.travel-passenger-workspace__entry');
    const secondId = await second.getAttribute('data-passenger-id');
    if (!secondId || secondId === 'first') throw new Error('A second passenger must have its own stable identity');
    const secondPassport = second.locator('input[role="combobox"]');
    await secondPassport.click();
    const secondOptions = second.locator('.travel-flow__passport-suggestions [role="option"]');
    await expect(secondOptions).toHaveCount(9);
    await expect(secondOptions.filter({ hasText: 'TEST230001' })).toHaveCount(0);
    await secondPassport.fill('TEST230001');
    await expect(second.getByText('Passport already added.', { exact: true })).toBeVisible();
    await expect(continueToTravel).toBeDisabled();
    await second.getByRole('button', { name: 'Remove passenger' }).click();
    await expect(confirmed).toHaveCount(1);
    await expect(modal.locator('.travel-passenger-workspace__entry')).toHaveCount(0);
    await expect(continueToTravel).toBeEnabled();

    await continueToTravel.click();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Travel Details');
    await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '2');
    const modes = modal.locator('#travel-tax-route-results');
    await expect(modes.locator('input[type=radio]')).toHaveCount(2);
    await expect(modes.locator('#travel-tax-route-0')).toBeChecked();
    await expect(modes).toContainText('By land');
    await expect(modes).not.toContainText('স্থলপথে');
    await modal.locator('#travel-port').selectOption('Benapole');
    await modal.locator('#travel-destination').fill('India');
    await modal.locator('#travel-departure-date').fill(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Dhaka' })
      .format(new Date(Date.now() + 86_400_000)));
    await modal.getByRole('button', { name: 'Continue to review' }).click();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Final Preview');
    await expect(modal.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '3');
    await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(1);
    const contact = modal.getByTestId('travel-preview-receipt-contact');
    const [contactBounds, phoneBounds] = await Promise.all([
      contact.boundingBox(),
      modal.locator('#travel-mobile').boundingBox(),
    ]);
    if (!contactBounds || !phoneBounds || phoneBounds.width < .8 * contactBounds.width) {
      throw new Error('Receipt mobile must fill the Final Preview contact field');
    }
    await modal.getByRole('button', { name: 'Make Payment' }).click();
    await expect(modal.getByRole('alert')).toContainText('11-digit receipt mobile number');
    await modal.locator('#travel-mobile').fill('01712345678');
    await modal.getByRole('button', { name: 'Make Payment' }).click();
    await expect(modal.getByTestId('travel-payment-channel-screen')).toBeVisible();
    await modal.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(modal.locator('.taxpay-modal__title')).toHaveText('Final Preview');
    await expect(modal.locator('#travel-mobile')).toHaveValue('01712345678');
    await modal.getByRole('button', { name: 'Edit travel details' }).click();
    await expect(modal.locator('#travel-port')).toHaveValue('Benapole');

    if (mobile) {
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error('Live mobile Travel Tax has horizontal overflow: ' + overflow + 'px');
    }
    await page.screenshot({ path: 'test-results/live-travel-passport-' + name + '.png', fullPage: false });
    await page.close();
  }
  console.log('PASS: production Travel Tax passport lookup, manual medical block, duplicate handling, passenger rail, separate receipt contact and payment channel, EN/desktop/mobile responsive bounds');
} finally {
  await browser.close();
}
