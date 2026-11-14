import { expect, test } from '@playwright/test';
import { setWorkspaceLanguage } from './workspace-language';

// Synthetic HTTP transport: proves each SQL row owns its content and images without
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
  action_en: id === 'intro' ? 'Start tax payment' : id === 'travel' ? 'Start travel tax' : id === 'return' ? 'Pay return tax' : id === 'advance' ? 'Pay advance tax' : 'Deposit source tax',
  action_bn: id === 'intro' ? 'কর পরিশোধ শুরু' : id === 'travel' ? 'ভ্রমণ কর শুরু' : id === 'return' ? 'রিটার্ন কর দিন' : id === 'advance' ? 'অগ্রিম কর দিন' : 'উৎস কর জমা',
  desktop_image_path: null, mobile_image_path: null,
}));

test('SQL-backed banners preserve image order while keeping the published intro copy and two journeys fixed', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/rest/v1/taxpay_site_banners**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(banners),
  }));
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const mobile = info.project.name !== 'desktop-1280';
  await expect(carousel.getByRole('heading', {
    name: mobile ? 'SQL mobile heading' : 'Updated SQL-controlled headline',
  })).toBeVisible();
  await expect(carousel.getByRole('button', { name: 'Start tax payment' })).toBeVisible();
  await expect(carousel.getByRole('button', { name: 'Start travel tax' })).toBeVisible();
  await carousel.focus();
  for (let i = 1; i <= 4; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String(i));
    await expect(carousel.locator('.public-hero-carousel__slide').nth(i)
      .locator('img')).toHaveAttribute('src', /taxpay-hero-(return|advance|withholding|travel)-v9/);
    const active = carousel.locator('.public-hero-carousel__slide').nth(i);
    await expect(active.getByRole('button', { name: 'Start tax payment' })).toBeVisible();
    await expect(active.getByRole('button', { name: 'Start travel tax' })).toBeVisible();
    await expect(active.locator('.public-guest-action')).toHaveCount(2);
    await expect(carousel.getByRole('heading', { name: mobile ? 'SQL mobile heading' : 'Updated SQL-controlled headline' })).toBeVisible();
  }
});

test('uploaded SQL image paths override v9 defaults while mobile may use its own crop', async ({ page }) => {
  const rows = banners.map(row => row.id === 'intro'
    ? { ...row, desktop_image_path: 'banners/intro/desktop.jpg', mobile_image_path: 'banners/intro/mobile.png' }
    : row);
  await page.route('**/rest/v1/taxpay_site_banners**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(rows),
  }));
  // Keep published Storage assets genuinely loadable during the contract check.
  const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9U33LwAAAABJRU5ErkJggg==', 'base64');
  await page.route('**/storage/v1/object/public/taxpay-banners/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng }));
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
  const fallback = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(fallback.getByText(/Banner information is temporarily unavailable/)).toBeVisible();
  await expect(page.locator('.public-hero-carousel__image-layer')).toHaveCount(0);
  await expect(fallback.getByRole('button', { name: 'Pay Tax' })).toBeVisible();
  await expect(fallback.getByRole('button', { name: 'Pay Travel Tax' })).toBeVisible();

  cmsAvailable = true;
  await fallback.getByRole('button', { name: 'Retry banner loading' }).click();
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel.locator('.public-hero-carousel__image-layer')).toHaveCount(5);
  const expectedHeading = (page.viewportSize()?.width ?? 1280) <= 640
    ? 'SQL mobile heading' : 'Updated SQL-controlled headline';
  await expect(carousel.getByRole('heading', { name: expectedHeading })).toBeVisible();
});

