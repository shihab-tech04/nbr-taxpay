import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails } from './travel-tax-test-helper';

test('Travel Tax resends the identical payment after a lost response', async ({ page }) => {
  test.skip(process.env.VITE_SUPABASE_URL !== 'https://travel-retry-test.invalid',
    'Run with the isolated Travel Tax fixture endpoint.');
  const requests: string[] = [];
  const paymentId = 'fd718297-1e32-421c-a951-987f4e92a991';
  await page.route('https://travel-retry-test.invalid/**', async route => {
    if (route.request().method() !== 'POST' ||
        !route.request().url().endsWith('/demo-story1-taxpay/payments')) {
      await route.fulfill({ status: 404, json: {} });
      return;
    }
    requests.push(route.request().postData() ?? '');
    if (requests.length === 1) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ json: {
      success: true, id: paymentId, status: 'SIMULATED_SUCCESS',
      mirrored: true, simulationOnly: true,
    } });
  });
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', { name: 'Travel tax' });
  await fillTravelDetails(modal);
  await modal.getByRole('button', { name: 'Continue to review' }).click();
  await modal.getByRole('button', { name: 'Pay online' }).click();
  await modal.getByRole('button', { name: 'Mobile banking' }).click();
  await modal.getByRole('radio', { name: 'Nagad' }).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  const submit = modal.getByRole('button', { name: 'Confirm preview payment' });
  await submit.click();
  await expect(modal.getByRole('alert')).toContainText('Retry with the same details');
  await submit.click();
  await expect(modal.locator('.receipt-view__paper')).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
});
