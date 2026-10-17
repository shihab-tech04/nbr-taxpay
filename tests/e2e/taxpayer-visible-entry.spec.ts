import { test, expect } from '@playwright/test';

test('default taxpayer entry exposes the fully designed interactive dashboard', async ({ page }) => {
  await page.goto('/?action=taxpayer_home');
  const example = page.getByRole('link', { name: 'Explore interactive dashboard' });
  await expect(example).toHaveAttribute('href', '?action=taxpayer_home&demoUser=user1');
  await example.click();
  await expect(page).toHaveURL(/action=taxpayer_home&demoUser=user1/);
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tax coverage' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Monthly activity' })).toBeVisible();
});

test('ordinary taxpayer dashboard leads with recorded category totals, not invented credits', async ({ page }) => {
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'Explore taxpayer workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
  const metrics = page.getByRole('region', { name: 'Payment records summary' });
  await expect(metrics).toContainText('Recorded income tax');
  await expect(metrics).toContainText('৳ 25,000');
  await expect(metrics).toContainText('Recorded source tax');
  await expect(metrics).toContainText('Recorded travel tax');
  await expect(metrics).toContainText('Payment records');
  await expect(page.getByText(/verified liability and tax credit not connected/i)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Payment composition' })).toBeVisible();
  await page.locator('main').getByRole('button', { name: 'Tax Ledger', exact: true }).click();
  await expect(page).toHaveURL(/action=ledger/);
});

test('Bengali demo entry preserves language when moving to the interactive view', async ({ page }) => {
  await page.goto('/?action=taxpayer_home&lang=bn');
  const example = page.getByRole('link', { name: 'ইন্টারঅ্যাকটিভ ড্যাশবোর্ড দেখুন' });
  await expect(example).toHaveAttribute('href', '?action=taxpayer_home&demoUser=user1&lang=bn');
  await example.click();
  await expect(page).toHaveURL(/action=taxpayer_home&demoUser=user1&lang=bn/);
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ড্যাশবোর্ড সারসংক্ষেপ' })).toBeVisible();
});
