import { expect, type Locator } from '@playwright/test';
/** Payer relationship is the entry decision, while original financial service IDs remain unchanged. */
export async function enterTaxPayService(dialog: Locator, serviceId: string, payer: 'SELF' | 'OTHER' = 'SELF') {
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
  await dialog.locator(`[data-payer-relationship="${payer}"]`).click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
  if (serviceId === 'TAX_WITH_RETURN') {
    await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  } else {
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
    // The public Other Tax card now selects its generic service directly.
    await expect(dialog.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
  }
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  // The access decision appears after the tax-choice Continue.
  const guest = dialog.locator('[data-payment-access="GUEST"]');
  if (await guest.count()) await guest.click();
  await dialog.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
}
