import { expect, test } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

test('Other Tax challan remarks accept the full 4,000 Unicode character limit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const dialog = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');

  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.getByRole('button', { name: /^Search(?: TIN)?$/ }).click();
  await dialog.getByTestId('other-tax-primary-taxpayer')
    .getByRole('button', { name: 'Add taxpayer' }).click();
  await dialog.locator('#guest-payer-name').fill('Payer Name');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();

  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line')
    .locator('input[id^="other-tax-amount"]').fill('1');

  const remarks = dialog.locator('#guest-payment-remarks');
  await expect(remarks).toBeVisible();
  await expect(remarks).not.toHaveAttribute('maxlength');
  await expect(dialog.getByText('Maximum 4,000 characters')).toBeVisible();

  const maximum = '😀'.repeat(4000);
  await remarks.fill(maximum);
  await expect(remarks).toHaveValue(maximum);
  expect(Array.from(await remarks.inputValue())).toHaveLength(4000);

  await remarks.fill(maximum + '😀');
  await expect(remarks).toHaveValue(maximum);
  expect(Array.from(await remarks.inputValue())).toHaveLength(4000);
});
