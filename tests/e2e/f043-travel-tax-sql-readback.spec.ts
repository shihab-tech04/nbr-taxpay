import { expect, test } from '@playwright/test';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';
import { fillTravelDetails } from './travel-tax-test-helper';

const paymentId = '8d30d00b-9203-45ba-9224-848d56a26739';
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': '*',
};

test('F-043 waits for matching Taxpayer SQL readback and retries with the same payment key', async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  const requests: Record<string, unknown>[] = [];
  let readbackCount = 0;
  let firstReadbackStarted = false;
  let releaseFirstReadback: (() => void) | undefined;
  const firstReadbackGate = new Promise<void>(resolve => { releaseFirstReadback = resolve; });

  await page.route(/\/functions\/v1\/demo-story1-taxpay\/payments(?:\/[^?]+)?(?:\?.*)?$/, async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    if (request.method() === 'GET') {
      const url = new URL(request.url());
      const stored = submitted as {
        sessionId?: string;
        service?: string;
        amountMinor?: number;
        details?: Record<string, unknown>;
      } | null;
      if (!stored || url.searchParams.get('sessionId') !== stored.sessionId) {
        await route.fulfill({ status: 403, contentType: 'application/json', headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'SESSION_NOT_AUTHORIZED' }) });
        return;
      }
      const createdAt = '2026-11-14T08:00:00.000Z';
      const source = { id: paymentId, service: stored.service, amountMinor: stored.amountMinor,
        status: 'SIMULATED_SUCCESS', createdAt };
      const detail = url.pathname.endsWith('/' + paymentId);
      if (detail) {
        readbackCount += 1;
        if (readbackCount === 1) {
          firstReadbackStarted = true;
          await firstReadbackGate;
          await route.fulfill({ status: 503, contentType: 'application/json', headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'TEMPORARY_READBACK_FAILURE' }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders,
          body: JSON.stringify({ success: true, simulationOnly: true,
            data: { id: paymentId, status: 'SIMULATED_SUCCESS', createdAt,
              data: { service: stored.service, amountMinor: stored.amountMinor, details: stored.details } } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders,
        body: JSON.stringify({ success: true, simulationOnly: true, data: { items: [source], total: 1 } }) });
      return;
    }
    if (request.method() !== 'POST') {
      await route.fulfill({ status: 405, headers: corsHeaders });
      return;
    }
    submitted = request.postDataJSON() as Record<string, unknown>;
    requests.push(submitted);
    await route.fulfill({ status: 200, contentType: 'application/json', headers: corsHeaders,
      body: JSON.stringify({ success: true, id: paymentId, status: 'SIMULATED_SUCCESS',
        mirrored: true, simulationOnly: true }) });
  });

  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const modal = page.getByRole('dialog', { name: /Travel tax|ভ্রমণ কর/ });
  await modal.locator('#travel-passport-first').fill('TEST123456');
  await modal.locator('#travel-lookup-first').click();
  await modal.getByRole('button', { name: /^(Add passenger|যাত্রী যোগ করুন)$/ }).click();
  await modal.getByRole('button', { name: /Add another passenger|আরেকজন যাত্রী/ }).click();
  const people = modal.getByTestId('travel-passenger-list').locator('.travel-flow__person');
  await expect(people).toHaveCount(2);
  const second = people.nth(1);
  await second.getByRole('tab', { name: /Foreign passenger|বিদেশি যাত্রী/ }).click();
  await second.locator('input[id^="travel-passport-"]').fill('B7654321');
  await second.locator('input[id^="travel-name-"]').fill('FRIEND SECOND');
  await second.locator('input[id^="travel-birth-date-"]').fill('2017-08-10');
  await second.locator('input[id^="travel-country-"]').fill('India');
  await modal.getByRole('button', { name: /^(Add passenger|যাত্রী যোগ করুন)$/ }).click();
  await fillTravelDetails(modal);
  await modal.getByRole('button', { name: /Continue to review|পেমেন্ট পর্যালোচনায় যান/ }).click();
  await modal.getByRole('button', { name: /Pay online|অনলাইনে পরিশোধ/ }).click();
  await modal.getByRole('button', { name: /Mobile banking|মোবাইল ব্যাংকিং/ }).click();
  await modal.getByRole('radio', { name: 'Nagad' }).check();
  await modal.getByLabel(/I confirm the travel information|ভ্রমণের তথ্য/).check();
  const confirm = modal.getByRole('button', { name: /Confirm preview payment|নমুনা পেমেন্ট নিশ্চিত করুন/ });
  await confirm.click();

  await expect.poll(() => firstReadbackStarted).toBe(true);
  await expect(modal.locator('.receipt-view__paper')).toHaveCount(0);
  releaseFirstReadback?.();
  await expect(modal.getByRole('alert')).toBeVisible();
  await expect(modal.locator('.receipt-view__paper')).toHaveCount(0);

  await confirm.click();
  const receipt = modal.getByTestId('travel-family-challan');
  await expect(receipt).toBeVisible();
  await expect(receipt.locator('tbody tr')).toHaveCount(2);
  await expect(modal.getByRole('button', { name: /View payment certificate|পেমেন্ট সনদ দেখুন/ })).toBeVisible();
  expect(readbackCount).toBe(2);
  expect(requests).toHaveLength(2);
  expect(requests[0].idempotencyKey).toBe(requests[1].idempotencyKey);
  expect(requests[0]).toEqual(requests[1]);

  await modal.getByRole('button', { name: /View payment certificate|পেমেন্ট সনদ দেখুন/ }).click();
  await expect(modal.getByTestId('payment-certificate-document')).toBeVisible();
  await expect(modal.getByTestId('payment-certificate-document')).toContainText('FRIEND SECOND');
});
