import { expect, test } from '@playwright/test';

// Use an explicitly published, synthetic CMS response. The public hero must
// never revive old bundled artwork when the CMS response is unavailable.
const publishedBanners = [
  { id: 'intro', service_code: null },
  { id: 'return', service_code: 'TAX_WITH_RETURN' },
  { id: 'advance', service_code: 'ADVANCE_TAX' },
  { id: 'withholding', service_code: 'SOURCE_TAX_DEPOSIT' },
  { id: 'travel', service_code: 'TRAVEL_TAX' },
].map((row, sort_order) => ({
  ...row, sort_order, published: true,
  heading_en: row.id === 'intro' ? 'Tax payments, without the confusion' : row.id,
  heading_bn: row.id === 'intro' ? 'কর পরিশোধ' : row.id,
  description_en: 'Choose your payment service.',
  description_bn: 'কর সেবা নির্বাচন করুন।',
  mobile_heading_en: row.id === 'intro' ? 'Pay tax with confidence' : row.id,
  mobile_heading_bn: 'কর দিন',
  mobile_description_en: 'Choose, pay and keep your record.',
  mobile_description_bn: 'কর পরিশোধ করুন।',
  action_en: row.id === 'travel' ? 'Pay Travel Tax' : 'Pay Tax',
  action_bn: row.id === 'travel' ? 'ভ্রমণ কর পরিশোধ' : 'কর পরিশোধ',
  desktop_image_path: null, mobile_image_path: null,
}));

// Service artwork is informational. Moving between illustrations must not
// silently change the user's selected payment service or action.
for (const imageIndex of [0, 1, 2, 3, 4]) {
  test('image ' + imageIndex + ' retains Pay Tax chooser and Travel Tax shortcut', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/rest/v1/taxpay_site_banners**', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(publishedBanners),
    }));
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
