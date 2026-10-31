import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('mobile payment calculation belongs to sticky footer and expands for the full summary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');

  const footer = dialog.locator('.taxpay-modal__footer');
  const summary = footer.getByTestId('mobile-payment-calculation');
  await expect(summary).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__body .payment-form-summary')).toHaveCount(0);
  await expect(summary).not.toHaveAttribute('open', '');
  await expect(summary.getByTestId('mobile-payment-calculation-toggle')).toContainText('Payment calculation');
  await expect(summary.getByTestId('mobile-payment-calculation-toggle')).toContainText('—');
  await expect(footer.getByRole('button', { name: 'Continue to purpose & amount' })).toBeVisible();

  await summary.getByTestId('mobile-payment-calculation-toggle').click();
  await expect(summary).toHaveAttribute('open', '');
  await expect(summary.getByTestId('mobile-payment-calculation-details')).toContainText('Payment total');
  await summary.getByTestId('mobile-payment-calculation-toggle').click();
  await expect(summary).not.toHaveAttribute('open', '');

  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-payer-name').fill('Test payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await footer.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(summary).toBeVisible();
  await expect(summary).not.toHaveAttribute('open', '');
  await expect(dialog.locator('.taxpay-modal__body .payment-form-summary')).toHaveCount(0);
});

test('desktop keeps payment calculation in the original rail, without mobile footer duplicate', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  await expect(dialog.locator('.taxpay-modal__body .payment-form-summary')).toHaveCount(1);
  await expect(dialog.getByTestId('mobile-payment-calculation')).toHaveCount(0);
});
