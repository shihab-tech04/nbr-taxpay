import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { expect, test, type Locator } from '@playwright/test';

async function choosePayer(dialog: Locator, mode: 'SELF' | 'OTHER' = 'SELF') {
  await dialog.locator(`[data-payer-relationship="${mode}"]`).click();
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
}

test('Service selector preserves geometry and uses icon, text and radio cues for selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();

  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  const cards = chooser.locator('[data-payer-relationship]');
  await expect(cards).toHaveCount(2);
  // The approved dialog intentionally opens at 99% scale before easing to
  // 100%. Capture the baseline only after that entrance animation finishes.
  // Do not hide real card displacement by increasing the 0.5px tolerance.
  await chooser.evaluate(async dialog => {
    await Promise.all(dialog.getAnimations({ subtree: false })
      .filter(animation => animation.playState === 'running')
      .map(animation => animation.finished));
  });
  await expect(cards.first()).toHaveCSS('flex-direction', 'row');

  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  // The two decisions are full-width horizontal rows at every viewport, including desktop.
  expect(Math.abs(first!.x - second!.x)).toBeLessThan(2);
  expect(Math.abs(first!.width - second!.width)).toBeLessThan(2);
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);

  const iconColors = await cards.evaluateAll(rows => rows.map(row =>
    getComputedStyle(row.querySelector('.tax-service-choice__icon')!).color
  ));
  expect(new Set(iconColors).size).toBe(2);

  const idleBorders = await cards.evaluateAll(rows => rows.map(row => {
    const style = getComputedStyle(row);
    return { color: style.borderTopColor, topWidth: style.borderTopWidth, leftWidth: style.borderLeftWidth, shadow: style.boxShadow };
  }));
  expect(new Set(idleBorders.map(border => border.color)).size).toBe(1);
  expect(idleBorders.every(border => border.topWidth === '1px' && border.leftWidth === '1px' && border.shadow === 'none')).toBe(true);
  expect(await cards.first().evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');

  const returnService = cards.nth(0);
  const advanceService = cards.nth(1);
  // Revealing the second decision increases dialog height and intentionally recenters it.
  // Keep icon/text/radio alignment stable *within the card*, not in viewport coordinates.
  const coordinates = () => returnService.evaluate(card => {
    const cardRect = card.getBoundingClientRect();
    const getOrigin = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x - cardRect.x, y: rect.y - cardRect.y };
    };
    return {
      icon: getOrigin(card.querySelector('.tax-service-choice__icon')!),
      title: getOrigin(card.querySelector('strong')!),
      radio: getOrigin(card.querySelector('.tax-service-choice__radio')!)
    };
  });
  const expectStablePositions = async (before: Awaited<ReturnType<typeof coordinates>>) => {
    // The approved modal uses height and content transitions. Assert exact
    // final alignment instead of sampling the changing intermediate geometry.
    await expect.poll(async () => {
      const after = await coordinates();
      return (['icon', 'title', 'radio'] as const).every(part =>
        Math.abs(after[part].x - before[part].x) < .5 &&
        Math.abs(after[part].y - before[part].y) < .5);
    }, { timeout: 6500, intervals: [50, 100, 150, 250] }).toBe(true);
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

test('Three progressive decisions toggle independently and finish in one modal', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  const next = dialog.getByRole('button', { name: 'Continue', exact: true });
  const self = dialog.locator('[data-payer-relationship="SELF"]');
  const other = dialog.locator('[data-payer-relationship="OTHER"]');
  const returnTax = dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]');
  const otherTax = dialog.locator('[data-payment-entry="OTHER_TAX"]');
  const guest = dialog.locator('[data-payment-access="GUEST"]');
  const account = dialog.locator('[data-payment-access="ACCOUNT"]');
  await expect(next).toBeDisabled();
  await expect(returnTax).toHaveCount(0);
  await expect(guest).toHaveCount(0);

  await self.click();
  await expect(returnTax).toBeVisible();
  await expect(otherTax).toBeVisible();
  await expect(guest).toHaveCount(0);
  await expect(next).toBeDisabled();
  // Both tax choices share one row at desktop width.
  const first = await returnTax.boundingBox();
  const second = await otherTax.boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
  expect(second!.x).toBeGreaterThan(first!.x + first!.width - 1);

  await returnTax.click();
  await expect(returnTax).toHaveAttribute('aria-pressed', 'true');
  await expect(guest).toBeVisible();
  await expect(account).toBeVisible();
  await expect(guest).toHaveAttribute('aria-pressed', 'false');
  await expect(next).toBeDisabled();
  await returnTax.click();
  await expect(returnTax).toHaveAttribute('aria-pressed', 'false');
  await expect(guest).toHaveCount(0);
  await expect(next).toBeDisabled();

  await otherTax.click();
  await guest.click();
  await expect(guest).toHaveAttribute('aria-pressed', 'true');
  await expect(next).toBeEnabled();
  await guest.click();
  await expect(guest).toHaveAttribute('aria-pressed', 'false');
  await expect(next).toBeDisabled();
  await account.click();
  await expect(next).toBeEnabled();

  await self.click();
  await expect(self).toHaveAttribute('aria-pressed', 'false');
  await expect(otherTax).toHaveCount(0);
  await expect(next).toBeDisabled();
  await other.click();
  await expect(otherTax).toHaveAttribute('aria-pressed', 'true');
  await expect(account).toHaveAttribute('aria-pressed', 'true');
  await expect(next).toBeEnabled();
});

