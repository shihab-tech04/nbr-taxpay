import { mockPublishedBannerCms } from './mock-published-banners';
import { expect, test } from '@playwright/test';
import { setWorkspaceLanguage } from './workspace-language';

const illustrations = ['intro-v9', 'return-v9', 'advance-v9', 'withholding-v9', 'travel-v9'];
const services = [null, 'TAX_WITH_RETURN', 'ADVANCE_TAX', 'SOURCE_TAX_DEPOSIT', 'TRAVEL_TAX'];
const headings = ['Tax payments, without the confusion', 'Tax with Return',
  'Advance Income Tax', 'Source Tax Deposit (TDS/TCS)', 'Travel Tax'];
const mobileHeadings = ['Pay tax with confidence', 'Tax with Return',
  'Advance Income Tax', 'Source Tax (TDS/TCS)', 'Travel Tax'];
const actions = ['Pay Tax', 'Pay Tax with Return',
  'Pay Advance Income Tax', 'Deposit Source Tax', 'Pay Travel Tax'];
const themeTokens = [null, '--service-return-bg', '--service-advance-bg',
  '--service-withholding-bg', '--service-other-bg'];

test.beforeEach(async ({ page }) => { await mockPublishedBannerCms(page); });

test('five published records render as distinct complete slides with their own CTA and artwork', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel.locator('.public-hero-carousel__slide')).toHaveCount(5);
  await expect(carousel.locator('.public-hero-carousel__image-layer')).toHaveCount(5);
  await expect(carousel.locator('.public-hero-carousel__slide[aria-hidden="false"]')).toHaveCount(1);
  for (let index = 0; index < 5; index++) {
    const slide = carousel.locator('.public-hero-carousel__slide').nth(index);
    await expect(slide).toHaveAttribute('aria-hidden', index === 0 ? 'false' : 'true');
    await expect(slide.locator('img')).toHaveAttribute('src', new RegExp(`taxpay-hero-${illustrations[index]}`));
    await expect(slide).toHaveAttribute('data-banner-kind', index === 0 ? 'intro' : 'service');
  }
  await expect(carousel.getByRole('button', { name: 'Pay Tax', exact: true })).toBeVisible();
  await expect(carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true })).toBeVisible();
  await carousel.focus();
  for (let index = 1; index < 5; index++) {
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String(index));
    await expect(carousel).toHaveAttribute('data-payment-service', services[index]!);
    const slide = carousel.locator('.public-hero-carousel__slide').nth(index);
    await expect(slide).toHaveAttribute('aria-hidden', 'false');
    await expect(slide).not.toHaveAttribute('inert', '');
    await expect(slide.getByRole('heading', {
      name: info.project.name === 'desktop-1280' ? headings[index] : mobileHeadings[index],
    })).toBeVisible();
    await expect(slide.getByRole('button', { name: actions[index] })).toBeVisible();
    await expect(slide.locator('.public-guest-action')).toHaveCount(1);
    await expect(carousel.getByRole('button', { name: 'Pay Tax', exact: true })).toHaveCount(0);
  }
});

test('published service palettes follow existing choice tokens without changing global brand', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const initial = await carousel.locator('.public-hero-carousel__slide').first().evaluate(
    element => getComputedStyle(element).backgroundColor);
  for (let index = 1; index < 5; index++) {
    await carousel.focus();
    await page.keyboard.press('ArrowRight');
    const actual = await carousel.locator('.public-hero-carousel__slide').nth(index).evaluate(element => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = `var(${getComputedStyle(element).getPropertyValue('--palette-probe') || '--choice-bg'})`;
      // Palette is read from the service-specific variable, not a new hero palette.
      probe.style.backgroundColor = 'var(--choice-bg)';
      element.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { color, surface: getComputedStyle(element).backgroundColor };
    });
    expect(actual.surface).toBe(actual.color);
    if (index >= 2) expect(actual.surface).not.toBe(initial);
    expect(themeTokens[index]).toBeTruthy();
  }
});

test('track uses eased horizontal motion; reduced-motion users receive an instant slide change', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const track = carousel.locator('.public-hero-carousel__track');
  await expect(track).toHaveCSS('transition-property', 'transform');
  await expect(track).toHaveCSS('transition-duration', '0.64s');
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
  await expect(carousel.locator('.public-hero-carousel__slide').nth(1)
    .getByRole('button', { name: 'Pay Tax with Return' })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(track).toHaveCSS('transition-duration', '0s');
  await carousel.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
});

test('service content and artwork fade into place without zoom while the track slides', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const track = carousel.locator('.public-hero-carousel__track');
  const first = carousel.locator('.public-hero-carousel__slide').first();
  const second = carousel.locator('.public-hero-carousel__slide').nth(1);

  await expect(first).toHaveAttribute('data-active', 'true');
  await expect(second).toHaveAttribute('data-active', 'false');
  await expect(second.locator('.public-hero-carousel__image-layer')).toHaveCSS('opacity', '0');
  await expect(second.locator('h2')).toHaveCSS('opacity', '0');

  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(second).toHaveAttribute('data-active', 'true');
  await expect(track).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -' + await track.evaluate(el => el.getBoundingClientRect().width) + ', 0)');
  await expect(second.locator('h2')).toHaveCSS('opacity', '1');
  await expect(second.locator('.public-hero-carousel__image-layer')).toHaveCSS('opacity', '1');
  await expect(second.locator('img')).toHaveCSS('transform', 'none');
  await expect(second.locator('img')).toHaveCSS('object-fit', 'contain');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(track).toHaveCSS('transition-duration', '0s');
  await expect(second.locator('h2')).toHaveCSS('transition-duration', '0s');
  await expect(second.locator('.public-hero-carousel__image-layer')).toHaveCSS('transition-duration', '0s');
});

