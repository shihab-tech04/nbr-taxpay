import { expect, test } from '@playwright/test';

// Service artwork is informational. Moving between illustrations must not
// silently change the user's selected payment service or action.
for (const imageIndex of [0, 1, 2, 3, 4]) {
  test('image ' + imageIndex + ' retains Pay Tax chooser and Travel Tax shortcut', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?action=landing');
    const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
    await carousel.focus();
    for (let index = 0; index < imageIndex; index++) await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String(imageIndex));

    await carousel.getByRole('button', { name: 'Pay Tax', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Pay Tax' });
    await expect(modal.locator('[data-payer-relationship]')).toHaveCount(2);
    await expect(modal.locator('[data-payer-relationship="SELF"]')).toContainText('My Tax Liability');
    await expect(modal.locator('[data-payer-relationship="OTHER"]')).toContainText('Facilitate another taxpayer’s payment');
    await modal.locator('[data-payer-relationship="OTHER"]').click();
    await expect(modal.locator('[data-payment-entry]')).toHaveCount(2);
    await modal.getByRole('button', { name: 'Close payment services' }).click();

    await carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Travel tax' })).toBeVisible();
  });
}