test('Every selected payment service has readable title, description and icon contrast', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const cards = page.getByRole('dialog', { name: 'Pay Tax' }).locator('[data-payer-relationship]');

  for (let index = 0; index < 2; index++) {
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


test('Other Tax proceeds directly without an additional payment-type selector', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await choosePayer(dialog, 'OTHER');
  await expect(dialog.locator('[data-payment-entry]')).toHaveCount(2);
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await expect(dialog.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
  await expect(dialog.getByText('Other tax payment type')).toHaveCount(0);
  const originalUrl = page.url();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByText('Step 1 of 4')).toBeVisible();
  await expect(dialog.locator('.tax-service-choice__selected-service')).toContainText('Other Tax Payment');
  await expect(dialog.getByText('Step 1 of 4')).toBeVisible();
  await expect(dialog.locator('.tax-service-choice__selected-service [data-payment-service]')).toHaveAttribute('data-payment-service', 'OTHER_TAX_PAYMENT');
  await expect(dialog.locator('.tax-service-choice__selected-service')).toContainText("Facilitate another taxpayer’s payment");
  await expect(dialog.locator('.tax-service-choice__selected-service')).not.toContainText('Other Tax Payment & Travel Tax');
  await expect(dialog.locator('.payment-form-summary__rows [data-payment-service]')).toHaveCount(0);
  const visiblePayerText = await dialog.locator('.tax-service-choice__selected-service')
    .evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(visiblePayerText).toBeGreaterThanOrEqual(14);
  expect(page.url()).toBe(originalUrl);
});

test('Tax with Return still proceeds with its unchanged service ID', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await choosePayer(dialog, 'SELF');
  await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('.tax-service-choice__selected-service [data-payment-service]')).toHaveAttribute('data-payment-service', 'TAX_WITH_RETURN');
  await expect(dialog.locator('#guest-tin')).toBeVisible();
  await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
});

test('Back preserves payer and Other Tax choice without restoring the removed dropdown', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await choosePayer(dialog, 'SELF');
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.locator('.payment-flow-embedded__footer-actions').getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
  await expect(dialog.locator('[data-payer-relationship="SELF"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('[data-payment-access="GUEST"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Combined payer and account choices retain selection through login and Back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.locator('[data-payment-access]')).toHaveCount(0);
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await expect(dialog.locator('[data-payment-access]')).toHaveCount(2);
  const guest = dialog.locator('[data-payment-access="GUEST"]');
  const account = dialog.locator('[data-payment-access="ACCOUNT"]');
  await expect(guest).toHaveAttribute('aria-pressed', 'false');
  await account.click();
  await expect(account).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await expect(login).toBeVisible();
  await expect(login.locator('.taxpay-modal__back')).toBeVisible();
  await expect(login.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  await login.locator('.taxpay-modal__back').click();
  await expect(dialog.locator('[data-payment-access="ACCOUNT"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('[data-payer-relationship="SELF"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Other Tax keeps the v11 guest reference and four payment stages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await choosePayer(dialog, 'SELF');
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('.tax-service-choice__selected-service')).toContainText('My tax liability');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText('Step 2 of 4')).toBeVisible();
});

test('Travel Tax remains separately accessible from its existing public banner', async ({ page }) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const travel = page.getByRole('dialog', { name: 'Travel tax' });
  await expect(travel).toBeVisible();
  await expect(travel.locator('.travel-flow')).toBeVisible();
  await expect(travel.locator('#travel-tax-route-results input[type="radio"]')).toHaveCount(6);
});

test('Existing Travel Tax banner still provides journey, passenger and payment validation', async ({ page }) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const travel = page.getByRole('dialog', { name: 'Travel tax' });
  await travel.locator('#travel-tax-route-1').check();
  await expect(travel.locator('.travel-flow__total')).toContainText('2,000');
  await travel.getByRole('button', { name: 'Continue to passenger details' }).click();
  await expect(travel.getByLabel('Passenger name')).toBeVisible();
  await travel.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await travel.getByLabel('Passport number').fill('TRAVEL123');
  await travel.getByLabel('Mobile number for receipt').fill('01712345678');
  await travel.getByLabel('Travel date').fill('2026-10-25');
  await travel.getByRole('button', { name: 'Continue to review' }).click();
  await expect(travel.getByRole('heading', { name: 'Review travel details' })).toBeVisible();
  await expect(travel.getByRole('button', { name: 'Continue payment' })).toBeDisabled();
  await expect(travel.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
});

test('Declined Travel Tax payment never issues a receipt', async ({ page }) => {
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const travel = page.getByRole('dialog', { name: 'Travel tax' });
  await travel.locator('#travel-tax-route-0').check();
  await travel.getByRole('button', { name: 'Continue to passenger details' }).click();
  await travel.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await travel.getByLabel('Passport number').fill('TRAVEL123');
  await travel.getByLabel('Mobile number for receipt').fill('01712345678');
  await travel.getByLabel('Travel date').fill('2026-10-25');
  await travel.getByRole('button', { name: 'Continue to review' }).click();
  await travel.getByRole('button', { name: 'Pay online' }).click();
  await travel.getByRole('button', { name: 'Mobile banking' }).click();
  await travel.getByRole('radio', { name: 'Nagad' }).check();
  await travel.getByRole('checkbox', { name: 'Show declined payment outcome' }).check();
  await travel.getByLabel('The journey, passenger details and amount are correct.').check();
  await travel.getByRole('button', { name: 'Continue payment' }).click();
  await expect(travel.getByRole('alert')).toContainText('Simulated payment declined', { timeout: 12000 });
  await expect(travel.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
});
