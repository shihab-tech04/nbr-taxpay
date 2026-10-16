import { expect, test } from '@playwright/test';

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
  await expect(chooser.getByText('Source Tax Deposit', { exact: true }).last()).toBeVisible();
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
