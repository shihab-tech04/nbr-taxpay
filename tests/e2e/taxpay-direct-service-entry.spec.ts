import { expect, test } from '@playwright/test';

// The banner is now one permanent payment gateway. Changing the artwork must
// not silently pre-select a service or replace the payment entry/actions.
test('every banner image keeps the same deliberate Pay Tax service chooser', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const banner = page.getByRole('region', { name: 'Tax payment service banners' });
  const headline = banner.getByRole('heading', { level: 1 });
  const pay = banner.getByRole('button', { name: 'Pay Tax', exact: true });
  const travel = banner.getByRole('button', { name: 'Pay Travel Tax', exact: true });

  for (const [index, image] of ['intro', 'return', 'advance', 'withholding', 'travel'].entries()) {
    if (index) {
      await banner.focus();
      await page.keyboard.press('ArrowRight');
    }
    await expect(banner).toHaveAttribute('data-active-slide', String(index));
    await expect(banner.locator('.public-hero-carousel__artwork[data-artwork-active="true"]'))
      .toHaveAttribute('data-banner-service', image);
    await expect(headline).toHaveText('Tax payments, without the confusion');
    await expect(pay).toBeVisible();
    await expect(travel).toBeVisible();
    await pay.click();

    const modal = page.getByRole('dialog', { name: 'Pay Tax' });
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-payer-relationship="SELF"]')).toContainText('My Tax Liability');
    await expect(modal.locator('[data-payer-relationship="OTHER"]')).toContainText('Facilitate another taxpayer');
    // Approved progressive entry: first choose payer relationship, then payment type.
    await expect(modal.locator('[data-payment-entry]')).toHaveCount(0);
    await modal.locator('[data-payer-relationship="SELF"]').click();
    await expect(modal.locator('[data-payment-entry]')).toHaveCount(2);
    await modal.getByRole('button', { name: 'Close payment services' }).click();
    await expect(modal).toHaveCount(0);
  }
});
