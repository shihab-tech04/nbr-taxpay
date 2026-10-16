import { expect, test } from '@playwright/test';

test('hero provides five bilingual service slides with the original opening banner', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');

  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const slides = carousel.getByRole('group', { includeHidden: true });
  await expect(slides).toHaveCount(5);
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await expect(page.getByRole('heading', { name: 'Understand tax payments. Stay in control.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check payment & receipt' })).toBeVisible();
  await expect(carousel.locator('[data-banner-service="intro"] .public-information-hero__image')).toBeVisible();
  await expect(carousel.locator('.public-hero-carousel__image-placeholder')).toHaveCount(4);

  await carousel.focus();
  const destinations = [
    ['return', 'Pay tax with your return.'],
    ['advance', 'Plan ahead with advance tax.'],
    ['withholding', 'Deposit tax at source.'],
    ['travel', 'Pay travel tax with ease.'],
  ] as const;
  for (const [index, [service, heading]] of destinations.entries()) {
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String(index + 1));
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(carousel.locator(`[data-banner-service="${service}"]`)).not.toHaveAttribute('inert', '');
    await expect(carousel.locator(`[data-banner-service="${service}"] .public-hero-carousel__image-placeholder`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay Tax', exact: true })).toHaveCount(1);
  }

  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pay Tax' })).toBeVisible();
});

test('desktop banner uses equal columns, flat elevation and distinct service tints', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Desktop columns are evaluated once');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');

  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const first = carousel.locator('[data-banner-service="intro"]');
  const dimensions = await first.evaluate(slide => {
    const columns = getComputedStyle(slide).gridTemplateColumns.split(' ').map(Number.parseFloat);
    return { columns, shadow: getComputedStyle(slide).boxShadow };
  });
  expect(dimensions.columns).toHaveLength(2);
  expect(Math.abs(dimensions.columns[0] - dimensions.columns[1])).toBeLessThan(1);
  expect(dimensions.shadow).toBe('none');

  const backgrounds = await carousel.locator('[data-banner-service]').evaluateAll(slides =>
    slides.map(slide => getComputedStyle(slide).backgroundColor),
  );
  expect(new Set(backgrounds).size).toBe(5);
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
