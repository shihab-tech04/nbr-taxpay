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

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
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
