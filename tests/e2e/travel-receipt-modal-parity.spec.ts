import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';

test('Travel Tax settled receipt uses one shared modal body/footer without the wizard sidebar or overlapping actions', async ({ page }) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const dialog = page.getByRole('dialog', { name: 'Travel tax' });

  await expect(dialog.locator('.taxpay-modal__header')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__footer-close')).toHaveCount(0);
  await dialog.locator('#travel-tax-route-0').check();
  await dialog.getByRole('button', { name: 'Continue to passenger details' }).click();
  await dialog.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await dialog.getByLabel('Passport number').fill('TRAVEL123');
  await dialog.getByLabel('Mobile number for receipt').fill('01712345678');
  await dialog.getByLabel('Travel date').fill('2026-10-25');
  await dialog.getByRole('button', { name: 'Continue to review' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'Nagad' }).check();
  await dialog.getByLabel('The journey, passenger details and amount are correct.').check();
  await dialog.getByRole('button', { name: 'Continue payment' }).click();

  const receipt = dialog.locator('.taxpay-modal__body > .receipt-view--embedded');
  await expect(receipt).toBeVisible({ timeout: 12000 });
  await expect(receipt.locator('.receipt-view__paper')).toBeVisible();
  await expect(dialog.locator('.travel-flow,.travel-flow__summary')).toHaveCount(0);
  await expect(dialog.locator('.taxpay-modal__footer .travel-flow__footer-actions')).toHaveCount(0);
  await expect(dialog.locator('.taxpay-modal__footer .receipt-view__actions')).toHaveCount(1);
  await expect(dialog.locator('.taxpay-modal__footer-close')).toHaveCount(0);

  const footer = dialog.locator('.taxpay-modal__footer');
  const newPayment = footer.getByRole('button', { name: 'New payment' });
  const download = footer.getByRole('button', { name: 'Download' });
  const print = footer.getByRole('button', { name: 'Print receipt' });
  await expect(newPayment).toBeVisible();
  await expect(download).toBeVisible();
  await expect(print).toBeVisible();

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 375, height: 812 }, { width: 320, height: 700 }]) {
    await page.setViewportSize(viewport);
    // Responsive layout may still be settling after the viewport switch.
    // Poll the actual button rectangles; a persistent overlap still fails.
    await expect.poll(async () => {
      const rectangles = await Promise.all([newPayment, download, print].map(button => button.boundingBox()));
      if (rectangles.some(box => !box)) return Number.POSITIVE_INFINITY;
      let maxOverlap = 0;
      for (let i = 0; i < rectangles.length; i++) {
        for (let j = i + 1; j < rectangles.length; j++) {
          const a = rectangles[i]!, b = rectangles[j]!;
          const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
          const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
          maxOverlap = Math.max(maxOverlap, overlapX * overlapY);
        }
      }
      return maxOverlap;
    }, {timeout: 5000}).toBeLessThanOrEqual(1);
    const actionGroup = footer.locator('.receipt-view__action-group');
    await expect(actionGroup).toHaveCSS('display', 'grid');
    for (const button of [newPayment, download, print]) {
      await expect(button).toHaveCSS('box-sizing', 'border-box');
    }
    const boxes = await Promise.all([newPayment, download, print].map(button => button.boundingBox()));
    for (const box of boxes) {
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        expect(overlapX * overlapY).toBeLessThanOrEqual(1);
      }
    }
  }

  await newPayment.click();
  await expect(dialog.locator('.travel-flow')).toBeVisible();
  await expect(dialog.locator('.receipt-view__actions')).toHaveCount(0);
  await expect(dialog.locator('#travel-tax-route-results')).toBeVisible();
});


test('direct Travel Tax uses the shared progressive modal with reversible stages and mobile calculation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const dialog = page.getByRole('dialog', { name: 'Travel tax' });

  await expect(dialog).toHaveAttribute('data-payment-stage', 'true');
  await expect(dialog.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '1');
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Travel route');
  await expect(dialog.locator('.travel-flow__steps')).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Choose destination & travel mode' })).toHaveCount(1);
  await expect(dialog.locator('.travel-flow__summary')).toBeVisible();

  await dialog.locator('#travel-tax-route-0').check();
  await dialog.getByRole('button', { name: 'Continue to passenger details' }).click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Passenger details');
  await expect(dialog.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '2');
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '1');
  await expect(dialog.locator('#travel-tax-route-0')).toBeChecked();

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(dialog.locator('.travel-flow__summary')).toBeHidden();
  const footerSummary = dialog.locator('.taxpay-modal__footer [data-testid="mobile-payment-calculation"]');
  await expect(footerSummary).toBeVisible();
  await footerSummary.locator('summary').click();
  await expect(footerSummary.locator('dl')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__footer .travel-flow__primary')).toBeVisible();

  await dialog.getByRole('button', { name: 'Continue to passenger details' }).click();
  await dialog.getByLabel('Passenger name').fill('TEST TRAVELLER');
  await dialog.getByLabel('Passport number').fill('TRAVEL123');
  await dialog.getByLabel('Mobile number for receipt').fill('01712345678');
  await dialog.getByLabel('Travel date').fill('2026-11-20');
  await dialog.getByRole('button', { name: 'Continue to review' }).click();
  await expect(dialog.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '3');
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment channel');
  await dialog.getByRole('button', { name: 'Back' }).click();
  await expect(dialog.getByLabel('Passenger name')).toHaveValue('TEST TRAVELLER');
});


test('Travel Tax uses one total with cheque-style words and no duplicate payable panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const dialog = page.getByRole('dialog', { name: 'Travel tax' });
  const calculation = dialog.locator('.travel-flow__summary');
  await expect(calculation.getByTestId('travel-payment-total')).toHaveText('—');
  await expect(calculation.getByTestId('travel-total-in-words')).toHaveCount(0);

  await dialog.locator('#travel-tax-route-1').check();
  await expect(calculation.getByTestId('travel-payment-total')).toContainText('2,000');
  const words = calculation.getByTestId('travel-total-in-words');
  await expect(words).toHaveText('Two Thousand Taka only');
  const [totalBox, wordsBox] = await Promise.all([
    calculation.getByTestId('travel-payment-total').boundingBox(),
    words.boundingBox()
  ]);
  expect(totalBox).not.toBeNull();
  expect(wordsBox).not.toBeNull();
  expect(wordsBox!.y).toBeGreaterThanOrEqual(totalBox!.y + totalBox!.height);

  await dialog.getByRole('button', { name: 'Continue to passenger details' }).click();
  await dialog.getByLabel('Passenger name').fill('TEST TRAVELLER');
  await dialog.getByLabel('Passport number').fill('TRAVEL123');
  await dialog.getByLabel('Mobile number for receipt').fill('01712345678');
  await dialog.getByLabel('Travel date').fill('2026-11-20');
  await dialog.getByRole('button', { name: 'Continue to review' }).click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment channel');
  await expect(dialog.locator('.travel-flow__purpose-total')).toHaveCount(0);
  await expect(dialog.locator('.travel-flow__review').getByText('Payment method', { exact: true })).toHaveCount(0);
  await expect(words).toHaveText('Two Thousand Taka only');

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(calculation).toBeHidden();
  const mobileSummary = dialog.getByTestId('mobile-payment-calculation');
  await expect(mobileSummary).toBeVisible();
  await expect(mobileSummary.locator('summary')).toContainText('2,000');
  await mobileSummary.locator('summary').click();
  await expect(mobileSummary.getByTestId('travel-mobile-total-in-words')).toContainText('Two Thousand Taka only');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
