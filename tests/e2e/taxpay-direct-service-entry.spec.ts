import { expect, test } from '@playwright/test';

// Published synthetic CMS response: each payment banner now has its own
// service-specific CTA. Never infer publication from bundled artwork.
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
  test(`banner ${index + 1} opens its own existing payment journey: ${service.id}`, async ({ page }) => {
    await page.goto('/?action=landing');
    const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
    await carousel.focus();
    for (let position = 0; position < index; position++) await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String(index));

    const active = carousel.locator('.public-hero-carousel__slide[aria-hidden="false"]');
    await expect(active).toHaveCount(1);
    await expect(active.getByRole('button', { name: service.label, exact: true })).toBeVisible();
    // Production uses published SQL text; this offline browser lane uses the
    // same approved service category defaults, without claiming an SQL readback.
    if (service.code) await expect(active).toHaveAttribute('data-payment-service', service.code);
    else await expect(active).not.toHaveAttribute('data-payment-service');
    await active.getByRole('button', { name: service.label, exact: true }).click();

    if (service.id === 'travel') {
      await expect(page.getByRole('dialog', { name: 'Travel tax' })).toBeVisible();
    } else {
      const modal = page.getByRole('dialog', { name: 'Pay Tax' });
      await expect(modal).toBeVisible();
      await expect(modal.locator('[data-payer-relationship]')).toHaveCount(2);
      await expect(modal.locator('[data-payer-relationship="SELF"]'))
        .toContainText('My Tax Liability');
      await expect(modal.locator('[data-payer-relationship="OTHER"]'))
        .toContainText('Facilitate another taxpayer’s payment');
      if (service.id === 'intro') {
        await modal.getByRole('button', { name: 'Close payment services' }).click();
        await active.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Travel tax' })).toBeVisible();
      }
    }
  });
}