test('custom CMS button labels appear visually in compact English and Bangla layouts', async ({ page }) => {
  await page.route('**/rest/v1/taxpay_site_banners**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(banners) }));
  await page.goto('/?action=landing');
  const hero = page.locator('.public-hero-carousel__slide[data-banner-service="intro"]');
  await expect(hero.locator('.public-hero-carousel__travel-compact')).toHaveText('Start travel tax');
  await expect(hero.locator('.public-hero-carousel__pay-compact')).toHaveText('Start tax payment');
  await setWorkspaceLanguage(page, 'bn');
  await expect(hero.locator('.public-hero-carousel__travel-compact')).toHaveText('ভ্রমণ কর শুরু');
  await expect(hero.locator('.public-hero-carousel__pay-compact')).toHaveText('কর পরিশোধ শুরু');
});

test('broken published desktop and mobile images recover to approved category artwork', async ({ page }) => {
  const rows = banners.map(row => row.id === 'intro' ? {
    ...row, desktop_image_path: 'banners/intro/broken.jpg',
    mobile_image_path: 'banners/intro/broken-mobile.png',
  } : row);
  await page.route('**/rest/v1/taxpay_site_banners**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
  await page.route('**/storage/v1/object/public/taxpay-banners/**', route =>
    route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/?action=landing');
  const media = page.locator('.public-hero-carousel__image-layer').first();
  await expect(media.locator('img')).toHaveAttribute('src', /taxpay-hero-intro-v9/);
  await expect(media.locator('source')).toHaveCount(0);
  await expect(media.locator('img')).toBeVisible();
  const healthy = await media.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth > 0);
  expect(healthy).toBe(true);
});


test('a newly published image replaces an earlier broken CMS image without a page reload', async ({ page }) => {
  let currentImage = 'banners/intro/old-broken.jpg';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9U33LwAAAABJRU5ErkJggg==', 'base64');
  await page.route('**/rest/v1/taxpay_site_banners**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(
      banners.map(row => row.id === 'intro' ? { ...row, desktop_image_path: currentImage } : row),
    ) }));
  await page.route('**/storage/v1/object/public/taxpay-banners/**', route =>
    route.request().url().includes('old-broken.jpg')
      ? route.fulfill({ status: 404, body: 'missing' })
      : route.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await page.goto('/?action=landing');
  const image = page.locator('.public-hero-carousel__image-layer').first().locator('img');
  await expect(image).toHaveAttribute('src', /taxpay-hero-intro-v9/);
  currentImage = 'banners/intro/new-good.jpg';
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(image).toHaveAttribute('src', /taxpay-banners\/banners\/intro\/new-good\.jpg/);
  await expect.poll(() => image.evaluate(element =>
    (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test('a temporary Storage outage retries the unchanged published image after connectivity returns', async ({ page }) => {
  let storageAvailable = false;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9U33LwAAAABJRU5ErkJggg==', 'base64');
  await page.route('**/rest/v1/taxpay_site_banners**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(
      banners.map(row => row.id === 'intro'
        ? { ...row, desktop_image_path: 'banners/intro/temporary-outage.png' } : row),
    ) }));
  await page.route('**/storage/v1/object/public/taxpay-banners/**', route =>
    storageAvailable
      ? route.fulfill({ status: 200, contentType: 'image/png', body: png })
      : route.fulfill({ status: 503, body: 'temporarily unavailable' }));
  await page.goto('/?action=landing');
  const image = page.locator('.public-hero-carousel__image-layer').first().locator('img');
  await expect(image).toHaveAttribute('src', /taxpay-hero-intro-v9/);
  storageAvailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(image).toHaveAttribute('src', /taxpay-banners\/banners\/intro\/temporary-outage\.png/);
  await expect.poll(() => image.evaluate(element =>
    (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test('reordering published CMS banners retains the selected service, fixed copy and image palette (EN/BN)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const palette = {
    background_color: '#EFF7F4', heading_color: '#185A43',
    body_color: '#245B4B', outline_color: '#24664E',
  };
  let rows = banners.map(row => row.id === 'advance' ? {...row, ...palette} : row);
  await page.route('**/rest/v1/taxpay_site_banners**', route =>
    route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(rows)}));
  await page.goto('/?action=landing&lang=en');
  const carousel = page.getByRole('region', {name: 'Tax payment service banners'});
  await expect(carousel.locator('.public-hero-carousel__slide')).toHaveCount(5);
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(carousel).toHaveAttribute('data-active-slide', '2');
  await expect(carousel).toHaveAttribute('data-payment-service', 'ADVANCE_TAX');

  // Office changes order; every published service keeps its identity rather
  // than unexpectedly replacing the slide the taxpayer is currently reading.
  rows = [rows[0], rows[3], rows[4], rows[1], rows[2]];
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(carousel).toHaveAttribute('data-active-slide', '4');
  await expect(carousel).toHaveAttribute('data-payment-service', 'ADVANCE_TAX');
  const retained = carousel.locator('.public-hero-carousel__slide[data-active="true"]');
  await expect(retained).toHaveCSS('background-color', 'rgb(239, 247, 244)');
  await expect(retained.locator('h2')).toHaveCSS('color', 'rgb(24, 90, 67)');
  await expect(retained.getByRole('button', {name: 'Start tax payment'})).toBeVisible();
  await expect(retained.getByRole('button', {name: 'Start travel tax'})).toBeVisible();
  await expect(carousel.getByRole('heading', {
    name: page.viewportSize()!.width <= 640 ? 'SQL mobile heading' : 'Updated SQL-controlled headline',
  })).toBeVisible();

  await setWorkspaceLanguage(page, 'bn');
  await expect(carousel).toHaveAttribute('data-payment-service', 'ADVANCE_TAX');
  await expect(retained.getByRole('button', {name: 'কর পরিশোধ শুরু'})).toBeVisible();
  await expect(retained.getByRole('button', {name: 'ভ্রমণ কর শুরু'})).toBeVisible();
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('unpublishing the active banner preserves available payment actions and avoids ghost slides', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  let rows = banners;
  await page.route('**/rest/v1/taxpay_site_banners**', route =>
    route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(rows)}));
  await page.goto('/?action=landing&lang=en');
  const carousel = page.getByRole('region', {name: 'Tax payment service banners'});
  await carousel.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(carousel).toHaveAttribute('data-payment-service', 'TRAVEL_TAX');
  rows = banners.filter(row => row.id !== 'travel');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(carousel.locator('.public-hero-carousel__slide')).toHaveCount(4);
  await expect(carousel).toHaveAttribute('data-active-slide', '3');
  await expect(carousel.locator('.public-hero-carousel__slide[data-active="true"]')
    .getByRole('button', {name: 'Start tax payment'})).toBeVisible();
  // The unpublished Travel Tax row cannot supply its custom label; the
  // approved fallback still exposes the separate Travel Tax action.
  await expect(carousel.locator('.public-hero-carousel__slide[data-active="true"]')
    .getByRole('button', {name: 'Pay Travel Tax'})).toBeVisible();
  await expect(carousel.locator('[data-banner-service="travel"]')).toHaveCount(0);
});

test('published Sohojkor logo updates on version change without a 30-second polling loop', async ({page}) => {
  await page.clock.install();
  await page.emulateMedia({reducedMotion: 'reduce'});
  let version = 18;
  let logoReads = 0;
  await page.route('**/rest/v1/taxpay_site_logo**', route => {
    logoReads++;
    return route.fulfill({status: 200, contentType: 'application/json',
      body: JSON.stringify({id:'primary',image_path:'logos/approved-wordmark.svg',version})});
  });
  await page.route('**/rest/v1/taxpay_site_banners**', route =>
    route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(banners)}));
  await page.route('**/storage/v1/object/public/taxpay-branding/**', route =>
    route.fulfill({status: 200, contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="36"><rect width="120" height="36" fill="#ffffff"/></svg>'}));
  await page.goto('/?action=landing&lang=en');
  const logos = page.locator('img[src*="taxpay-branding"]');
  await expect(logos.first()).toHaveAttribute('src', /approved-wordmark\.svg\?v=18/);
  const initialReads = logoReads;
  expect(initialReads).toBeGreaterThanOrEqual(1);

  await page.clock.fastForward(31_000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(logoReads).toBe(initialReads);

  // A higher CMS version at the SAME asset path must invalidate the old image,
  // without touching approved sizing, the public buttons, or navigation.
  version = 19;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(logos.first()).toHaveAttribute('src', /approved-wordmark\.svg\?v=19/);
  expect(logoReads).toBe(initialReads + 1);
  await expect(page.locator('.public-benefits__item')).toHaveCount(6);
  await expect(page.locator('.public-hero-carousel__slide')).toHaveCount(5);
});

test('temporarily missing published logo retries after connectivity without requiring a new CMS version',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  let storageAvailable=false;
  await page.route('**/rest/v1/taxpay_site_logo**',route=>
    route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({id:'primary',image_path:'logos/recoverable.svg',version:18})}));
  await page.route('**/rest/v1/taxpay_site_banners**',route=>
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(banners)}));
  await page.route('**/storage/v1/object/public/taxpay-branding/**',route=>
    storageAvailable
      ? route.fulfill({status:200,contentType:'image/svg+xml',
          body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="36"><rect width="120" height="36" fill="#ffffff"/></svg>'})
      : route.fulfill({status:503,body:'Storage temporarily unavailable'}));
  await page.goto('/?action=landing&lang=en');
  const logo=page.locator('.public-home-wordmark');
  await expect(logo).toHaveAttribute('src',/korbritto-brand-locked/);
  storageAvailable=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect(logo).toHaveAttribute('src',/taxpay-branding\/logos\/recoverable\.svg\?v=18/);
  await expect.poll(()=>logo.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.public-benefits__item')).toHaveCount(6);
});
