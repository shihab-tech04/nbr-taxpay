import { expect, test } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

test('mobile payment calculation belongs to sticky footer and expands for the full summary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const dialog = await openLegacyTaxServiceChoice(page);
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
  await dialog.getByRole('button', { name: /^Search(?: TIN)?$/ }).click();
  await dialog.getByTestId('other-tax-primary-taxpayer').getByRole('button', { name: 'Add taxpayer' }).click();
  await dialog.locator('#guest-payer-name').fill('Test payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await footer.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(summary).toBeVisible();
  await expect(summary).not.toHaveAttribute('open', '');
  await expect(dialog.locator('.taxpay-modal__body .payment-form-summary')).toHaveCount(0);

  // Compact 320px phones must keep the summary and primary action contained.
  await page.setViewportSize({ width: 320, height: 760 });
  await expect(summary).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Continue to payment channel' })).toBeVisible();
  const footerOverflow = await footer.evaluate(node => node.scrollWidth - node.clientWidth);
  expect(footerOverflow).toBeLessThanOrEqual(2);
});

test('desktop keeps payment calculation in the original rail, without mobile footer duplicate', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // This layout journey does not verify draft persistence. Keep the signed-in preview's
  // draft catalog deterministic; real draft read/write/isolation is covered by SQL acceptance.
  await page.route('**/functions/v1/taxpay-guest-beneficiaries', async route => {
    const action = (route.request().postDataJSON() as { action?: string } | null)?.action;
    if (['open', 'payment-draft-list', 'guest-payment-draft-list'].includes(action ?? '')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    }
    await route.continue();
  });
  await page.goto('/');
  const dialog = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  await expect(dialog.locator('.taxpay-modal__body .payment-form-summary')).toHaveCount(1);
  await expect(dialog.getByTestId('mobile-payment-calculation')).toHaveCount(0);
});
