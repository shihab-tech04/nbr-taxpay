import { expect, test } from '@playwright/test';

// Synthetic HTTP transport: proves SQL rows own stationary copy and images without
// accessing or changing the hosted TaxPay CMS.
const serviceRows = [
  { id: 'intro', service_code: null },
  { id: 'return', service_code: 'TAX_WITH_RETURN' },
  { id: 'advance', service_code: 'ADVANCE_TAX' },
  { id: 'withholding', service_code: 'SOURCE_TAX_DEPOSIT' },
  { id: 'travel', service_code: 'TRAVEL_TAX' },
];
const banners = serviceRows.map(({ id, service_code }, index) => ({
  id, service_code, sort_order: index, published: true,
  heading_en: id === 'intro' ? 'Updated SQL-controlled headline' : id,
  heading_bn: id === 'intro' ? 'এসকিউএল-নিয়ন্ত্রিত শিরোনাম' : id,
  mobile_heading_en: id === 'intro' ? 'SQL mobile heading' : id,
  mobile_heading_bn: id === 'intro' ? 'মোবাইল শিরোনাম' : id,
  description_en: id === 'intro' ? 'Updated SQL-controlled description.' : 'Service metadata.',
  description_bn: id === 'intro' ? 'এসকিউএল-নিয়ন্ত্রিত বর্ণনা।' : 'সেবার বিবরণ।',
  mobile_description_en: id === 'intro' ? 'SQL mobile description.' : 'Service description.',
  mobile_description_bn: id === 'intro' ? 'মোবাইল বর্ণনা।' : 'সেবার বিবরণ।',
  action_en: id === 'intro' ? 'Start tax payment' : id === 'travel' ? 'Start travel tax' : 'Pay tax',
  action_bn: id === 'intro' ? 'কর পরিশোধ শুরু' : id === 'travel' ? 'ভ্রমণ কর শুরু' : 'কর দিন',
  desktop_image_path: null, mobile_image_path: null,
}));

test('SQL-backed main copy and two payment CTAs remain fixed while five category artworks rotate', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/rest/v1/taxpay_site_banners**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(banners),
  }));
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const mobile = info.project.name !== 'desktop-1280';
  await expect(carousel.getByRole('heading', { name: mobile ? 'SQL mobile heading' : 'Updated SQL-controlled headline' })).toBeVisible();
  await expect(carousel.getByRole('button', { name: 'Start tax payment' })).toBeVisible();
  await expect(carousel.getByRole('button', { name: 'Start travel tax' })).toBeVisible();
  const copyBefore = await carousel.locator('.citizen-public-hero__copy').textContent();
  await carousel.focus();
  for (let i = 1; i <= 4; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String(i));
    await expect(carousel.locator('.public-hero-carousel__image-layer[data-visible="true"] img'))
      .toHaveAttribute('src', /taxpay-hero-(return|advance|withholding|travel)-v9/);
    expect(await carousel.locator('.citizen-public-hero__copy').textContent()).toBe(copyBefore);
  }
});

test('uploaded SQL image paths override v9 defaults while mobile may use its own crop', async ({ page }) => {
  const rows = banners.map(row => row.id === 'intro'
    ? { ...row, desktop_image_path: 'banners/intro/desktop.jpg', mobile_image_path: 'banners/intro/mobile.png' }
    : row);
  await page.route('**/rest/v1/taxpay_site_banners**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(rows),
  }));
  await page.goto('/?action=landing');
  const media = page.locator('.public-hero-carousel__image-layer').first();
  await expect(media.locator('img')).toHaveAttribute('src', /taxpay-banners\/banners\/intro\/desktop\.jpg/);
  await expect(media.locator('source')).toHaveAttribute('srcset', /taxpay-banners\/banners\/intro\/mobile\.png/);
});

test('CMS outage never resurrects unpublished bundled artwork and payment actions remain accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let cmsAvailable = false;
  await page.route('**/rest/v1/taxpay_site_banners**', route =>
    cmsAvailable
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(banners) })
      : route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"temporarily unavailable"}' }),
  );
  await page.goto('/?action=landing');
  const fallback = page.getByRole('region', { name: 'Tax payment services' });
  await expect(fallback.getByText(/Banner information is temporarily unavailable/)).toBeVisible();
  await expect(page.locator('.public-hero-carousel__image-layer')).toHaveCount(0);
  await expect(fallback.getByRole('button', { name: 'Pay Tax' })).toBeVisible();
  await expect(fallback.getByRole('button', { name: 'Pay Travel Tax' })).toBeVisible();

  cmsAvailable = true;
  await fallback.getByRole('button', { name: 'Retry banner loading' }).click();
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel.locator('.public-hero-carousel__image-layer')).toHaveCount(5);
  await expect(carousel.getByRole('heading', { name: 'Updated SQL-controlled headline' })).toBeVisible();
});
