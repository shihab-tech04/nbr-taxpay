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
  await expect(carousel.locator('[data-banner-service="intro"] .public-information-hero__image'))
    .toHaveAttribute('src', /taxpay-hero-payment-v3/);
  await expect(carousel.locator('.public-hero-carousel__image-placeholder')).toHaveCount(0);
  await expect(carousel.locator('.public-information-hero__image')).toHaveCount(5);

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
    const serviceImage = carousel.locator(`[data-banner-service="${service}"] .public-hero-carousel__service-image`);
    await expect(serviceImage).toBeVisible();
    await expect.poll(() => serviceImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(1000);
    if (service === 'travel') {
      await expect(carousel.locator('[data-banner-service="travel"] .citizen-public-hero__copy > p'))
        .toContainText('move through travel tax with confidence');
    }
    await expect(carousel.getByRole('button', { name: action, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay Tax', exact: true })).toHaveCount(0);
  }

  await carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pay Tax' })).toBeVisible();
  await expect(page.locator('.tax-service-choice--travel')).toBeVisible();
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
  const expectedImages = {
    return: 'taxpay-hero-return-v3',
    advance: 'taxpay-hero-advance-v3',
    withholding: 'taxpay-hero-withholding-v3',
    travel: 'taxpay-hero-travel-v6',
  };
  for (const [service, assetName] of Object.entries(expectedImages)) {
    const artwork = await carousel.locator(`[data-banner-service="${service}"] .public-hero-carousel__service-image`)
      .evaluate(image => ({
        src: (image as HTMLImageElement).src,
        naturalWidth: (image as HTMLImageElement).naturalWidth,
        fit: getComputedStyle(image).objectFit,
        bounds: image.getBoundingClientRect().toJSON(),
        panel: image.parentElement?.getBoundingClientRect().toJSON(),
        fade: image.parentElement && getComputedStyle(image.parentElement).getPropertyValue('--banner-fade-end').trim(),
      }));
    expect(artwork.src).toContain(assetName);
    expect(artwork.naturalWidth).toBeGreaterThan(1000);
    expect(artwork.fit).toBe('cover');
    expect(artwork.bounds.width).toBeCloseTo(artwork.panel!.width, 0);
    expect(artwork.bounds.height).toBeCloseTo(artwork.panel!.height, 0);
    expect(artwork.fade).toBe('24%');
  }
});

test('service banners share the exact selected-card palette, including text and the outer outline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Palette contract is viewport-independent');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');

  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await carousel.focus();
  const services = [
    ['return', 'TAX_WITH_RETURN'],
    ['advance', 'ADVANCE_TAX'],
    ['withholding', 'SOURCE_TAX_DEPOSIT'],
    ['travel', 'TRAVEL_TAX'],
  ] as const;
  const banners = [];

  for (const [service, code] of services) {
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-payment-service', code);
    const banner = await carousel.locator(`[data-banner-service="${service}"]`).evaluate(slide => {
      const styles = getComputedStyle(slide);
      const title = slide.querySelector('h2');
      const description = slide.querySelector('.citizen-public-hero__copy > p');
      const action = slide.querySelector('.citizen-public-primary');
      if (!title || !description || !action) throw new Error('Incomplete service banner');
      return {
        background: styles.backgroundColor,
        title: getComputedStyle(title).color,
        description: getComputedStyle(description).color,
        actionText: getComputedStyle(action).color,
        actionBorder: getComputedStyle(action).borderColor,
        outline: getComputedStyle(slide.closest('.public-hero-carousel')!).borderColor,
        palette: {
          primary: styles.getPropertyValue('--choice-primary').trim(),
          background: styles.getPropertyValue('--choice-bg').trim(),
          border: styles.getPropertyValue('--choice-border').trim(),
          text: styles.getPropertyValue('--choice-text').trim(),
        },
      };
    });
    banners.push(banner);
  }

  // Color names come from the same source as the selected payment cards.
  await carousel.getByRole('button', { name: /^Show banner 1 of 5:/ }).click();
  await carousel.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const cards = page.locator('.tax-service-choice__card[data-payment-service]');
  await expect(cards).toHaveCount(8);
  const rgb = (hex: string) => {
    const bytes = hex.match(/[\da-f]{2}/gi);
    if (!bytes || bytes.length !== 3) throw new Error(`Invalid service color ${hex}`);
    return `rgb(${bytes.map(byte => parseInt(byte, 16)).join(', ')})`;
  };

  for (const [index, [, code]] of services.entries()) {
    const option = page.locator(`.tax-service-choice__card[data-payment-service="${code}"]`);
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');
    const cardStyles = await option.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderColor,
        palette: {
          primary: style.getPropertyValue('--choice-primary').trim(),
          background: style.getPropertyValue('--choice-bg').trim(),
          border: style.getPropertyValue('--choice-border').trim(),
          text: style.getPropertyValue('--choice-text').trim(),
        },
      };
    });
    const banner = banners[index];
    expect(banner.palette).toEqual(cardStyles.palette);
    expect(banner.background).toBe(cardStyles.background);
    expect(banner.title).toBe(rgb(cardStyles.palette.text));
    expect(banner.actionText).toBe(rgb(cardStyles.palette.text));
    expect(banner.actionBorder).toBe(rgb(cardStyles.palette.primary));
    expect(banner.outline).toBe(rgb(cardStyles.palette.border));
    expect(banner.description).not.toBe('rgb(95, 107, 122)');
  }
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
  const serviceFadeDirections = await carousel.locator('[data-banner-service]:not([data-banner-service="intro"]) .public-hero-carousel__media--illustrated')
    .evaluateAll(media => media.map(element => getComputedStyle(element).getPropertyValue('--banner-fade-direction').trim()));
  expect(serviceFadeDirections).toEqual(['to bottom', 'to bottom', 'to bottom', 'to bottom']);
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

