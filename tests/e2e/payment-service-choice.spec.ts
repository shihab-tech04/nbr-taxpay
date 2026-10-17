import { expect, test } from '@playwright/test';

test('Service selector uses one horizontal row per service, unique accent colors, and clear selection states', async ({ page }) => {
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
  expect(Math.abs(first!.x - second!.x)).toBeLessThan(2);
  expect(second!.y).toBeGreaterThan(first!.y + first!.height);

  const iconColors = await cards.evaluateAll(rows => rows.map(row =>
    getComputedStyle(row.querySelector('.tax-service-choice__icon')!).color
  ));
  expect(new Set(iconColors).size).toBe(8);

  const returnService = cards.nth(0);
  const advanceService = cards.nth(1);
  const unselectedBackground = await returnService.evaluate(row => getComputedStyle(row).backgroundColor);
  await returnService.click();
  await expect(returnService).toHaveAttribute('aria-pressed', 'true');
  await expect(returnService).not.toHaveCSS('background-color', unselectedBackground);
  await advanceService.click();
  await expect(returnService).toHaveAttribute('aria-pressed', 'false');
  await expect(returnService).toHaveCSS('background-color', unselectedBackground);
  await expect(advanceService).toHaveAttribute('aria-pressed', 'true');
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
  await expect(chooser.locator('#guest-category')).toHaveValue('SOURCE_TAX_DEPOSIT');
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
