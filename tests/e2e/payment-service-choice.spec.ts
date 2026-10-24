import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('Payer selector preserves geometry and uses icon, text and radio cues for selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();

  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  const cards = chooser.locator('.tax-service-choice__card');
  await expect(cards).toHaveCount(2);
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

test('Every selected payer choice has readable title, description and icon contrast', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const cards = page.getByRole('dialog', { name: 'Pay Tax' }).locator('.tax-service-choice__card');

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


test('Back and Continue are compact, and the next screen contains no extra tax-type choices', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  const footer = dialog.locator('.tax-service-choice__actions');
  const next = footer.getByRole('button', { name: 'Continue', exact: true });
  await expect(next).toBeDisabled();
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await expect(next).toBeEnabled();
  const buttonBox = await next.boundingBox();
  const dialogBox = await dialog.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  expect(buttonBox!.height).toBeGreaterThanOrEqual(48);
  expect(buttonBox!.width).toBeLessThan(240);
  expect(buttonBox!.x + buttonBox!.width).toBeGreaterThan(dialogBox!.x + dialogBox!.width - 44);
  await next.click();
  await expect(dialog.getByRole('heading', { name: 'How would you like to continue?' })).toBeVisible();
  await expect(dialog.locator('[data-payment-entry], #tax-service-other-type')).toHaveCount(0);
  await expect(footer.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
  await footer.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.locator('[data-payer-relationship="SELF"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Payer-first entry preserves guest payment without changing the current URL', async ({ page }) => {
  await page.goto('/');
  const url = page.url();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN');
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(dialog.getByText('Step 1 of 4')).toBeVisible();
  await expect(dialog.locator('.payment-form-payer-confirmation')).toContainText('My own tax');
  await expect(dialog.locator('.tax-service-choice__selected-service')).toContainText('Tax with Return');
  await expect(dialog.locator('[data-payment-entry], #tax-service-other-type')).toHaveCount(0);
  expect(page.url()).toBe(url);
});

test('Access gateway retains both guest and account entry buttons with aligned layouts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'PENALTY');
  const guest = dialog.getByRole('button', { name: 'Continue without signing in' });
  const account = dialog.getByRole('button', { name: 'Continue with my account' });
  await expect(guest).toBeVisible();
  await expect(account).toBeVisible();
  const gb = await guest.boundingBox();
  const ab = await account.boundingBox();
  const db = await dialog.boundingBox();
  expect(gb).not.toBeNull();
  expect(ab).not.toBeNull();
  expect(db).not.toBeNull();
  expect(db!.width).toBeLessThanOrEqual(704);
  expect(Math.abs(gb!.x - ab!.x)).toBeLessThan(2);
  expect(Math.abs(gb!.width - ab!.width)).toBeLessThan(2);
  expect(ab!.y).toBeGreaterThan(gb!.y + gb!.height);
  await account.click();
  await expect(page.getByRole('dialog', { name: /sign in/i })).toBeVisible();
});

test('All eight preserved services retain their downstream forms by direct QA referral only', async ({ page }) => {
  const serviceIds = ['TAX_WITH_RETURN', 'ADVANCE_TAX', 'ASSESSED_DEMAND', 'PENALTY',
    'SOURCE_TAX_DEPOSIT', 'APPELLATE_TRIBUNAL', 'OTHER_TAX_PAYMENT', 'TRAVEL_TAX'];
  for (const id of serviceIds) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
    await enterTaxPayService(dialog, id);
    await expect(dialog.locator(`[data-payment-service="${id}"]`)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Continue with my account' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
    await expect(dialog.getByText('Step 1 of 4')).toBeVisible();
    await expect(dialog.locator('[data-payment-entry], #tax-service-other-type')).toHaveCount(0);
  }
});

test('Source tax and travel forms preserve their specialized entry fields', async ({ page }) => {
  for (const [id, payer] of [['SOURCE_TAX_DEPOSIT', 'SELF'], ['TRAVEL_TAX', 'OTHER']] as const) {
    await page.goto('/');
    const url = page.url();
    await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
    await enterTaxPayService(dialog, id, payer);
    await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
    await expect(dialog.getByText('Step 1 of 4')).toBeVisible();
    if (id === 'TRAVEL_TAX') await expect(dialog.getByLabel('Passenger name')).toBeVisible();
    else {
      await expect(dialog.locator('.tax-service-choice__selected-service')).toContainText('Source Tax Deposit');
      await expect(dialog.locator('#guest-category')).toHaveCount(0);
    }
    expect(page.url()).toBe(url);
  }
});
test('Travel Tax keeps Back left, Continue right and route calculation available across steps', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Desktop journey alignment');
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TRAVEL_TAX');
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  const footer = dialog.locator('.travel-flow__footer-actions');
  const summary = dialog.locator('.travel-flow__summary');
  await expect(summary).toContainText('Payment calculation');
  await expect(footer.getByRole('button').first()).toHaveText('Back');
  await dialog.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await dialog.getByLabel('Passport number').fill('TRAVEL123');
  await dialog.getByLabel('Mobile number for receipt').fill('01712345678');
  await dialog.getByLabel('Travel date').fill('2026-10-25');
  await footer.getByRole('button').last().click();
  await expect(dialog.getByText('Step 2 of 4')).toBeVisible();
  await expect(dialog.locator('#travel-tax-route-results')).toBeVisible();
  await dialog.locator('#travel-tax-route-1').check();
  await expect(summary.locator('.travel-flow__total')).toContainText('2,000');
  const back = await footer.getByRole('button').first().boundingBox();
  const next = await footer.getByRole('button').last().boundingBox();
  expect(back).not.toBeNull();
  expect(next).not.toBeNull();
  expect(back!.x + back!.width).toBeLessThan(next!.x);
  await footer.getByRole('button').last().click();
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  await expect(summary).toContainText('Payment calculation');
});

test('Other Tax Payment uses the v11 optional guest NBR reference', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(chooser, 'OTHER_TAX_PAYMENT');
  await chooser.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(chooser.locator('.payment-form-payer-confirmation')).toContainText('My own tax');
  await chooser.locator('#guest-tin').fill('123456789012');
  await chooser.locator('#guest-phone').fill('01712345678');
  await chooser.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(chooser.getByText('Step 2 of 4')).toBeVisible();
});

test('Travel Tax uses identity, calculated amount, channel and confirmation inside the service modal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(chooser, 'TRAVEL_TAX');
  await chooser.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(chooser.getByText('Step 1 of 4')).toBeVisible();
  await chooser.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await chooser.getByLabel('Passport number').fill('FAKE0001');
  await chooser.getByLabel('Mobile number for receipt').fill('01712345678');
  await chooser.getByLabel('Travel date').fill('2026-10-25');
  await chooser.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(chooser.getByText('Step 2 of 4')).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'Choose destination & travel mode' })).toBeVisible();
  await chooser.locator('#travel-tax-route-0').check();
  await expect(chooser.getByText('Payment purpose: Travel Tax')).toBeVisible();
  await chooser.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(chooser.getByText('Step 3 of 4')).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'Choose payment channel' })).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Confirm payment' })).toBeDisabled();
  await chooser.getByRole('button', { name: 'Pay online' }).click();
  await chooser.getByRole('button', { name: 'Mobile banking' }).click();
  await chooser.getByRole('radio', { name: 'Nagad' }).check();
  await chooser.getByLabel('The journey, passenger details and amount are correct.').check();
  await chooser.getByRole('button', { name: 'Confirm payment' }).click();
  await expect(chooser.getByText('Step 4 of 4')).toBeVisible();
  await expect(chooser.getByText('Travel tax details ready')).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
});

test('Travel Tax uses the same grouped providers and preserves declined simulation without issuing a receipt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TRAVEL_TAX');
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  await dialog.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await dialog.getByLabel('Passport number').fill('FAKE0001');
  await dialog.getByLabel('Mobile number for receipt').fill('01712345678');
  await dialog.getByLabel('Travel date').fill('2026-10-25');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await dialog.locator('#travel-tax-route-0').check();
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await expect(dialog.locator('.payment-review__method-groups button')).toHaveCount(3);
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'Nagad' }).check();
  await dialog.getByRole('checkbox', { name: 'Show declined payment outcome' }).check();
  await dialog.getByLabel('The journey, passenger details and amount are correct.').check();
  await dialog.getByRole('button', { name: 'Confirm payment' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Simulated payment declined');
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
});
