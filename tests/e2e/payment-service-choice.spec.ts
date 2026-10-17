import { expect, test } from '@playwright/test';

test('Service selector keeps unique icon colors with neutral idle cards and accented selection', async ({ page }) => {
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
    return { color: style.borderTopColor, leftWidth: style.borderLeftWidth };
  }));
  expect(new Set(idleBorders.map(border => border.color)).size).toBe(1);
  expect(idleBorders.every(border => border.leftWidth === '1px')).toBe(true);

  const returnService = cards.nth(0);
  const advanceService = cards.nth(1);
  await returnService.click();
  await expect(returnService).toHaveAttribute('aria-pressed', 'true');
  await expect(returnService).toHaveCSS('border-left-width', '3px');
  await expect(returnService).toHaveCSS('background-color', 'rgb(238, 244, 255)');
  expect(await returnService.evaluate(el => getComputedStyle(el).borderTopColor)).not.toBe(idleBorders[0].color);
  await advanceService.click();
  await expect(returnService).toHaveAttribute('aria-pressed', 'false');
  await expect(returnService).toHaveCSS('border-left-width', '1px');
  await expect(returnService).toHaveCSS('border-top-color', idleBorders[0].color);
  await expect(returnService).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(advanceService).toHaveAttribute('aria-pressed', 'true');
  await expect(advanceService).toHaveCSS('border-left-width', '3px');
  await expect(advanceService.locator('.tax-service-choice__radio > span')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('Pay Tax opens the eight HTML-defined services and carries the chosen category to the form', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(chooser).toBeVisible();
  await expect(chooser.locator('.tax-service-choice__card')).toHaveCount(8);
  await expect(chooser.getByRole('button', { name: /Continue/ })).toBeDisabled();
  const advance = chooser.getByRole('button', { name: /Advance Tax/ });
  await advance.click();
  await expect(advance).toHaveAttribute('aria-pressed', 'true');
  const originalUrl = page.url();
  await chooser.getByRole('button', { name: /Continue/ }).click();
  await expect(chooser).toBeVisible();
  await expect(chooser.getByText('Step 2 of 4')).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'Payment calculation' })).toBeVisible();
  await expect(chooser.locator('.payment-form-section')).toHaveCount(4);
  await expect(chooser.getByText('Advance Tax', { exact: true }).last()).toBeVisible();
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
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'Payment calculation' })).toBeVisible();
  await expect(chooser.locator('.tax-service-choice__selected-service')).toContainText('Source Tax Deposit');
  await expect(chooser.locator('#guest-category')).toHaveCount(0);
  expect(page.url()).toBe(originalUrl);

  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await chooser.getByRole('button', { name: /Travel Tax/ }).click();
  await chooser.getByRole('button', { name: /Continue/ }).click();
  await expect(chooser).toBeVisible();
  await expect(chooser.locator('.travel-flow')).toBeVisible();
  await expect(chooser.getByRole('button', { name: 'Continue to passenger details' })).toBeVisible();
  expect(page.url()).toBe(originalUrl);
});
