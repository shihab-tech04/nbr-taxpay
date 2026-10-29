import { expect, test } from '@playwright/test';

test('signed-in activity tracking stays inside the taxpayer workspace', async ({ page }) => {
  await page.goto('/?action=history&demoUser=user1');
  await expect(page.locator('[data-testid="user1-synthetic-workspace"]')).toBeVisible();
  await page.getByRole('navigation', { name: 'Activity sections' })
    .getByRole('button', { name: 'Track payment' }).click();

  await expect(page).toHaveURL(/action=activity_track/);
  await expect(page.getByRole('heading', { name: 'Payments & activity' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Track payment' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Activity sections' })
    .getByRole('button', { name: 'Track payment' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.taxpayer-reference-rail')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Payment status & receipt' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Challan, token or transaction reference' })).toBeVisible();

  // Existing receipt lookup remains functional without taking over the public shell.
  await page.locator('.receipt-lookup__sample').first().click();
  await expect(page.locator('.receipt-view')).toBeVisible();
  await expect(page.locator('.taxpayer-reference-rail')).toBeVisible();
  await page.getByRole('navigation', { name: 'Activity sections' })
    .getByRole('button', { name: 'Transactions' }).click();
  await expect(page).toHaveURL(/action=history/);
  await expect(page.locator('[data-testid="user1-synthetic-workspace"]')).toBeVisible();
});

test('tracking tab preserves Bangla labels and taxpayer shell', async ({ page }) => {
  await page.goto('/?action=history&demoUser=user1&lang=bn');
  const activity = page.getByRole('navigation', { name: 'লেনদেনের বিভাগ' });
  await activity.getByRole('button', { name: 'পেমেন্ট অনুসন্ধান' }).click();
  await expect(page).toHaveURL(/action=activity_track/);
  await expect(page.getByRole('heading', { name: 'পেমেন্ট ও লেনদেন' })).toBeVisible();
  await expect(page.locator('.taxpayer-reference-rail')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('public payment verification retains its existing homepage modal', async ({ page }) => {
  await page.goto('/?action=verify');
  await expect(page.getByRole('dialog', { name: 'Payment status & receipt' })).toBeVisible();
  await expect(page.locator('.taxpayer-reference-rail')).toHaveCount(0);
});

test('deep-linking to private tracking without a session does not expose taxpayer records', async ({ page }) => {
  await page.goto('/?action=activity_track');
  await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Payment status & receipt' })).toHaveCount(0);
});
