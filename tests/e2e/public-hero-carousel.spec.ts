import { expect, test } from '@playwright/test';

const illustrations = [
  'taxpay-hero-intro-concept-v7',
  'taxpay-hero-return-concept-v7',
  'taxpay-hero-advance-concept-v7',
  'taxpay-hero-withholding-concept-v7',
  'taxpay-hero-travel-concept-v7',
];

test('one stationary introductory banner displays five right-side illustrations', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const banner = carousel.locator('[data-banner-service="intro"]');
  const mobile = testInfo.project.name !== 'desktop-1280';

  await expect(carousel.locator('.public-hero-carousel__slide')).toHaveCount(1);
  await expect(carousel.locator('.public-hero-carousel__image-layer')).toHaveCount(5);
  await expect(carousel.locator('.public-information-hero__image')).toHaveCount(5);
  await expect(carousel.getByRole('heading', {
    name: mobile ? 'Pay tax with confidence' : 'Tax payments, without the confusion',
  })).toBeVisible();
  await expect(banner.locator('.public-hero-copy--desktop').nth(1)).toHaveText(
    'Choose the payment you need, see what happens next, and keep the payment reference handy when you need it.'
  );
  await expect(banner.locator('.public-guest-action')).toHaveCount(2);
  await expect(banner.getByRole('button', { name: 'Pay Tax', exact: true })).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Pay Travel Tax', exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search payment records by reference' })).toBeVisible();
  await expect(carousel.locator('.public-hero-carousel__image-placeholder')).toHaveCount(0);
  const imageSources = await carousel.locator('.public-information-hero__image').evaluateAll(
    elements => elements.map(element => (element as HTMLImageElement).src)
  );
  imageSources.forEach((src, index) => expect(src).toContain(illustrations[index]));
});

test('arrow navigation changes only the illustration, never left copy, actions or background', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Keyboard and artwork comparison checked once on desktop');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const intro = carousel.locator('[data-banner-service="intro"]');
  const fixed = await intro.evaluate(element => {
    const h1 = element.querySelector('h1')!;
    const description = element.querySelector('.citizen-public-hero__copy > p')!;
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('.public-guest-action')];
    return {
      title: h1.textContent,
      description: description.textContent,
      actions: buttons.map(button => button.textContent),
      boxes: [h1, description, ...buttons].map(node => {
        const rect = node.getBoundingClientRect();
        return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)];
      }),
      background: getComputedStyle(element).backgroundColor,
      outline: getComputedStyle(element.closest('.public-hero-carousel')!).borderColor,
    };
  });
  const next = page.getByRole('button', { name: 'Next banner' });
  for (let index = 1; index < illustrations.length; index++) {
    await next.click();
    await expect(carousel).toHaveAttribute('data-active-slide', String(index));
    await expect(carousel.locator('.public-hero-carousel__image-layer[data-visible="true"]')).toHaveCount(1);
    const active = carousel.locator('.public-hero-carousel__image-layer[data-visible="true"]');
    await expect(active.locator('img')).toHaveAttribute('src', new RegExp(illustrations[index]));
    await expect(active).toHaveCSS('opacity', '1');
    const current = await intro.evaluate(element => {
      const h1 = element.querySelector('h1')!;
      const description = element.querySelector('.citizen-public-hero__copy > p')!;
      const buttons = [...element.querySelectorAll<HTMLButtonElement>('.public-guest-action')];
      return {
        title: h1.textContent,
        description: description.textContent,
        actions: buttons.map(button => button.textContent),
        boxes: [h1, description, ...buttons].map(node => {
          const rect = node.getBoundingClientRect();
          return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)];
        }),
        background: getComputedStyle(element).backgroundColor,
        outline: getComputedStyle(element.closest('.public-hero-carousel')!).borderColor,
      };
    });
    expect(current).toEqual(fixed);
    await expect(intro.getByRole('button', { name: 'Pay Tax', exact: true })).toBeVisible();
    await expect(intro.getByRole('button', { name: 'Pay Travel Tax', exact: true })).toBeVisible();
  }
  await next.click();
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await page.getByRole('button', { name: 'Previous banner' }).click();
  await expect(carousel).toHaveAttribute('data-active-slide', '4');
});

