import { expect, test } from '@playwright/test';

test('Service selector preserves geometry and uses icon, text and radio cues for selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();

  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  const cards = chooser.locator('.tax-service-choice__card');
  await expect(cards).toHaveCount(8);
  await expect(cards.first()).toHaveCSS('flex-direction', 'row');

  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    expect(second!.x).toBeGreaterThan(first!.x + first!.width);
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
  } else {
    expect(Math.abs(first!.x - second!.x)).toBeLessThan(2);
    expect(second!.y).toBeGreaterThan(first!.y + first!.height);
  }

  const iconColors = await cards.evaluateAll(rows => rows.map(row =>
    getComputedStyle(row.querySelector('.tax-service-choice__icon')!).color
  ));
  expect(new Set(iconColors).size).toBe(8);

  const idleBorders = await cards.evaluateAll(rows => rows.map(row => {
    const style = getComputedStyle(row);
    return { color: style.borderTopColor, topWidth: style.borderTopWidth, leftWidth: style.borderLeftWidth, shadow: style.boxShadow };
  }));
  expect(new Set(idleBorders.map(border => border.color)).size).toBe(1);
  expect(idleBorders.every(border => border.topWidth === '1px' && border.leftWidth === '1px' && border.shadow === 'none')).toBe(true);
  expect(await cards.first().evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');

  const returnService = cards.nth(0);
  const advanceService = cards.nth(1);
  const coordinates = () => returnService.evaluate(card => {
    const getOrigin = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    };
    return {
      icon: getOrigin(card.querySelector('.tax-service-choice__icon')!),
      title: getOrigin(card.querySelector('strong')!),
      radio: getOrigin(card.querySelector('.tax-service-choice__radio')!)
    };
  });
  const expectStablePositions = async (before: Awaited<ReturnType<typeof coordinates>>) => {
    const after = await coordinates();
    for (const part of ['icon', 'title', 'radio'] as const) {
      expect(Math.abs(after[part].x - before[part].x)).toBeLessThan(.5);
      expect(Math.abs(after[part].y - before[part].y)).toBeLessThan(.5);
    }
  };
  const before = await coordinates();
  const idleIconColor = await returnService.locator('.tax-service-choice__icon').evaluate(el => getComputedStyle(el).color);
  const idleTitleColor = await returnService.locator('strong').evaluate(el => getComputedStyle(el).color);
  const idleDescriptionColor = await returnService.locator('.tax-service-choice__description').evaluate(el => getComputedStyle(el).color);
  await returnService.click();
  await expect(returnService).toHaveAttribute('aria-pressed', 'true');
  await expect(returnService).toHaveCSS('border-left-width', '1px');
  await expect(returnService).toHaveCSS('border-top-width', '1px');
  await expect(returnService).toHaveCSS('background-color', 'rgb(238, 244, 255)');
  await expect(returnService).toHaveCSS('border-right-color', 'rgb(201, 216, 245)');
  await expect(returnService).toHaveCSS('border-left-color', 'rgb(49, 93, 170)');
  expect(await returnService.evaluate(el => getComputedStyle(el).borderTopColor)).not.toBe(idleBorders[0].color);
  expect(await returnService.evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
  const accent = await returnService.evaluate(el => getComputedStyle(el).boxShadow);
  expect(accent).toContain('inset');
  expect(accent).toContain('rgb(49, 93, 170)');
  await expectStablePositions(before);
  await expect(returnService.locator('.tax-service-choice__icon')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(await returnService.locator('.tax-service-choice__icon').evaluate(el => getComputedStyle(el).color)).not.toBe(idleIconColor);
  await expect(returnService.locator('strong')).toHaveCSS('font-weight', '700');
  expect(await returnService.locator('strong').evaluate(el => getComputedStyle(el).color)).not.toBe(idleTitleColor);
  expect(await returnService.locator('.tax-service-choice__description').evaluate(el => getComputedStyle(el).color)).not.toBe(idleDescriptionColor);
  await advanceService.click();
  await expect(returnService).toHaveAttribute('aria-pressed', 'false');
  await expect(returnService).toHaveCSS('border-left-width', '1px');
  await expect(returnService).toHaveCSS('border-top-width', '1px');
  await expect(returnService).toHaveCSS('border-top-color', idleBorders[0].color);
  await expect(returnService).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(returnService).toHaveCSS('box-shadow', 'none');
  await expectStablePositions(before);
  await expect(advanceService).toHaveAttribute('aria-pressed', 'true');
  await expect(advanceService).toHaveCSS('border-left-width', '1px');
  await expect(advanceService.locator('.tax-service-choice__radio > span')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('Every selected payment service has readable title, description and icon contrast', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const cards = page.getByRole('dialog', { name: 'Pay Tax' }).locator('.tax-service-choice__card');

  for (let index = 0; index < 8; index++) {
    const card = cards.nth(index);
    await card.click();
    const contrast = await card.evaluate(node => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = (value: string) => {
        const linear = rgb(value).map(channel => {
          const normalized = channel / 255;
          return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        });
        return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
      };
      const ratio = (foreground: string, background: string) => {
        const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        return (values[0] + .05) / (values[1] + .05);
      };
      const cardBackground = getComputedStyle(node).backgroundColor;
      const icon = node.querySelector<HTMLElement>('.tax-service-choice__icon')!;
      return {
        icon: ratio(getComputedStyle(icon).color, getComputedStyle(icon).backgroundColor),
        title: ratio(getComputedStyle(node.querySelector('strong')!).color, cardBackground),
        description: ratio(getComputedStyle(node.querySelector('.tax-service-choice__description')!).color, cardBackground)
      };
    });
    expect(contrast.icon).toBeGreaterThanOrEqual(3);
    expect(contrast.title).toBeGreaterThanOrEqual(4.5);
    expect(contrast.description).toBeGreaterThanOrEqual(4.5);
  }
});

test('Pay Tax opens the eight HTML-defined services and carries the chosen category to the form', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(chooser).toBeVisible();
  await expect(chooser.locator('.tax-service-choice__card')).toHaveCount(8);
  await expect(chooser.locator('.tax-service-choice__progress')).toHaveCount(0);
  await expect(chooser.getByRole('button', { name: /Continue/ })).toBeDisabled();
  const advance = chooser.getByRole('button', { name: /Advance Tax/ });
  await advance.click();
  await expect(advance).toHaveAttribute('aria-pressed', 'true');
  const originalUrl = page.url();
  await chooser.getByRole('button', { name: /Continue/ }).click();
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'How would you like to continue?' })).toBeVisible();
  await expect(chooser.locator('.tax-service-choice__progress')).toHaveCount(0);
  await chooser.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(chooser.getByText('Step 1 of 4')).toBeVisible();
  await expect(chooser.locator('.payment-form-section')).toHaveCount(2);
  await expect(chooser.locator('.tax-service-choice__selected-service')).toContainText('Advance Tax');
  expect(page.url()).toBe(originalUrl);
});

