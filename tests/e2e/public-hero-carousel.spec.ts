import { expect, test } from '@playwright/test';

test('hero provides five bilingual service slides with the original desktop opening banner', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name !== 'desktop-1280';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');

  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const slides = carousel.getByRole('group', { includeHidden: true });
  await expect(slides).toHaveCount(5);
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await expect(page.getByRole('heading', { name: mobile ? 'Pay tax with confidence' : 'Tax payments, without the confusion.' })).toBeVisible();
  await expect(carousel.locator('[data-banner-service="intro"] .citizen-public-hero__copy > p .public-hero-copy--desktop'))
    .toHaveText('Choose the payment you need, see what happens next, and keep the payment reference handy when you need it.');
  await expect(carousel.getByRole('button', { name: /Check (payment & receipt|status)/ })).toHaveCount(0);
  await expect(page.getByRole('searchbox', { name: 'Search payment records by reference' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Payment status & receipt' })).toHaveCount(0);
  await expect(carousel.locator('[data-banner-service="intro"] .public-information-hero__image')).toBeVisible();
  await expect(carousel.locator('[data-banner-service="intro"] .public-information-hero__image'))
    .toHaveAttribute('src', /taxpay-hero-intro-concept-v7/);
  await expect(carousel.locator('.public-hero-carousel__image-placeholder')).toHaveCount(0);
  await expect(carousel.locator('.public-information-hero__image')).toHaveCount(5);

  await carousel.focus();
  const destinations = [
    ['return', 'Tax with Return', 'Pay Tax with Return'],
    ['advance', 'Advance Income Tax', 'Pay Advance Income Tax'],
    ['withholding', mobile ? 'Source Tax (TDS/TCS)' : 'Source Tax Deposit (TDS/TCS)', 'Deposit Source Tax'],
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
      await expect(carousel.locator('[data-banner-service="travel"] .citizen-public-hero__copy > p .public-hero-copy--desktop'))
        .toContainText('check and pay the applicable travel tax');
    }
    await expect(carousel.getByRole('button', { name: action, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay Tax', exact: true })).toHaveCount(0);
  }

  await carousel.getByRole('button', { name: 'Pay Travel Tax', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Travel tax' })).toBeVisible();
});

test('first-banner Travel Tax CTA matches Pay Tax and opens existing travel flow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const intro = page.locator('[data-banner-service="intro"]');
  const payTax = intro.getByRole('button', { name: 'Pay Tax', exact: true });
  const travelTax = intro.getByRole('button', { name: 'Pay Travel Tax', exact: true });
  await expect(payTax).toBeVisible();
  await expect(travelTax).toBeVisible();
  await expect(intro.locator('.public-guest-action')).toHaveCount(2);
  const geometry = await intro.evaluate(slide => {
    const buttons = [...slide.querySelectorAll<HTMLButtonElement>('.public-guest-action')];
    const [pay, travel] = buttons.map(button => button.getBoundingClientRect());
    const bounds = slide.getBoundingClientRect();
    return {
      adjacent: Math.abs(pay.top - travel.top) <= 2 && travel.left > pay.right,
      sameSize: Math.abs(pay.width - travel.width) < 2 && Math.abs(pay.height - travel.height) < 2,
      within: buttons.every(button => {
        const rect = button.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
      }),
      primaryIsFilled: getComputedStyle(buttons[0]).backgroundColor !== getComputedStyle(buttons[1]).backgroundColor,
      travelIsOutlined: getComputedStyle(buttons[1]).borderStyle === 'solid'
        && getComputedStyle(buttons[1]).borderWidth === '1px',
    };
  });
  expect(geometry).toEqual({ adjacent: true, sameSize: true, within: true, primaryIsFilled: true, travelIsOutlined: true });
  await travelTax.click();
  await expect(page.getByRole('dialog', { name: 'Travel tax' })).toBeVisible();
});

test('first-banner travel shortcut is localized in Bangla', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  const intro = page.locator('[data-banner-service="intro"]');
  await expect(intro.getByRole('button', { name: 'ভ্রমণ কর পরিশোধ', exact: true })).toBeVisible();
  await intro.getByRole('button', { name: 'ভ্রমণ কর পরিশোধ', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('both first-banner payment actions fit one line in Bangla on small screens', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-320', 'One runner covers mobile width matrix');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 360, 375, 390, 600]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/?action=landing');
    await page.getByRole('button', { name: 'বাংলা' }).click();
    const intro = page.locator('[data-banner-service="intro"]');
    await expect(intro.getByRole('button', { name: 'কর পরিশোধ', exact: true })).toBeVisible();
    await expect(intro.getByRole('button', { name: 'ভ্রমণ কর পরিশোধ', exact: true })).toBeVisible();
    const geometry = await intro.evaluate(slide => {
      const buttons = [...slide.querySelectorAll<HTMLButtonElement>('.public-guest-action')];
      const bounds = slide.getBoundingClientRect();
      const boxes = buttons.map(button => button.getBoundingClientRect());
      return {
        count: buttons.length,
        sameRow: boxes.every(rect => Math.abs(rect.y - boxes[0].y) < 2),
        sameSize: boxes.every(rect => Math.abs(rect.width - boxes[0].width) < 2 && Math.abs(rect.height - boxes[0].height) < 2),
        inside: boxes.every(rect => rect.left >= bounds.left && rect.right <= bounds.right),
        noClippedLabels: buttons.every(button => button.scrollWidth <= button.clientWidth + 1),
      };
    });
    expect(geometry, 'Bangla first-banner actions at ' + width).toEqual({
      count: 2, sameRow: true, sameSize: true, inside: true, noClippedLabels: true,
    });
  }
});

test('desktop banner uses equal 50:50 columns, a 50px shorter height, flat elevation and matching tints', async ({ page }, testInfo) => {
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
  expect(dimensions.columns[1] / dimensions.columns[0]).toBeCloseTo(1, 2);
  expect(dimensions.height).toBe(270);
  expect(dimensions.shadow).toBe('none');
  expect(dimensions.fadeDirection).toBe('to right');

  // Bundled/CMS artwork remains full-bleed, while the left-to-right overlay
  // transitions gradually from the service background into the illustration.
  const artworkGeometry = await carousel.locator('[data-banner-service]').evaluateAll(slides =>
    slides.map(slide => {
      const panel = slide.querySelector<HTMLElement>('.public-hero-carousel__media--illustrated');
      const img = panel?.querySelector<HTMLImageElement>('img');
      if (!panel || !img) throw new Error('Banner illustration missing');
      const slideBox = slide.getBoundingClientRect();
      const mediaBox = panel.getBoundingClientRect();
      const imageBox = img.getBoundingClientRect();
      return {
        widthDifference: Math.abs(mediaBox.width - slideBox.width),
        leftDifference: Math.abs(mediaBox.left - slideBox.left),
        heightDifference: Math.abs(mediaBox.height - slideBox.height),
        imageWidthDifference: Math.abs(imageBox.width - slideBox.width),
        position: getComputedStyle(panel).position,
        imageFit: getComputedStyle(img).objectFit,
        gradient: getComputedStyle(panel, '::before').backgroundImage,
      };
    }),
  );
  for (const layout of artworkGeometry) {
    expect(layout.position).toBe('absolute');
    expect(layout.widthDifference).toBeLessThan(2);
    expect(layout.leftDifference).toBeLessThan(2);
    expect(layout.heightDifference).toBeLessThan(2);
    expect(layout.imageWidthDifference).toBeLessThan(2);
    expect(layout.imageFit).toBe('cover');
    expect(layout.gradient).toContain('linear-gradient');
    // Ensure multiple gradual color stops, not the previous hard 50% seam.
    expect(layout.gradient).toContain('34%');
    expect(layout.gradient).toContain('43%');
    expect(layout.gradient).toContain('59%');
    expect(layout.gradient).toContain('70%');
    expect(layout.gradient).not.toContain('transparent 50%');
  }


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
    expect(style.background).toBe('rgba(255, 255, 255, 0.52)');
    expect(style.shadow).toBe('none');
  }
  const introButtonColor = await carousel.locator('[data-banner-service="intro"] .citizen-public-primary')
    .first().evaluate(button => getComputedStyle(button).backgroundColor);
  expect(introButtonColor).toBe('rgb(44, 94, 173)');
  const expectedImages = {
    return: 'taxpay-hero-return-concept-v7',
    advance: 'taxpay-hero-advance-concept-v7',
    withholding: 'taxpay-hero-withholding-concept-v7',
    travel: 'taxpay-hero-travel-concept-v7',
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

test('service banners preserve distinctive palette and readable CTA with payer-first entry', async ({ page }, testInfo) => {
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

  // The old eight cards are no longer present; keep checking the four banner palettes.
  // The shared two-card payer/service gateway is verified independently.
  for (const banner of banners) {
    const rgb = (hex: string) => {
      const bytes = hex.match(/[\da-f]{2}/gi);
      if (!bytes || bytes.length !== 3) throw new Error(`Invalid service color ${hex}`);
      return `rgb(${bytes.map(byte => parseInt(byte, 16)).join(', ')})`;
    };
    expect(banner.background).toBe(rgb(banner.palette.background));
    expect(banner.title).toBe(rgb(banner.palette.text));
    expect(banner.actionText).toBe(rgb(banner.palette.text));
    expect(banner.actionBorder).toBe(rgb(banner.palette.primary));
    expect(banner.outline).toBe(rgb(banner.palette.border));
    expect(banner.description).not.toBe('rgb(95, 107, 122)');
  }
  for (let index = 0; index < 4; index++) await page.keyboard.press('ArrowLeft');
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await carousel.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
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
  const mobileGradients = await carousel.locator('[data-banner-service] .public-hero-carousel__media--illustrated')
    .evaluateAll(media => media.map(panel => getComputedStyle(panel, '::before').backgroundImage));
  for (const gradient of mobileGradients) {
    // CSSOM may omit the default 'to bottom' keyword; direction is verified
    // by --banner-fade-direction above. Assert the smooth stops, not serialization.
    expect(gradient).toContain('14%');
    expect(gradient).toContain('29%');
    expect(gradient).toContain('52%');
  }
  await expect(intro.locator('.public-information-hero__image')).toBeVisible();
});

test('service labels remain specific and concise in Bangla', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name !== 'desktop-1280';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'বাংলা' }).click();

  const carousel = page.getByRole('region', { name: 'কর পরিশোধের সেবা ব্যানার' });
  await carousel.focus();
  const translated = [
    ['রিটার্নের সঙ্গে কর', 'রিটার্নের সঙ্গে কর পরিশোধ'],
    ['অগ্রিম আয়কর', 'অগ্রিম আয়কর পরিশোধ'],
    [mobile ? 'উৎসে কর জমা' : 'উৎসে কর জমা (টিডিএস/টিসিএস)', 'উৎসে কর জমা দিন'],
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

test('desktop previous and next controls restore manual banner navigation without indicators', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Mobile uses touch swipe without arrows');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const previous = page.getByRole('button', { name: 'Previous banner' });
  const next = page.getByRole('button', { name: 'Next banner' });
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await expect(carousel.locator('.public-hero-carousel__indicator')).toHaveCount(0);
  await previous.click();
  await expect(carousel).toHaveAttribute('data-active-slide', '4');
  await next.click();
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
  await carousel.focus();
  for (let index = 1; index < 5; index++) {
    await page.keyboard.press('ArrowRight');
    await expect(carousel).toHaveAttribute('data-active-slide', String(index));
  }
  await page.keyboard.press('ArrowRight');
  await expect(carousel).toHaveAttribute('data-active-slide', '0');
});

test('dragging an illustration changes slides while a vertical gesture does not', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  const bounds = await carousel.locator('[data-banner-service="intro"] .public-hero-carousel__media--illustrated').boundingBox();
  expect(bounds).not.toBeNull();
  const y = bounds!.y + bounds!.height / 2;
  await page.mouse.move(bounds!.x + bounds!.width * .8, y);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * .2, y, { steps: 8 });
  await page.mouse.up();
  await expect(carousel).toHaveAttribute('data-active-slide', '1');

  const second = await carousel.locator('[data-banner-service="return"] .public-hero-carousel__media--illustrated').boundingBox();
  expect(second).not.toBeNull();
  await page.mouse.move(second!.x + second!.width / 2, second!.y + second!.height * .2);
  await page.mouse.down();
  await page.mouse.move(second!.x + second!.width / 2 + 20, second!.y + second!.height * .8, { steps: 8 });
  await page.mouse.up();
  await expect(carousel).toHaveAttribute('data-active-slide', '1');
});

test('touch-pointer swipe moves to the next banner on a narrow viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Mobile swipe test');
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

  for (const [banner, code, action] of services) {
    await carousel.focus();
    await page.keyboard.press('ArrowRight');
    await carousel.getByRole('button', { name: action, exact: true }).click();
    if (banner === 'travel') {
      // The named "Pay Travel Tax" CTA retains its dedicated passenger workflow.
      const travel = page.getByRole('dialog', { name: 'Travel tax' });
      await expect(travel.getByRole('navigation', { name: 'Travel tax steps' })).toBeVisible();
      await travel.getByRole('button', { name: 'Close modal' }).click();
    } else {
      const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
      await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
      await dialog.locator('[data-payer-relationship="SELF"]').click();
      await dialog.getByRole('button', { name: 'Continue' }).click();
      // The CTA has already selected the service. Keep that exact service
      // but do not ask the taxpayer to make the same decision a second time.
      await expect(dialog.locator('[data-payment-entry], #tax-service-other-type')).toHaveCount(0);
      await expect(dialog.getByRole('heading', { name: 'How would you like to continue?' })).toBeVisible();
      await expect(dialog.locator('.tax-service-choice__selected-service [data-payment-service]'))
        .toHaveAttribute('data-payment-service', code);
      // Back keeps the chosen taxpayer and never reintroduces a second chooser.
      await dialog.locator('.tax-service-choice__actions')
        .getByRole('button', { name: 'Back', exact: true }).click();
      await expect(dialog.locator('[data-payer-relationship="SELF"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.locator('[data-payment-entry]')).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Close payment services' }).click();
    }
  }
});

test('mobile banner buttons and artwork remain readable at narrow widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 375, 390, 600]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/?action=landing');
    const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
    const intro = carousel.locator('[data-banner-service="intro"]');
    const dimensions = await intro.evaluate(slide => {
      const media = slide.querySelector<HTMLElement>('.public-information-hero__media')!;
      const image = slide.querySelector<HTMLImageElement>('.public-information-hero__image')!;
      const title = slide.querySelector<HTMLElement>('h1')!;
      const description = slide.querySelector<HTMLElement>('.citizen-public-hero__copy > p')!;
      return {
        mediaHeight: media.getBoundingClientRect().height,
        verticalZoom: image.getBoundingClientRect().height / media.getBoundingClientRect().height,
        titleSize: parseFloat(getComputedStyle(title).fontSize),
        descriptionSize: parseFloat(getComputedStyle(description).fontSize),
        imageFit: getComputedStyle(image).objectFit,
      };
    });
    expect(dimensions.mediaHeight).toBeGreaterThanOrEqual(184);
    expect(dimensions.verticalZoom).toBeCloseTo(1, 2);
    expect(dimensions.titleSize).toBeLessThanOrEqual(width <= 360 ? 22 : 23);
    expect(dimensions.descriptionSize).toBeLessThanOrEqual(14.1);
    expect(dimensions.imageFit).toBe('cover');
    await expect(carousel.locator('[data-banner-service="intro"] .public-guest-action')).toHaveCount(2);
    await expect(carousel.getByRole('button', { name: 'Check status' })).toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: 'Search payment records by reference' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous banner' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Next banner' })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('mobile banners have distinct concise copy, equal heights and one-line titles and subtitles in both languages', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop-1280', 'Mobile-only copy and layout contract');
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const language of ['en', 'bn'] as const) {
    for (const width of [320, 375, 390, 600]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto('/?action=landing');
      if (language === 'bn') await page.getByRole('button', { name: 'বাংলা' }).click();

      const carousel = page.locator('.public-hero-carousel');
      const bannerCopy = await carousel.locator('.public-hero-carousel__slide').evaluateAll(slides => slides.map(slide => {
        const heading = slide.querySelector<HTMLElement>('h1, h2')!;
        const description = slide.querySelector<HTMLElement>('.citizen-public-hero__copy > p')!;
        const mobileHeading = heading.querySelector<HTMLElement>('.public-hero-copy--mobile')!;
        const mobileDescription = description.querySelector<HTMLElement>('.public-hero-copy--mobile')!;
        const desktopHeading = heading.querySelector<HTMLElement>('.public-hero-copy--desktop')!;
        const media = slide.querySelector<HTMLElement>('.public-information-hero__media')!;
        return {
          slideHeight: slide.getBoundingClientRect().height,
          mediaY: media.getBoundingClientRect().y,
          mediaHeight: media.getBoundingClientRect().height,
          heading: mobileHeading.textContent || '',
          subtitle: mobileDescription.textContent || '',
          desktopCopyHidden: getComputedStyle(desktopHeading).display === 'none',
          titleOneLine: heading.scrollHeight <= parseFloat(getComputedStyle(heading).lineHeight) + 2,
          subtitleOneLine: description.scrollHeight <= parseFloat(getComputedStyle(description).lineHeight) + 2,
          titleFits: heading.scrollWidth <= heading.clientWidth + 1,
          subtitleFits: description.scrollWidth <= description.clientWidth + 1,
        };
      }));

      expect(new Set(bannerCopy.map(banner => banner.slideHeight)).size).toBe(1);
      expect(new Set(bannerCopy.map(banner => banner.mediaY)).size).toBe(1);
      expect(new Set(bannerCopy.map(banner => banner.mediaHeight)).size).toBe(1);
      for (const banner of bannerCopy) {
        expect(banner.desktopCopyHidden).toBe(true);
        expect([...banner.heading].length).toBeLessThanOrEqual(24);
        expect([...banner.subtitle].length).toBeLessThanOrEqual(34);
        expect(banner.titleOneLine).toBe(true);
        expect(banner.subtitleOneLine).toBe(true);
        expect(banner.titleFits).toBe(true);
        expect(banner.subtitleFits).toBe(true);
      }

      await expect(carousel.locator('.public-hero-carousel__controls')).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});


test('introductory banner payment button typography respects the 14px floor', async ({ page }) => {
  await page.goto('/?action=landing');
  const buttons = page.locator('[data-banner-service="intro"] .public-guest-action');
  await expect(buttons).toHaveCount(2);
  const fontSizes = await buttons.evaluateAll(elements =>
    elements.map(element => Number.parseFloat(getComputedStyle(element).fontSize)));
  for (const size of fontSizes) expect(size).toBeGreaterThanOrEqual(14);
});