test('autoplay allows eight seconds to read, while reduced motion and manual selection stop it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Avoid repeating the timed test on each viewport');
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await expect(carousel).toHaveAttribute('data-active-slide', '1', { timeout: 11_000 });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
  await page.waitForTimeout(8_300);
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
});

test('all five banners can be selected manually with visible controls even with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const indicators = carousel.locator('.public-hero-carousel__indicator');
  await expect(indicators).toHaveCount(5);
  for (let index = 0; index < 5; index++) {
    await indicators.nth(index).click();
    await expect(carousel).toHaveAttribute('data-active-slide', String(index));
    await expect(indicators.nth(index)).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(carousel).toHaveAttribute('data-user-paused', 'true');
  await carousel.getByRole('button', { name: 'Resume banner rotation' }).click();
  await expect(carousel).toHaveAttribute('data-user-paused', 'false');
});

test('each service-specific banner action skips repeated service selection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const services = [
    ['return', 'TAX_WITH_RETURN', 'Pay Tax with Return'],
    ['advance', 'ADVANCE_TAX', 'Pay Advance Income Tax'],
    ['withholding', 'SOURCE_TAX_DEPOSIT', 'Deposit Source Tax'],
    ['travel', 'TRAVEL_TAX', 'Pay Travel Tax'],
  ] as const;

  for (const [index, [banner, code, action]] of services.entries()) {
    await carousel.locator('.public-hero-carousel__indicator').nth(index + 1).click();
    await carousel.getByRole('button', { name: action, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.tax-service-choice__grid')).toHaveCount(0);
    if (banner === 'travel') {
      await expect(dialog.locator('.tax-service-choice--travel')).toBeVisible();
    } else {
      await expect(dialog.locator('.tax-service-choice__selected-service strong')).toHaveAttribute('data-payment-service', code);
    }
    await dialog.getByRole('button', { name: 'Close payment services' }).click();
  }
});

test('mobile banner buttons and artwork remain readable at narrow widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const media = carousel.locator('[data-banner-service="intro"] .public-information-hero__media');
  await expect.poll(() => media.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(150);
  await expect(carousel.getByRole('button', { name: 'Check payment & receipt' })).toBeVisible();
  await expect(carousel.getByRole('button', { name: /^Show banner 5 of 5:/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