test('desktop artwork stays inside right 50 percent with a clean blend and balanced buttons', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Desktop fixed-half geometry');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const banner = page.locator('.public-hero-carousel__fixed');
  const info = await banner.evaluate(element => {
    const outer = element.getBoundingClientRect();
    const media = element.querySelector<HTMLElement>('.public-information-hero__media')!;
    const panel = media.getBoundingClientRect();
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('.public-guest-action')];
    const rectangles = buttons.map(button => button.getBoundingClientRect());
    const gradient = getComputedStyle(media, '::before').backgroundImage;
    return {
      height: outer.height,
      columnRatio: panel.width / outer.width,
      panelStartsAtHalf: Math.abs(panel.left - (outer.left + outer.width / 2)),
      panelHeight: panel.height,
      equalButtons: Math.abs(rectangles[0].width - rectangles[1].width) < 2
        && Math.abs(rectangles[0].height - rectangles[1].height) < 2
        && Math.abs(rectangles[0].top - rectangles[1].top) < 2,
      leftCopyVisible: element.querySelector('h1')!.getBoundingClientRect().right <= panel.left + 4,
      gradient,
      shadow: getComputedStyle(element).boxShadow,
    };
  });
  expect(info.height).toBe(270);
  expect(info.columnRatio).toBeCloseTo(.5, 2);
  expect(info.panelStartsAtHalf).toBeLessThan(2);
  expect(info.panelHeight).toBe(270);
  expect(info.equalButtons).toBe(true);
  expect(info.leftCopyVisible).toBe(true);
  expect(info.gradient).toContain('linear-gradient');
  expect(info.shadow).toBe('none');
});

test('mobile keeps a fixed copy and artwork stack, without overflow in English or Bangla', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Mobile widths only');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 360, 375, 390, 600]) {
    for (const language of ['en', 'bn'] as const) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto('/?action=landing');
      if (language === 'bn') await page.getByRole('button', { name: 'বাংলা' }).click();
      const carousel = page.locator('.public-hero-carousel');
      const banner = carousel.locator('.public-hero-carousel__fixed');
      await expect(carousel.locator('.public-hero-carousel__slide')).toHaveCount(1);
      await expect(banner.locator('.public-guest-action')).toHaveCount(2);
      const before = await banner.locator('h1').textContent();
      const geometry = await banner.evaluate(element => {
        const buttons = [...element.querySelectorAll<HTMLButtonElement>('.public-guest-action')];
        const rects = buttons.map(button => button.getBoundingClientRect());
        const image = element.querySelector<HTMLImageElement>('.public-information-hero__image')!;
        const media = element.querySelector<HTMLElement>('.public-information-hero__media')!;
        return {
          sameRow: Math.abs(rects[0].top - rects[1].top) < 2,
          equalButtons: Math.abs(rects[0].width - rects[1].width) < 2,
          fit: buttons.every(button => button.scrollWidth <= button.clientWidth + 1),
          mediaHeight: media.getBoundingClientRect().height,
          imageFit: getComputedStyle(image).objectFit,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(geometry.sameRow).toBe(true);
      expect(geometry.equalButtons).toBe(true);
      expect(geometry.fit).toBe(true);
      expect(geometry.mediaHeight).toBeGreaterThanOrEqual(184);
      expect(geometry.imageFit).toBe('cover');
      expect(geometry.overflow).toBeLessThanOrEqual(2);
      await expect(carousel.locator('.public-hero-carousel__arrow').first()).toBeHidden();
      await carousel.focus();
      await page.keyboard.press('ArrowRight');
      await expect(carousel).toHaveAttribute('data-active-slide', '1');
      expect(await banner.locator('h1').textContent()).toBe(before);
    }
  }
});

test('both stationary payment actions retain their existing modal routes after image rotation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await carousel.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(payment).toBeVisible();
  await expect(payment.locator('[data-payer-relationship]')).toHaveCount(2);
  await payment.getByRole('button', { name: 'Close payment services' }).click();
  await carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Travel tax' })).toBeVisible();
});

test('keyboard and touch swipe rotate media without moving any banner text', async ({ page }) => {
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
});

test('autoplay rotates after eight seconds and reduced motion stops movement', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Timed test once');
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await expect(carousel).toHaveAttribute('data-active-slide', '1', { timeout: 11_000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(8_300);
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
});

test('the public search and 14px action minimum remain unchanged', async ({ page }) => {
  await page.goto('/?action=landing');
  await expect(page.getByRole('searchbox', { name: 'Search payment records by reference' })).toBeVisible();
  const buttons = page.locator('[data-banner-service="intro"] .public-guest-action');
  await expect(buttons).toHaveCount(2);
  const sizes = await buttons.evaluateAll(items => items.map(item => parseFloat(getComputedStyle(item).fontSize)));
  sizes.forEach(size => expect(size).toBeGreaterThanOrEqual(14));
});
