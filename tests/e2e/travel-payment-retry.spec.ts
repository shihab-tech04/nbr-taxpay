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
  let readbackCount = 0;
  await page.route('https://travel-retry-test.invalid/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': '*',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/demo-story1-taxpay/payments')) {
      requests.push(request.postData() ?? '');
      if (requests.length === 1) {
        await route.abort('failed');
        return;
      }
      await route.fulfill({ headers, json: {
        success: true, id: paymentId, status: 'SIMULATED_SUCCESS',
        mirrored: true, simulationOnly: true,
      } });
      return;
    }
    if (request.method() === 'GET') {
      const detail = url.pathname.endsWith('/demo-story1-taxpay/payments/' + paymentId);
      if (!detail || requests.length === 0) {
        await route.fulfill({ status: 200, headers, json: {
          success: true, simulationOnly: true, data: { items: [], total: 0 },
        } });
        return;
      }
      const saved = JSON.parse(requests[requests.length - 1]) as {
        sessionId: string; service: string; amountMinor: number; details: Record<string, unknown>;
      };
      expect(url.searchParams.get('sessionId')).toBe(saved.sessionId);
      readbackCount += 1;
      if (readbackCount === 1) {
        await route.fulfill({ status: 503, headers, json: { success: false, error: 'TEMPORARY_READBACK_FAILURE' } });
        return;
      }
      await route.fulfill({ status: 200, headers, json: {
        success: true, simulationOnly: true,
        data: { id: paymentId, status: 'SIMULATED_SUCCESS', createdAt: '2026-11-14T08:00:00.000Z',
          data: { ...saved, origin: 'TAXPAY_UI' } },
      } });
      return;
    }
    await route.fulfill({ status: 405, headers, json: { error: 'METHOD_NOT_ALLOWED' } });
  });
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', { name: 'Travel tax' });
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button', { name: 'Add passenger', exact: true }).click();
  await modal.locator('#travel-new-passport').focus();
  await expect(modal.locator('.travel-passenger-workspace__person')).toHaveCount(1);
  const second = modal.locator('.travel-passenger-workspace__entry');
  await expect(second).toBeVisible();
  await second.getByRole('tab', { name: 'Foreign passenger' }).click();
  await second.locator('input[id^="travel-passport-"]').fill('B7654321');
  await second.locator('input[id^="travel-name-"]').fill('FRIEND SECOND');
  await second.locator('input[id^="travel-birth-date-"]').fill('2017-08-10');
  await second.locator('input[id^="travel-country-"]').fill('India');
  await modal.getByRole('button', { name: 'Add passenger', exact: true }).click();
  await fillTravelDetails(modal);
  await modal.getByRole('button', { name: 'Continue to review' }).click();
  // Confirm the separate Final Preview receipt contact gate before checkout.
  await expect(modal.locator('#travel-mobile')).toBeVisible();
  await modal.getByRole('button', { name: 'Make Payment' }).click();
  await expect(modal.getByRole('alert')).toContainText('11-digit receipt mobile number');
  await modal.locator('#travel-mobile').fill('01712345678');
  await modal.getByRole('button', { name: 'Make Payment' }).click();
  await expect(modal.getByTestId('travel-payment-channel-screen')).toBeVisible();
  const confirmPreview = modal.getByRole('button', { name: 'Confirm sample payment' });
  await expect(confirmPreview).toBeDisabled();
  await modal.getByRole('button', { name: 'Pay online' }).click();
  await modal.getByRole('button', { name: 'Mobile banking' }).click();
  await modal.getByRole('radio', { name: 'Nagad' }).check();
  await modal.getByLabel(/I confirm the travel information/).check();
  const submit = modal.getByRole('button', { name: 'Confirm sample payment' });
  await expect(submit).toBeEnabled();
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

  // The write acknowledgement still cannot display success. A failed SQL detail
  // read leaves the exact original request available for a same-key retry.
  await expect.poll(() => readbackCount).toBe(1);
  const readbackRetryMessage = refresh
    ? 'Payment confirmation is still unavailable. Retry again.'
    : 'Simulated payment could not be recorded. Retry with the same details.';
  await expect(modal.getByRole('alert')).toContainText(readbackRetryMessage);
  await expect(modal.locator('.receipt-view__paper')).toHaveCount(0);
  if (refresh) {
    await page.goto('/');
    await openTravelTaxFromBanner(page);
    await expect(modal.getByRole('heading', { name: 'Payment confirmation pending' })).toBeVisible();
    await modal.getByRole('button', { name: 'Retry payment confirmation' }).click();
  } else {
    await submit.click();
  }
  // Refresh restoration may independently re-read the same SQL row; repeated
  // GET verification is safe and must not be confused with extra payment POSTs.
  await expect.poll(() => readbackCount).toBeGreaterThanOrEqual(2);
  await expect(modal.getByTestId('travel-payment-result')).toBeVisible({timeout:15000});
  await modal.getByTestId('walkin-challan-action').getByRole('button').first().click();
  await expect(modal.locator('.receipt-view__paper')).toBeVisible();
  const receipt = modal.getByTestId('travel-family-challan');
  await expect(receipt.locator('tbody tr')).toHaveCount(2);
  await expect(receipt).toContainText('SAMPLE BANGLADESHI PASSENGER');
  await expect(receipt).toContainText('FRIEND SECOND');
  expect(requests).toHaveLength(3);
  expect(requests[1]).toBe(requests[0]);
  expect(requests[2]).toBe(requests[0]);
  const submitted = JSON.parse(requests[0]) as {
    amountMinor: number;
    details?: {
      passengers?: Array<{ name: string; passportMasked: string; amount: number }>;
      travelRateEvidence?: {
        referenceVersion: string;
        classification: string;
        source: string;
        mode: string;
        economicCode: string;
        currency: string;
        adultUnitRateMinor: number;
        ageBands: Array<{ band: string; minAgeInclusive: number; maxAgeInclusive: number | null; multiplierBps: number }>;
      };
      lines?: Array<{ totalAmount: number; economicCode: string }>;
      receiptSnapshot?: { totalAmount: number; items: Array<{ totalAmount: number; economicCode: string }> };
    };
  };
  expect(submitted.amountMinor).toBe(150000);
  expect(submitted.details?.passengers?.map(passenger =>
    [passenger.name, passenger.passportMasked, passenger.amount])).toEqual([
      ['SAMPLE BANGLADESHI PASSENGER', '••••3456', 1000],
      ['FRIEND SECOND', '••••4321', 500],
    ]);
  expect(submitted.details?.travelRateEvidence).toEqual({
    referenceVersion: 'APP_PREVIEW_2026-11-02',
    classification: 'ILLUSTRATIVE',
    source: 'IN_APP_PREVIEW',
    mode: 'LAND',
    economicCode: '1144102',
    currency: 'BDT',
    adultUnitRateMinor: 100000,
    ageBands: [
      { band: 'UNDER5', minAgeInclusive: 0, maxAgeInclusive: 5, multiplierBps: 0 },
      { band: 'CHILD', minAgeInclusive: 6, maxAgeInclusive: 12, multiplierBps: 5000 },
      { band: 'ADULT', minAgeInclusive: 13, maxAgeInclusive: null, multiplierBps: 10000 },
    ],
  });
  const detailLineMinor = submitted.details?.lines?.map(line => Math.round(line.totalAmount * 100));
  const receiptLineMinor = submitted.details?.receiptSnapshot?.items.map(line => Math.round(line.totalAmount * 100));
  expect(detailLineMinor).toEqual([100000, 50000]);
  expect(receiptLineMinor).toEqual(detailLineMinor);
  expect(detailLineMinor?.reduce((sum, amount) => sum + amount, 0)).toBe(submitted.amountMinor);
  expect(submitted.details?.receiptSnapshot?.totalAmount).toBe(1500);
  await expect(receipt).toContainText('1,000');
  await expect(receipt).toContainText('500');
  expect(await page.evaluate(() => Object.keys(sessionStorage)
    .filter(key => key.startsWith('taxpay-travel-payment:')))).toEqual([]);
});
}
