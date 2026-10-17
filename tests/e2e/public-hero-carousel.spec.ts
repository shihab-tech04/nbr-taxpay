import { expect, test } from '@playwright/test';

test('hero provides five bilingual service slides with the original opening banner', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');

  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const slides = carousel.getByRole('group', { includeHidden: true });
  await expect(slides).toHaveCount(5);
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await expect(page.getByRole('heading', { name: 'Understand tax payments. Stay in control.' })).toBeVisible();
  await expect(carousel.locator('[data-banner-service="intro"] .citizen-public-hero__copy > p'))
    .toHaveText('Choose the right tax service, check payment status and find receipts in one place.');
  await expect(page.getByRole('button', { name: 'Check payment & receipt' })).toBeVisible();
  await expect(carousel.locator('[data-banner-service="intro"] .public-information-hero__image')).toBeVisible();
  await expect(carousel.locator('.public-hero-carousel__image-placeholder')).toHaveCount(3);

  await carousel.focus();
  const destinations = [
    ['return', 'Tax with Return', 'Pay Tax with Return'],
    ['advance', 'Advance Income Tax', 'Pay Advance Income Tax'],
    ['withholding', 'Source Tax Deposit (TDS/TCS)', 'Deposit Source Tax'],
    ['travel', 'Travel Tax', 'Pay Travel Tax'],
  ] as const;
  for (const [index, [service, heading, action]] of destinations.entries()) {
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String(index + 1));
    await expect(carousel.getByRole('heading', { name: heading })).toBeVisible();
    await expect(carousel.locator(`[data-banner-service="${service}"]`)).not.toHaveAttribute('inert', '');
    if (service === 'travel') {
      const travelImage = carousel.locator('[data-banner-service="travel"] .public-hero-carousel__service-image');
      await expect(travelImage).toBeVisible();
      await expect.poll(() => travelImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(carousel.locator('[data-banner-service="travel"] .citizen-public-hero__copy > p'))
        .toContainText('move through travel tax with confidence');
    } else {
      await expect(carousel.locator(`[data-banner-service="${service}"] .public-hero-carousel__image-placeholder`)).toBeVisible();
    }
    await expect(carousel.getByRole('button', { name: action, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay Tax', exact: true })).toHaveCount(0);
  }

  await carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pay Tax' })).toBeVisible();
});

test('desktop banner uses a 55:65 split, a 50px shorter height, flat elevation and matching tints', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Desktop columns are evaluated once');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');

  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const first = carousel.locator('[data-banner-service="intro"]');
  const dimensions = await first.evaluate(slide => {
    const columns = getComputedStyle(slide).gridTemplateColumns.split(' ').map(Number.parseFloat);
    const media = slide.querySelector<HTMLElement>('.public-hero-carousel__media--illustrated');
    return {
      columns,
      shadow: getComputedStyle(slide).boxShadow,
      height: slide.getBoundingClientRect().height,
      fadeDirection: media && getComputedStyle(media).getPropertyValue('--banner-fade-direction').trim(),
    };
  });
  expect(dimensions.columns).toHaveLength(2);
  expect(dimensions.columns[1] / dimensions.columns[0]).toBeCloseTo(65 / 55, 1);
  expect(dimensions.height).toBe(270);
  expect(dimensions.shadow).toBe('none');
  expect(dimensions.fadeDirection).toBe('to right');

  const backgrounds = await carousel.locator('[data-banner-service]').evaluateAll(slides =>
    slides.map(slide => getComputedStyle(slide).backgroundColor),
  );
  expect(new Set(backgrounds).size).toBe(5);

  const buttonStyles = await carousel.locator('[data-banner-service]:not([data-banner-service="intro"])').evaluateAll(slides =>
    slides.map(slide => {
      const button = slide.querySelector<HTMLButtonElement>('.citizen-public-primary');
      if (!button) throw new Error('Service Pay Tax button missing');
      const style = getComputedStyle(button);
      return { color: style.color, border: style.borderColor, background: style.backgroundColor, shadow: style.boxShadow };
    }),
  );
  expect(new Set(buttonStyles.map(style => style.color)).size).toBe(4);
  expect(new Set(buttonStyles.map(style => style.border)).size).toBe(4);
  for (const style of buttonStyles) {
    expect(style.background).toBe('rgb(255, 255, 255)');
    expect(style.shadow).toBe('none');
  }
  const introButtonColor = await carousel.locator('[data-banner-service="intro"] .citizen-public-primary')
    .evaluate(button => getComputedStyle(button).backgroundColor);
  expect(introButtonColor).toBe('rgb(44, 94, 173)');
  const travelImageFit = await carousel.locator('[data-banner-service="travel"] .public-hero-carousel__service-image')
    .evaluate(image => getComputedStyle(image).objectFit);
  expect(travelImageFit).toBe('cover');
  const travelArtwork = await carousel.locator('[data-banner-service="travel"] .public-hero-carousel__service-image')
    .evaluate(image => ({
      src: (image as HTMLImageElement).src,
      naturalWidth: (image as HTMLImageElement).naturalWidth,
      bounds: image.getBoundingClientRect().toJSON(),
      panel: image.parentElement?.getBoundingClientRect().toJSON(),
    }));
  expect(travelArtwork.src).toContain('taxpay-hero-travel-v3');
  expect(travelArtwork.naturalWidth).toBeGreaterThan(1000);
  expect(travelArtwork.bounds.width).toBeCloseTo(travelArtwork.panel!.width, 0);
  expect(travelArtwork.bounds.height).toBeCloseTo(travelArtwork.panel!.height, 0);
  const travelFade = await carousel.locator('[data-banner-service="travel"] .public-hero-carousel__media--illustrated')
    .evaluate(media => getComputedStyle(media).getPropertyValue('--banner-fade-end').trim());
  expect(travelFade).toBe('24%');
});

