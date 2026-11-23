import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 740 }]) {
  test('Walk-in payment keeps seven fixed categories, no history suggestions, responsive ' + viewport.width + 'px', async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?action=landing&lang=en');
    await page.locator('.public-benefits__item[data-benefit="payments"]').click();
    const modal = page.getByRole('dialog', { name: 'Pay Tax' });
    await modal.getByRole('button', { name: 'Walk-in Payment' }).click();

    await modal.getByTestId('unified-tin-input').fill('222222222222');
    await modal.getByRole('button', { name: 'Search taxpayer TIN' }).click();
    await modal.getByRole('button', { name: 'Add taxpayer' }).click();
    await modal.getByRole('button', { name: 'Continue to Payment Head' }).click();

    const categories = modal.getByTestId('fixed-tax-categories');
    await expect(categories).toBeVisible();
    await expect(categories.getByRole('button')).toHaveCount(7);
    await expect(categories.locator('[data-selected-count="0"]')).toHaveCount(7);
    await expect(categories.getByRole('table')).toHaveCount(0);
    await expect(modal.getByTestId('frequent-category-section')).toHaveCount(0);
    await expect(modal.getByTestId('frequent-tax-categories')).toHaveCount(0);
    await expect(modal.getByText(/Sign in to see categories from your payment history|No completed payments yet/)).toHaveCount(0);

    // Category choices must be compact, accessible, and open the existing
    // real allocation editor without a redundant table/action column.
    await categories.getByRole('button', { name: 'Choose Tax with Return' }).click();
    await expect(modal.getByTestId('unified-v5-return-group')).toHaveAttribute('open', '');
    await expect(modal.getByTestId('other-tax-head-catalogue')).toBeVisible();
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
}