test('Source tax and travel tax stay inside the same modal with their category-specific forms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const originalUrl = page.url();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  let chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await chooser.getByRole('button', { name: /Source Tax Deposit/ }).click();
  await chooser.getByRole('button', { name: /Continue/ }).click();
  await chooser.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(chooser).toBeVisible();
  await expect(chooser.getByText('Step 1 of 4')).toBeVisible();
  await expect(chooser.locator('.tax-service-choice__selected-service')).toContainText('Source Tax Deposit');
  await expect(chooser.locator('#guest-category')).toHaveCount(0);
  expect(page.url()).toBe(originalUrl);

  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await chooser.getByRole('button', { name: /Travel Tax/ }).click();
  await chooser.getByRole('button', { name: /Continue/ }).click();
  await chooser.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(chooser).toBeVisible();
  await expect(chooser.locator('.travel-flow')).toBeVisible();
  await expect(chooser.getByText('Step 1 of 4')).toBeVisible();
  await expect(chooser.getByLabel('Passenger name (as in passport)')).toBeVisible();
  expect(page.url()).toBe(originalUrl);
});

test('All eight services offer the policy-approved guest payment path before Step 1', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  for (let i = 0; i < 8; i++) {
    await chooser.locator('.tax-service-choice__card').nth(i).click();
    await chooser.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(chooser.getByRole('button', { name: 'Continue with my account' })).toBeVisible();
    await expect(chooser.getByRole('button', { name: 'Continue without signing in' })).toBeVisible();
    await chooser.getByRole('button', { name: 'Continue without signing in' }).click();
    await expect(chooser.getByText('Step 1 of 4')).toBeVisible();
    if (i === 7) {
      await chooser.locator('.travel-flow__footer-actions').getByRole('button', { name: 'Back to services' }).click();
    } else {
      await chooser.locator('.payment-flow-embedded__footer-actions').getByRole('button', { name: 'Back to services' }).click();
    }
    await chooser.locator('.tax-service-choice__actions').getByRole('button', { name: 'Back to services' }).click();
  }
});

test('Other Tax Payment asks for its policy-required NBR reference before purpose and amount', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await chooser.getByRole('button', { name: /Other Tax Payment/ }).click();
  await chooser.getByRole('button', { name: 'Continue', exact: true }).click();
  await chooser.getByRole('button', { name: 'Continue without signing in' }).click();
  await chooser.locator('#guest-tin').fill('123456789012');
  await chooser.locator('#guest-phone').fill('01712345678');
  await chooser.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(chooser.getByRole('alert')).toContainText('NBR reference');
  await chooser.locator('#guest-notice-ref').fill('NBR-TEST-2026-01');
  await chooser.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(chooser.getByText('Step 2 of 4')).toBeVisible();
});

test('Travel Tax uses identity, calculated amount, channel and confirmation inside the service modal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await chooser.getByRole('button', { name: /Travel Tax/ }).click();
  await chooser.getByRole('button', { name: 'Continue', exact: true }).click();
  await chooser.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(chooser.getByText('Step 1 of 4')).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'Destination and travel mode' })).toBeVisible();
  await chooser.getByLabel('Passenger name (as in passport)').fill('SAMPLE TRAVELLER');
  await chooser.getByLabel('Passport reference').fill('FAKE0001');
  await chooser.getByLabel('Mobile number for receipt').fill('01712345678');
  await chooser.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(chooser.getByText('Step 2 of 4')).toBeVisible();
  await expect(chooser.getByText('Payment purpose: Travel Tax')).toBeVisible();
  await chooser.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(chooser.getByText('Step 3 of 4')).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'Choose payment channel' })).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Confirm payment' })).toBeDisabled();
  await chooser.getByRole('radio', { name: 'Nagad' }).check();
  await chooser.getByRole('button', { name: 'Confirm payment' }).click();
  await expect(chooser.getByText('Step 4 of 4')).toBeVisible();
  await expect(chooser.getByText('Travel tax details ready')).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
});
