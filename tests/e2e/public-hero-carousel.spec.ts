import { expect, test } from '@playwright/test';

const headline = 'Tax payments, without the confusion';
const description = 'Choose the payment you need, see what happens next, and keep the payment reference handy when you need it.';

test('banner keeps heading, description and both CTAs mounted during every image rotation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const heading = carousel.getByRole('heading', { level: 1 });
  const copy = carousel.locator('.citizen-public-hero__copy > p');
  const pay = carousel.getByRole('button', { name: 'Pay Tax', exact: true });
  const travel = carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true });
  await expect(heading).toHaveText(headline);
  await expect(copy).toHaveText(description);
  await expect(pay).toBeVisible();
  await expect(travel).toBeVisible();
  await expect(carousel.locator('.public-hero-carousel__artwork')).toHaveCount(5);
  await heading.evaluate(el => el.setAttribute('data-stationary-check', 'preserved'));
  await carousel.focus();
  for (const [index, image] of ['return', 'advance', 'withholding', 'travel', 'intro'].entries()) {
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String((index + 1) % 5));
    await expect(carousel.locator('.public-hero-carousel__artwork[data-artwork-active="true"]')).toHaveAttribute('data-banner-service', image);
    await expect(heading).toHaveAttribute('data-stationary-check', 'preserved');
    await expect(heading).toHaveText(headline);
    await expect(copy).toHaveText(description);
    await expect(pay).toBeVisible();
    await expect(travel).toBeVisible();
    await expect(carousel.locator('.citizen-public-hero__copy button')).toHaveCount(2);
  }
});

test('desktop keeps 50:50 fixed copy layout and changes only right-side image', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Desktop split-panel contract');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const slide = carousel.locator('[data-banner-kind="intro"]');
  const before = await slide.evaluate(el => {
    const style = getComputedStyle(el);
    const copy = el.querySelector<HTMLElement>('.citizen-public-hero__copy')!;
    const media = el.querySelector<HTMLElement>('.public-information-hero__media')!;
    const picture = el.querySelector<HTMLElement>('.public-hero-carousel__artwork')!;
    return {
      height: el.getBoundingClientRect().height,
      width: el.getBoundingClientRect().width,
      background: style.backgroundColor,
      columns: style.gridTemplateColumns.split(' ').map(Number.parseFloat),
      copy: copy.getBoundingClientRect().toJSON(),
      media: media.getBoundingClientRect().toJSON(),
      mask: getComputedStyle(picture).maskImage,
    };
  });
  expect(before.height).toBe(270);
  expect(Math.abs(before.columns[0] - before.columns[1])).toBeLessThan(2);
  expect(before.copy.width).toBeLessThanOrEqual(before.width / 2 + 3);
  expect(Math.abs(before.media.width - before.width)).toBeLessThan(2);
  expect(before.mask).toContain('linear-gradient');
  await carousel.focus();
  for (let index = 1; index < 5; index++) {
    await page.keyboard.press('ArrowRight');
    const after = await slide.evaluate(el => ({
      height: el.getBoundingClientRect().height,
      background: getComputedStyle(el).backgroundColor,
      copy: el.querySelector<HTMLElement>('.citizen-public-hero__copy')!.getBoundingClientRect().toJSON(),
    }));
    expect(after.height).toBe(before.height);
    expect(after.background).toBe(before.background);
    expect(after.copy.x).toBeCloseTo(before.copy.x, 1);
    expect(after.copy.y).toBeCloseTo(before.copy.y, 1);
    expect(after.copy.width).toBeCloseTo(before.copy.width, 1);
  }
  await expect(carousel.locator('.public-hero-carousel__artwork[data-artwork-active="true"] img'))
    .toHaveAttribute('src', /taxpay-hero-travel-concept-v7/);
});

test('fixed Pay Tax and Travel Tax CTAs keep independent routes after image rotation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
  const travel = page.getByRole('dialog', { name: 'Travel tax' });
  await expect(travel).toBeVisible();
  await travel.getByRole('button', { name: 'Close modal' }).click();
  await carousel.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pay Tax' })).toBeVisible();
});

