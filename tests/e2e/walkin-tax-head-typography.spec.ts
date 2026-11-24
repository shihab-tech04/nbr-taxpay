import { expect, test } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

test('restored Tax Head editor has stable typography and selectable heads on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await openLegacyTaxServiceChoice(page);
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-payer-name').fill('Example Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: /^Search(?: TIN)?$/ }).click();
  await dialog.getByTestId('other-tax-primary-taxpayer').getByRole('button', { name: 'Add taxpayer' }).click();
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();

  const editor = dialog.getByTestId('other-tax-batch');
  const categoryHeading = editor.getByRole('heading', { name: 'Choose a tax category' });
  const status = editor.locator('.other-tax-selection-status');
  const advanceTax = editor.locator('[data-head-group="Advance Tax"]');

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(categoryHeading).toHaveCSS('font-size', '16px');
    await expect(status).toHaveCSS('font-size', '14px');
    await expect(advanceTax.locator('summary')).toHaveCSS('font-size', '16px');
    await advanceTax.locator('summary').click();
    await expect(advanceTax.locator('[data-head-row] span.text-xs').first()).toHaveCSS('font-size', '14px');
    await expect(advanceTax.locator('[data-head-row] > label > span.text-sm').first()).toHaveCSS('font-size', '16px');
    expect(await editor.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2);
    await advanceTax.locator('summary').click();
  }

  await advanceTax.locator('summary').click();
  await advanceTax.getByRole('checkbox', { name: /Select 68A/ }).check();
  await expect(advanceTax.locator('.other-tax-category-trigger__selected')).toContainText('1 selected');
  await expect(editor.getByTestId('other-tax-line')).toHaveCount(1);
});
