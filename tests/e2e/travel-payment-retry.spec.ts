import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails } from './travel-tax-test-helper';

for (const refresh of [false, true]) {
test('Travel Tax resends the identical payment after a lost response ' +
  (refresh ? 'and refresh' : 'in the same form'), async ({ page }) => {
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
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button', { name: 'Add passenger', exact: true }).click();
  await modal.getByRole('button', { name: 'Add another passenger' }).click();
  const people = modal.getByTestId('travel-passenger-list').locator('.travel-flow__person');
  await expect(people).toHaveCount(2);
  const second = people.nth(1);
  await second.getByRole('tab', { name: 'Foreign passenger' }).click();
  await second.locator('input[id^="travel-passport-"]').fill('B7654321');
  await second.locator('input[id^="travel-name-"]').fill('FRIEND SECOND');
  await second.locator('input[id^="travel-birth-date-"]').fill('2017-08-10');
  await second.locator('input[id^="travel-country-"]').fill('India');
  await modal.getByRole('button', { name: 'Add passenger', exact: true }).click();
  await fillTravelDetails(modal);
  await modal.getByRole('button', { name: 'Continue to review' }).click();
  await modal.getByRole('button', { name: 'Pay online' }).click();
  await modal.getByRole('button', { name: 'Mobile banking' }).click();
  await modal.getByRole('radio', { name: 'Nagad' }).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  const submit = modal.getByRole('button', { name: 'Confirm preview payment' });
  await submit.click();
  await expect(modal.getByRole('alert')).toContainText('Retry with the same details');
  if (refresh) {
    await page.goto('/');
    await openTravelTaxFromBanner(page);
    await expect(modal.getByRole('heading', { name: 'Payment confirmation pending' })).toBeVisible();
    await modal.getByRole('button', { name: 'Retry payment confirmation' }).click();
  } else {
    await submit.click();
  }
  await expect(modal.locator('.receipt-view__paper')).toBeVisible();
  const receipt = modal.getByTestId('travel-family-challan');
  await expect(receipt.locator('tbody tr')).toHaveCount(2);
  await expect(receipt).toContainText('SAMPLE BANGLADESHI PASSENGER');
  await expect(receipt).toContainText('FRIEND SECOND');
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
  const submitted = JSON.parse(requests[0]) as {
    amountMinor: number;
    details?: { passengers?: Array<{ name: string; passportMasked: string; amount: number }> };
  };
  expect(submitted.amountMinor).toBe(150000);
  expect(submitted.details?.passengers?.map(passenger =>
    [passenger.name, passenger.passportMasked, passenger.amount])).toEqual([
      ['SAMPLE BANGLADESHI PASSENGER', '••••3456', 1000],
      ['FRIEND SECOND', '••••4321', 500],
    ]);
  expect(await page.evaluate(() => Object.keys(sessionStorage)
    .filter(key => key.startsWith('taxpay-travel-payment:')))).toEqual([]);
});
}
