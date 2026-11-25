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
    await expect(categories.locator('details[data-head-group]')).toHaveCount(7);
    await expect(categories.locator('table')).toHaveCount(0);
    await expect(categories.getByRole('button', { name: /^View payment heads for / })).toHaveCount(0);
    await expect(modal.getByTestId('frequent-category-section')).toHaveCount(0);
    await expect(modal.getByTestId('frequent-tax-categories')).toHaveCount(0);
    await expect(modal.getByText(/Sign in to see categories from your payment history|No completed payments yet/)).toHaveCount(0);

    // Clicking a category reveals the approved checkbox, year and amount editor in place.
    const returnGroup = categories.getByTestId('unified-v5-return-group');
    await returnGroup.locator('summary').click();
    await expect(returnGroup).toHaveAttribute('open', '');
    await expect(returnGroup.getByTestId('unified-v5-return-checkbox')).toBeVisible();
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
}
