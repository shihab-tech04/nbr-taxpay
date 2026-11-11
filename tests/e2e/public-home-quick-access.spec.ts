import { expect, test } from '@playwright/test';

test('guest quick access reuses Pay Tax and Travel Tax journeys', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  const quick = page.locator('.public-quick-access');
  await expect(quick.getByRole('heading', { name: 'Quick access' })).toBeVisible();
  await expect(quick.locator('.public-quick-access__item')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Find a payment record' })).toBeVisible();

  await quick.locator('[data-service="tax"]').click();
  const tax = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(tax).toBeVisible();
  await tax.getByRole('button', { name: 'Close modal' }).click();

  await quick.locator('[data-service="travel"]').click();
  const travel = page.getByRole('dialog', { name: /Travel tax/i });
  await expect(travel).toBeVisible();
  await travel.getByRole('button', { name: 'Close modal' }).click();
});

test('account-only quick links retain the normal sign-in gate', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-quick-access [data-service="corrections"]').click();
  await expect(page).toHaveURL(/action=corrections/);
  await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible();

  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-quick-access [data-service="certificates"]').click();
  await expect(page).toHaveURL(/action=certificates/);
  await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible();
});

test('mobile quick access keeps the approved bottom navigation and Bengali copy', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?action=landing&lang=bn');
  const quick = page.locator('.public-quick-access');
  await expect(quick.getByRole('heading', { name: 'দ্রুত সেবা' })).toBeVisible();
  await expect(quick.locator('.public-quick-access__item')).toHaveCount(4);
  await expect(page.getByRole('navigation', { name: 'Mobile primary navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'পেমেন্ট রেকর্ড খুঁজুন' })).toBeVisible();
  const sizes = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  expect(sizes.document - sizes.viewport).toBeLessThanOrEqual(2);
  await quick.locator('[data-service="travel"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
