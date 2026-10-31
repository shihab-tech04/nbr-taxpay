import { expect, type Locator } from '@playwright/test';
/** Payer relationship is the entry decision, while original financial service IDs remain unchanged. */
export async function enterTaxPayService(dialog: Locator, serviceId: string, payer: 'SELF' | 'OTHER' = 'SELF') {
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
  await dialog.locator(`[data-payer-relationship="${payer}"]`).click();
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
  if (serviceId === 'TAX_WITH_RETURN') {
    await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  } else {
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
    // The public Other Tax card now selects its generic service directly.
    await expect(dialog.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
  }
  // Signed-in users skip the access question altogether. Guests still
  // select Walk-in Payment; both paths use the same Continue action.
  const guest = dialog.locator('[data-payment-access="GUEST"]');
  const continueButton = dialog.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true });
  // The Auth subscription can resolve after the tax selection. Wait for
  // either the guest choices or the signed-in enabled Continue state.
  await expect.poll(async () => (await guest.count()) > 0 || await continueButton.isEnabled()).toBe(true);
  if (await guest.count()) {
    const account = dialog.locator('[data-payment-access="ACCOUNT"]');
    const accountSelected = await account.getAttribute('aria-pressed') === 'true';
    if (!accountSelected) await guest.click();
  } else {
    await expect(dialog.locator('[data-entry-section="access"]')).toHaveCount(0);
  }
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
}
