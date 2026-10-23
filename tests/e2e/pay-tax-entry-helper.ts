import { expect, type Locator } from '@playwright/test';
/** Payer relationship is the entry decision, while original financial service IDs remain unchanged. */
export async function enterTaxPayService(dialog: Locator, serviceId: string, payer: 'SELF' | 'OTHER' = 'SELF') {
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
  await dialog.locator(`[data-payer-relationship="${payer}"]`).click();
  await dialog.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
  if (serviceId === 'TAX_WITH_RETURN') {
    await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  } else {
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await dialog.locator('#tax-service-other-type').selectOption(serviceId);
  }
  await dialog.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
}