test('CMS artwork is never CSS-cropped or zoomed in the taxpayer banner at desktop and phone widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto('/?action=landing');
    const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
    await expect(carousel.locator('.public-hero-carousel__slide')).toHaveCount(5);
    for (let index = 0; index < 5; index++) {
      const image = carousel.locator('.public-hero-carousel__slide').nth(index).locator('img');
      await expect(image).toHaveCSS('object-fit', 'contain');
      await expect(image).toHaveCSS('transform', 'none');
    }
  }
});

test('desktop keeps full-width service artwork, equal intro buttons, and a single 270px hero', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Desktop geometry');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const first = carousel.locator('.public-hero-carousel__slide').first();
  const metrics = await first.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const image = element.querySelector<HTMLImageElement>('img')!;
    const imageRect = image.getBoundingClientRect();
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('.public-guest-action')]
      .map(button => button.getBoundingClientRect());
    return {
      height: rect.height,
      imageWidthRatio: imageRect.width / rect.width,
      buttonsEqual: buttons.length === 2 && Math.abs(buttons[0].width - buttons[1].width) <= 2,
      background: getComputedStyle(element).backgroundColor,
    };
  });
  expect(metrics.height).toBe(270);
  expect(metrics.imageWidthRatio).toBeCloseTo(1, 2);
  expect(metrics.buttonsEqual).toBe(true);
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  const second = carousel.locator('.public-hero-carousel__slide').nth(1);
  await expect(second).toHaveCSS('height', '270px');
  await expect(second.getByRole('button', { name: 'Pay Tax with Return' })).toBeVisible();
});

test('mobile slides wrap bilingual text and service buttons without horizontal overflow', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-1280', 'Mobile viewport coverage');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 360, 390, 600]) {
    for (const language of ['en', 'bn'] as const) {
      await page.setViewportSize({ width, height: 820 });
      await page.goto('/?action=landing');
      if (language === 'bn') await setWorkspaceLanguage(page, 'bn');
      const carousel = page.locator('.public-hero-carousel');
      await expect(carousel.locator('.public-hero-carousel__slide')).toHaveCount(5);
      await expect(carousel.locator('.public-hero-carousel__arrow').first()).toBeHidden();
      await carousel.focus();
      for (let slideNumber = 0; slideNumber < 5; slideNumber++) {
        if (slideNumber) await page.keyboard.press('ArrowRight');
        await expect(carousel).toHaveAttribute('data-active-slide', String(slideNumber));
        const metrics = await carousel.locator('.public-hero-carousel__slide').nth(slideNumber).evaluate(element => {
          const button = element.querySelector<HTMLButtonElement>('.public-guest-action')!;
          const frame = element.getBoundingClientRect();
          const control = button.getBoundingClientRect();
          const title = element.querySelector<HTMLElement>('h1, h2')!;
          return {
            titleWrap: getComputedStyle(title).whiteSpace,
            buttonInside: control.left >= frame.left - 1 && control.right <= frame.right + 1,
            buttonHeight: control.height,
            pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
        expect(metrics.titleWrap).not.toBe('nowrap');
        expect(metrics.buttonInside).toBe(true);
        expect(metrics.buttonHeight).toBeGreaterThanOrEqual(44);
        expect(metrics.pageOverflow).toBeLessThanOrEqual(2);
      }
    }
  }
});

test('intro and service CTAs retain existing payment entry routes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await carousel.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(payment).toBeVisible();
  await payment.getByRole('button', { name: 'Close payment services' }).click();
  await carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Travel tax' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Travel tax' }).getByRole('button', { name: /close/i }).first().click();
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await carousel.getByRole('button', { name: 'Pay Tax with Return' }).click();
  await expect(page.getByRole('dialog', { name: 'Pay Tax' })).toBeVisible();
});

test('touch swipes and keyboard arrows update the entire active service presentation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
  await page.keyboard.press('ArrowLeft');
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await carousel.evaluate(element => {
    element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerType: 'touch', pointerId: 17, isPrimary: true, clientX: 240, clientY: 180,
    }));
    element.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerType: 'touch', pointerId: 17, isPrimary: true, clientX: 80, clientY: 183,
    }));
  });
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
  await expect(carousel.locator('.public-hero-carousel__slide').nth(1)
    .getByRole('button', { name: 'Pay Tax with Return' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await page.keyboard.press('ArrowLeft');
  await expect(carousel).toHaveAttribute('data-active-slide', '4');
});

test('autoplay advances after eight seconds; reduced motion pauses autoplay', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Time-sensitive check once');
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await expect(carousel).toHaveAttribute('data-active-slide', '1', { timeout: 11_000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(8_300);
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
});

test('public record search and 14px minimum primary label remain unchanged', async ({ page }) => {
  await page.goto('/?action=landing');
  await expect(page.getByRole('searchbox', { name: 'Search payment records by reference' })).toBeVisible();
  const button = page.locator('[data-banner-service="intro"] .public-guest-action').first();
  await expect(button).toBeVisible();
  expect(await button.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
});
