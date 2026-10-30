import { expect, test, type Page } from '@playwright/test';

async function verifyProgress(page: Page, bn: boolean) {
  await page.goto('/?action=wizard&demoUser=user1' + (bn ? '&lang=bn' : ''));
  const payment = page.getByRole('region', { name: bn ? 'নতুন পেমেন্ট' : 'New payment' });
  const progress = payment.getByRole('list', { name: bn ? 'পেমেন্টের ধাপ' : 'Payment steps' });
  await expect(progress.locator('li')).toHaveCount(4);
  await expect(progress.locator('li[data-progress-status="current"]')).toHaveCount(1);
  await expect(progress.locator('li').nth(2)).toContainText(bn ? 'পেমেন্ট ও পর্যালোচনা' : 'Payment and review');

  await payment.locator('[data-payment-service="TAX_WITH_RETURN"]').click();
  await expect(progress.locator('li[data-progress-status="complete"]')).toHaveCount(1);
  await expect(progress.locator('li[data-progress-status="current"]')).toHaveCount(1);
  await expect(progress.locator('li[data-progress-status="upcoming"]')).toHaveCount(2);

  await payment.getByRole('button', { name: bn ? /পেমেন্ট করুন/ : /Make Payment/ }).click();
  await expect(progress.locator('li[data-progress-status="complete"]')).toHaveCount(2);
  await expect(progress.locator('li[data-progress-status="current"]')).toHaveCount(1);
  await expect(progress.locator('li[data-progress-status="upcoming"]')).toHaveCount(1);
  await expect(progress.locator('li[data-progress-status="current"]')).toContainText(bn ? 'পেমেন্ট ও পর্যালোচনা' : 'Payment and review');
}

test('payment activity progress tracks one current stage in English', async ({ page }) => {
  await verifyProgress(page, false);
});

test('payment activity progress tracks one current stage in Bengali', async ({ page }) => {
  await verifyProgress(page, true);
});
