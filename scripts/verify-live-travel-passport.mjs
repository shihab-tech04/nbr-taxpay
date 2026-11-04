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
    await expect(modal.locator('.travel-flow__summary')).toBeHidden();
    if (!mobile) {
      const bounds = await modal.boundingBox();
      if (!bounds || bounds.width > 900 || bounds.height > viewport.height * 0.95) {
        throw new Error('Passport-first stage must use a compact, content-aware modal without an empty payment rail');
      }
    }
    await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
    const addPassenger = modal.getByRole('button', { name: 'Add passenger' });
    const continueToTravel = modal.getByRole('button', { name: 'Continue to travel details' });
    await expect(addPassenger).toBeDisabled();
    await expect(continueToTravel).toBeDisabled();
    await expect(modal.locator('#travel-lookup-first')).toBeDisabled();
    const medicalRow = modal.locator('.travel-flow__medical-option');
    const medicalBounds = await medicalRow.boundingBox();
    const passengerBounds = await modal.locator('[data-passenger-id="first"]').boundingBox();
    if (!medicalBounds || !passengerBounds || medicalBounds.width < .8 * passengerBounds.width) {
      throw new Error('Manual assessment must use the available passenger-card width');
    }
    const medicalHelp = medicalRow.getByRole('button', { name: 'What is manual assessment?' });
    await medicalHelp.click();
    await expect(modal.getByRole('tooltip')).toContainText('does not approve a tax exemption online');
    await medicalHelp.click();
    const receiptContact = modal.locator('.travel-flow__contact');
    const contactBounds = await receiptContact.boundingBox();
    const phoneBounds = await modal.locator('#travel-mobile').boundingBox();
    if (!contactBounds || !phoneBounds || phoneBounds.width < .92 * contactBounds.width) {
      throw new Error('Receipt mobile field must use the available contact-column width');
    }
    await modal.locator('#travel-passport-first').click();
    const options = modal.locator('#travel-passport-suggestions-first [role="option"]');
    await expect(options).toHaveCount(10);
    await expect(options.first()).toBeVisible();
    const suggestionGeometry = await modal.locator('#travel-passport-suggestions-first').evaluate(element => ({scroll:element.scrollHeight,visible:element.clientHeight}));
    if (suggestionGeometry.scroll <= suggestionGeometry.visible) throw new Error('Passport suggestion list should be independently scrollable with ten entries');
    await options.filter({ hasText: 'TEST230005' }).click();
    await expect(modal.locator('#travel-lookup-first')).toBeEnabled();
    await modal.getByRole('button', { name: 'Check Passport' }).click();
    await expect(addPassenger).toBeEnabled();
    await expect(continueToTravel).toBeDisabled();
    await expect(modal.getByTestId('travel-passenger-name-first')).toHaveText('SAMPLE PASSENGER SIX');
    await expect(modal.getByTestId('travel-passenger-birth-first')).toHaveText('2017-08-10');
    await expect(modal.locator('#travel-tax-route-results')).toHaveCount(0);
    await addPassenger.click();
    await expect(modal.locator('#travel-medical-first')).toBeVisible();
    const addAnother = modal.getByRole('button', { name: 'Add another passenger' });
    await expect(addAnother).toBeEnabled();
    await addAnother.click();
    const second = modal.locator('[data-passenger-id]').nth(1);
    await second.locator('input[role="combobox"]').click();
    const secondOptions = second.locator('.travel-flow__passport-suggestions [role="option"]');
    await expect(secondOptions).toHaveCount(9);
    await expect(secondOptions.filter({ hasText: 'TEST230005' })).toHaveCount(0);
    await second.locator('input[role="combobox"]').fill('TEST230005');
    await expect(second.getByText('Passport already added.', { exact: true })).toBeVisible();
    await expect(continueToTravel).toBeDisabled();
    await second.locator('input[role="combobox"]').fill('TEST230001');
    await second.getByRole('button', { name: 'Check Passport' }).click();
    await second.getByRole('button', { name: 'Add passenger' }).click();
    await expect(modal.locator('.travel-flow__person')).toHaveCount(2);
    await expect(addAnother).toBeEnabled();
    await expect(modal.locator('#travel-medical-first')).toBeVisible();
    await expect(modal.locator('#travel-medical-first')).not.toBeChecked();
    await modal.locator('#travel-mobile').fill('01712345678');
    await expect(continueToTravel).toBeEnabled();
    await continueToTravel.click();
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
    await modal.getByRole('button', { name: 'Continue to review' }).click();
    await expect(modal.locator('.travel-flow__passenger-table tbody tr')).toHaveCount(2);
    await modal.getByRole('button', { name: 'Pay online' }).click();
    await modal.getByRole('button', { name: 'Mobile banking' }).click();
    await modal.getByRole('radio', { name: 'Nagad' }).check();
    await modal.getByLabel('I confirm the travel information, all passengers and the combined amount.').check();
    await modal.getByRole('button', { name: 'Confirm preview payment' }).click();
    const combined = modal.getByTestId('travel-family-challan');
    await expect(combined).toBeVisible({ timeout: 15000 });
    await expect(combined.locator('tbody tr')).toHaveCount(2);
    if (mobile) {
      await expect(combined.getByTestId('travel-receipt-passenger-cards')).toBeVisible();
      await expect(combined.getByTestId('travel-receipt-passenger-cards').locator('article')).toHaveCount(2);
    } else {
      await expect(combined.locator('.receipt-view__travel-table')).toBeVisible();
    }
    const reference = await modal.locator('.receipt-view__reference-number').textContent();
    await modal.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(modal.getByTestId('travel-recorded-review')).toBeVisible();
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Confirm preview payment' })).toHaveCount(0);
    await modal.getByRole('button', { name: 'View combined challan' }).click();
    await expect(combined).toBeVisible();
    await expect(modal.locator('.receipt-view__reference-number')).toHaveText(reference?.trim() ?? '');
    if (mobile) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) throw new Error('Live mobile Travel Tax has horizontal overflow: ' + overflow + 'px');
    }
    await page.screenshot({ path: 'test-results/live-travel-passport-' + name + '.png', fullPage: false });
    await page.close();
  }
  console.log('PASS: deployed Travel Tax confirmed two passengers, preserved medical option, generated combined challan, retained Back navigation and mobile/desktop containment');
} finally {
  await browser.close();
}
