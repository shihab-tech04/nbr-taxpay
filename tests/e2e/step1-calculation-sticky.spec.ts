import { test, expect } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('desktop beneficiary selection retains the calculation rail when the modal scrolls', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280');
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  const summary = dialog.locator('.payment-flow-embedded__identity > .payment-form-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveCSS('position', 'sticky');
  const body = dialog.locator('.taxpay-modal__body');
  // Keep all original accounting content; test only scroll geometry.
  const before = await summary.boundingBox();
  expect(before).not.toBeNull();
  await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const after = await summary.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(2);
  await expect(dialog.getByRole('button', { name: 'Continue to purpose & amount' })).toBeVisible();
});