test('Bangla headline and payment shortcuts remain fixed as imagery advances', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  const carousel = page.getByRole('region', { name: 'কর পরিশোধের সেবা ব্যানার' });
  const heading = carousel.getByRole('heading', { level: 1 });
  const original = await heading.textContent();
  expect(original).toContain('কর পরিশোধ');
  const primary = carousel.getByRole('button', { name: 'কর পরিশোধ', exact: true });
  const secondary = carousel.getByRole('button', { name: 'ভ্রমণ কর পরিশোধ', exact: true });
  await expect(primary).toBeVisible();
  await expect(secondary).toBeVisible();
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(heading).toHaveText(original!);
  await expect(primary).toBeVisible();
  await expect(secondary).toBeVisible();
});

test('mobile banner keeps stationary readable copy and equal-size actions while image changes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Mobile layout');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 375, 390, 600]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/?action=landing');
    const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
    await expect(carousel.getByRole('heading', { level: 1 })).toHaveText(headline);
    await expect(carousel.locator('.citizen-public-hero__copy > p')).toHaveText(description);
    const geometry = await carousel.locator('[data-banner-kind="intro"]').evaluate(slide => {
      const buttons = [...slide.querySelectorAll<HTMLButtonElement>('.public-guest-action')];
      const title = slide.querySelector<HTMLElement>('h1')!;
      const subtitle = slide.querySelector<HTMLElement>('.citizen-public-hero__copy > p')!;
      const media = slide.querySelector<HTMLElement>('.public-information-hero__media')!;
      return {
        count: buttons.length,
        sameLine: Math.abs(buttons[0].getBoundingClientRect().top - buttons[1].getBoundingClientRect().top) < 2,
        sameSize: Math.abs(buttons[0].getBoundingClientRect().width - buttons[1].getBoundingClientRect().width) < 2,
        labelsFit: buttons.every(button => button.scrollWidth <= button.clientWidth + 2),
        minFont: Math.min(...buttons.map(button => parseFloat(getComputedStyle(button).fontSize))),
        titleFits: title.scrollWidth <= title.clientWidth + 2,
        subtitleFits: subtitle.scrollWidth <= subtitle.clientWidth + 2,
        imageBelow: media.getBoundingClientRect().top >= subtitle.getBoundingClientRect().bottom,
      };
    });
    expect(geometry).toEqual({
      count: 2, sameLine: true, sameSize: true, labelsFit: true,
      minFont: expect.any(Number), titleFits: true, subtitleFits: true, imageBelow: true,
    });
    expect(geometry.minFont).toBeGreaterThanOrEqual(14);
    await carousel.focus();
    await page.keyboard.press('ArrowRight');
    await expect(carousel.getByRole('heading', { level: 1 })).toHaveText(headline);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('desktop arrows and keyboard wrap only the image index', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Desktop arrows');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await page.getByRole('button', { name: 'Previous banner' }).click();
  await expect(carousel).toHaveAttribute('data-active-slide', '4');
  await page.getByRole('button', { name: 'Next banner' }).click();
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
  await page.keyboard.press('ArrowLeft');
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await expect(carousel.getByRole('heading', { level: 1 })).toHaveText(headline);
});

test('mobile touch swipe changes the image only', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Mobile touch gesture');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await carousel.evaluate(element => {
    element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerType: 'touch', pointerId: 17, isPrimary: true, clientX: 240, clientY: 180,
    }));
    element.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerType: 'touch', pointerId: 17, isPrimary: true, clientX: 80, clientY: 183,
    }));
  });
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
  await expect(carousel.getByRole('heading', { level: 1 })).toHaveText(headline);
});

test('autoplay advances only artwork every eight seconds and respects reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Timed regression once');
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await expect(carousel).toHaveAttribute('data-active-slide', '1', { timeout: 11_000 });
  await expect(carousel.getByRole('heading', { level: 1 })).toHaveText(headline);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(8_300);
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
});

test('public record search remains separate and usable', async ({ page }) => {
  await page.goto('/?action=landing');
  const form = page.locator('form.public-record-search');
  const input = page.getByRole('searchbox', { name: 'Search payment records by reference' });
  const submit = form.getByRole('button', { name: 'Search records' });
  await expect(form).toBeVisible();
  await expect(submit).toBeDisabled();
  await input.fill('TEST-REFERENCE-123');
  await expect(submit).toBeEnabled();
  await input.clear();
  await expect(submit).toBeDisabled();
});
