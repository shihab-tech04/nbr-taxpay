import { expect, type Locator } from '@playwright/test';

/**
 * Select a preserved internal payment service for local regression only.
 * The retired public tax-type selector is intentionally absent in production.
 */
export async function enterTaxPayService(dialog: Locator, serviceId: string, payer: 'SELF' | 'OTHER' = 'SELF') {
  if (serviceId !== 'TAX_WITH_RETURN') {
    const page = dialog.page();
    await page.evaluate(id => { (window as Window & { __taxpayQaPaymentService?: string }).__taxpayQaPaymentService = id; }, serviceId);
    await dialog.getByRole('button', { name: 'Close payment services' }).click();
    const publicPay = page.getByRole('button', { name: 'Pay Tax', exact: true });
    if (await publicPay.isVisible()) await publicPay.click();
    else await page.getByRole('button', { name: 'Pay — select payment type' }).first().click();
  }
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
  await dialog.locator(`[data-payer-relationship="${payer}"]`).click();
  await dialog.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('[data-payment-entry], #tax-service-other-type')).toHaveCount(0);
  await expect(dialog.locator('[data-payment-service]').first()).toHaveAttribute('data-payment-service', serviceId);
}