test('mobile illustrated banners blend downward into the image', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Mobile fade is evaluated in each mobile project');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const intro = carousel.locator('[data-banner-service="intro"]');
  const fadeDirection = await intro.locator('.public-hero-carousel__media--illustrated')
    .evaluate(media => getComputedStyle(media).getPropertyValue('--banner-fade-direction').trim());
  expect(fadeDirection).toBe('to bottom');
  const travelFadeDirection = await carousel.locator('[data-banner-service="travel"] .public-hero-carousel__media--illustrated')
    .evaluate(media => getComputedStyle(media).getPropertyValue('--banner-fade-direction').trim());
  expect(travelFadeDirection).toBe('to bottom');
  const columns = await intro.evaluate(slide => getComputedStyle(slide).gridTemplateColumns.split(' '));
  expect(columns).toHaveLength(1);
  await expect(intro.locator('.public-information-hero__image')).toBeVisible();
});

test('service labels remain specific and concise in Bangla', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'বাংলা' }).click();

  const carousel = page.getByRole('region', { name: 'কর পরিশোধের সেবা ব্যানার' });
  await carousel.focus();
  const translated = [
    ['রিটার্নের সঙ্গে কর', 'রিটার্নের সঙ্গে কর পরিশোধ'],
    ['অগ্রিম আয়কর', 'অগ্রিম আয়কর পরিশোধ'],
    ['উৎসে কর জমা (টিডিএস/টিসিএস)', 'উৎসে কর জমা দিন'],
    ['ভ্রমণ কর', 'ভ্রমণ কর পরিশোধ'],
  ] as const;
  for (const [heading, action] of translated) {
    await page.keyboard.press('ArrowRight');
    await expect(carousel.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(carousel.getByRole('button', { name: action, exact: true })).toBeVisible();
  }
});

test('autoplay advances every 4.5 seconds, but reduced motion disables it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Avoid repeating the timed test on each viewport');
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await expect(carousel).toHaveAttribute('data-active-slide', '1', { timeout: 7_500 });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
  await page.waitForTimeout(4_800);
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
});
