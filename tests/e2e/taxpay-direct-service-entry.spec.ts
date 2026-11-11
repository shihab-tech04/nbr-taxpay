import { expect, test } from '@playwright/test';

// Published synthetic CMS response: images and themes remain service-specific,
// but the visible heading and two payment buttons are fixed across slides.
const serviceCatalog = [
  { id: 'intro', code: null, label: 'Pay Tax' },
  { id: 'return', code: 'TAX_WITH_RETURN', label: 'Pay Tax with Return' },
  { id: 'advance', code: 'ADVANCE_TAX', label: 'Pay Advance Income Tax' },
  { id: 'withholding', code: 'SOURCE_TAX_DEPOSIT', label: 'Deposit Source Tax' },
  { id: 'travel', code: 'TRAVEL_TAX', label: 'Pay Travel Tax' },
] as const;

const publishedBanners = serviceCatalog.map((row, sort_order) => ({
  id: row.id, service_code: row.code, sort_order, published: true,
  heading_en: row.id === 'intro' ? 'Tax payments, without the confusion' : row.id,
  heading_bn: row.id === 'intro' ? 'কর পরিশোধ' : row.id,
  description_en: `Published description for ${row.id}.`,
  description_bn: 'প্রকাশিত ব্যানারের বিবরণ।',
  mobile_heading_en: row.id === 'intro' ? 'Pay tax with confidence' : row.id,
  mobile_heading_bn: 'কর দিন',
  mobile_description_en: `Mobile description for ${row.id}.`,
  mobile_description_bn: 'মোবাইলের বিবরণ।',
  action_en: row.label,
  action_bn: row.id === 'travel' ? 'ভ্রমণ কর পরিশোধ' : 'কর পরিশোধ',
  desktop_image_path: null, mobile_image_path: null,
}));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/rest/v1/taxpay_site_banners**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(publishedBanners),
  }));
});


for (const [index, service] of serviceCatalog.entries()) {
  test(`banner ${index + 1} changes artwork without changing the two payment journeys: ${service.id}`, async ({ page }) => {
    await page.goto('/?action=landing');
    const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
    await carousel.focus();
    for (let position = 0; position < index; position++) await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String(index));

    const active = carousel.locator('.public-hero-carousel__slide[aria-hidden="false"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute('data-fixed-left', 'true');
    if (service.code) await expect(active).toHaveAttribute('data-payment-service', service.code);
    else await expect(active).not.toHaveAttribute('data-payment-service');
    await expect(active.getByRole('button', { name: 'Pay Tax', exact: true })).toBeVisible();
    await expect(active.getByRole('button', { name: 'Pay Travel Tax', exact: true })).toBeVisible();
    await expect(active.locator('.public-guest-action')).toHaveCount(2);

    await active.getByRole('button', { name: 'Pay Tax', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Pay Tax' });
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-payer-relationship]')).toHaveCount(2);
    await expect(modal.locator('.tax-service-choice__selected-service')).toHaveCount(0);
    await modal.getByRole('button', { name: 'Close payment services' }).click();
    await active.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Travel tax' })).toBeVisible();
  });
}

test('Source Tax image never bypasses the current generic Pay Tax chooser', async ({ page }) => {
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await carousel.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  const active = carousel.locator('.public-hero-carousel__slide[data-active="true"]');
  await expect(active).toHaveAttribute('data-payment-service', 'SOURCE_TAX_DEPOSIT');
  await active.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.locator('[data-payer-relationship="SELF"]')).toBeVisible();
  await expect(dialog.locator('[data-payer-relationship="OTHER"]')).toBeVisible();
  await expect(dialog.locator('.tax-service-choice__selected-service')).toHaveCount(0);
});
