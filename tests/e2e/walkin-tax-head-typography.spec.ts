import { expectTaxHeadSpacing } from './payment-head-spacing-assertion';
import { expect, test } from '@playwright/test';

/** Use the same supported walk-in journey as the frozen v5 acceptance tests.
 * Never bypass TIN lookup or seed financial transactions to inspect typography. */
test('approved Payment Head group typography and selection survive desktop/mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const modal = page.getByRole('dialog', { name: 'Pay Tax' });
  await modal.getByRole('button', { name: 'Walk-in Payment' }).click();

  const tin = modal.getByTestId('unified-tin-input');
  await tin.fill('111111111111'); // existing fictional User 1 TIN alias
  await modal.getByRole('button', { name: 'Search taxpayer TIN' }).click();
  await expect(modal.getByTestId('unified-taxpayer-search-result')).toBeVisible();
  await modal.getByRole('button', { name: 'Add taxpayer' }).click();
  await modal.getByRole('button', { name: 'Continue to Payment Head' }).click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Payment Head');

  const editor = modal.getByTestId('other-tax-batch');
  const catalogue = editor.getByTestId('other-tax-head-catalogue');
  const heading = editor.getByRole('heading', { name: 'Choose a tax category' });
  const status = editor.locator('.other-tax-selection-status');
  const returnGroup = catalogue.locator('[data-head-group="Tax with Return"]');
  const advanceTax = catalogue.locator('[data-head-group="Advance Tax"]');
  await expect(catalogue.locator('[data-head-group]')).toHaveCount(7);
  await expect(catalogue).toHaveCSS('row-gap', '6px');
  await expect(status).toContainText('168 available payment heads');

  for (const width of [1280, 375, 320, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(heading).toHaveCSS('font-size', '16px');
    await expect(heading).toHaveCSS('font-weight', '600');
    for (const section of await editor.locator('.payment-form-section__heading h2, .unified-v5-row-heading').all()) {
      await expect(section).toHaveCSS('font-size', '16px');
      await expect(section).toHaveCSS('font-weight', '600');
    }
    await expect(editor.locator('.unified-v5-tax-head-heading')).toBeVisible();
    await expectTaxHeadSpacing(editor);
    await expect(advanceTax).toHaveCSS('border-radius', '8px');
    await modal.screenshot({ path: `test-results/sohojkor-v5-candidate-tax-head-${width}.png`, animations: 'disabled' });
    await expect(status).toHaveCSS('font-size', '14px');
    await expect(advanceTax.locator('summary')).toHaveCSS('font-size', '16px');
    await expect(advanceTax.locator('.other-tax-category-trigger__count')).toHaveCSS('font-size', '14px');
    const height = (await advanceTax.locator('summary').boundingBox())?.height ?? 0;
    expect(height).toBeGreaterThanOrEqual(43.5);
    expect(height).toBeLessThanOrEqual(49);
    await advanceTax.locator('summary').click();
    await expect(advanceTax.locator('[data-head-row] > label > span.text-sm').first()).toHaveCSS('font-size', '16px');
    if (width === 1280) await modal.screenshot({ path: 'test-results/sohojkor-v5-candidate-tax-head-open-desktop.png', animations: 'disabled' });
    await expect(advanceTax.locator('[data-head-row] span.text-xs').first()).toHaveCSS('font-size', '14px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
    await advanceTax.locator('summary').click();
  }

  await page.setViewportSize({ width: 320, height: 900 });
  await returnGroup.locator('summary').click();
  await returnGroup.getByTestId('unified-v5-return-checkbox').check();
  await expect(returnGroup.locator('.other-tax-category-trigger__selected')).toContainText('1 selected');
  const allocation = returnGroup.getByTestId('other-tax-line');
  await expect(allocation).toHaveCount(1);
  await expect(allocation.locator('select[id^="other-tax-year-"]')).toHaveValue('2026-27');
  await expect(allocation.locator('input[id^="other-tax-amount-"]')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Continue to Final Preview' })).toBeDisabled();
});
