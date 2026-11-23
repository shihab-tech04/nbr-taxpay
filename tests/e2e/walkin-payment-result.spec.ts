import { expect, test, type Page } from '@playwright/test';

/** A read-only, disposable payment provider fixture; no hosted financial writes. */
async function stubCompletedWalkIn(page: Page) {
  const id = '10000000-0000-4000-8000-000000000291';
  let submitted: Record<string, any> | null = null;
  // Never allow this browser acceptance to write to any hosted database.
  // The explicit disposable Story 1 fixture below overrides this guard.
  await page.route('**/*.supabase.co/**', route =>
    ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
  await page.route('**/functions/v1/demo-story1-taxpay/payments**', async route => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: {
        'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': '*',
      } });
      return;
    }
    if (method === 'POST') {
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, id, status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
      }) });
      return;
    }
    if (method !== 'GET') return route.abort();
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/' + id) && submitted) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, simulationOnly: true,
        data: { id, status: 'SIMULATED_SUCCESS', createdAt: '2026-11-22T00:00:00Z', data: submitted },
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, simulationOnly: true, data: { items: [], total: 0 },
    }) });
  });
  return () => submitted;
}

async function reachWalkInResult(page: Page, language: 'en' | 'bn') {
  await page.goto('/?action=landing&lang=' + language);
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog = page.getByRole('dialog', {name: language === 'bn' ? 'কর পরিশোধ' : 'Pay Tax'});
  await dialog.getByRole('button', {name: language === 'bn' ? 'লগইন ছাড়া পেমেন্ট' : 'Walk-in Payment'}).click();
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  await dialog.getByRole('button', {name: language === 'bn' ? 'করদাতার টিআইএন খুঁজুন' : 'Search taxpayer TIN'}).click();
  await dialog.getByRole('button', {name: language === 'bn' ? 'করদাতা যোগ করুন' : 'Add taxpayer'}).click();
  await dialog.locator('.tax-service-choice__continue').filter({hasText: language === 'bn' ? 'পেমেন্ট খাতে' : 'Continue to Payment Head'}).click();
  const editor = dialog.getByTestId('other-tax-batch');
  const group = editor.locator('[data-head-group="Advance Tax"]');
  await group.locator('summary').click();
  await editor.getByRole('checkbox', {name:/Select 68A|68A/}).check();
  await editor.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('35');
  await dialog.getByRole('button', {name: language === 'bn' ? /চূড়ান্ত পর্যালোচনা/ : 'Continue to Final Preview'}).click();
  await dialog.locator('#guest-payer-name').fill('Guest Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', {name: language === 'bn' ? 'পেমেন্ট করুন' : 'Make Payment'}).click();
  await dialog.getByRole('button', {name: language === 'bn' ? /অনলাইনে/ : 'Pay online'}).click();
  await dialog.getByRole('button', {name: language === 'bn' ? /মোবাইল ব্যাংকিং/ : 'Mobile banking'}).click();
  await dialog.getByRole('radio', {name:'bKash'}).check();
  await dialog.getByRole('checkbox', {name: language === 'bn' ? /করদাতা/ : /I have checked the taxpayers/}).check();
  await dialog.getByRole('button', {name: language === 'bn' ? 'পরিশোধ নিশ্চিত করুন' : 'Confirm payment'}).click();
  await expect(dialog.getByTestId('walkin-challan-action')).toBeVisible({timeout:20000});
  return dialog;
}

test('parallel Walk-in result offers a guest challan before optional account benefits', async ({page}) => {
  const submission = await stubCompletedWalkIn(page);
  const dialog = await reachWalkInResult(page, 'en');
  const challan = dialog.getByTestId('walkin-challan-action');
  const offer = dialog.getByTestId('walkin-result-benefits');
  await expect(challan.getByRole('button', {name:'Challan Details'})).toBeVisible();
  await expect(offer.getByRole('heading', {name:'Get More with a Shohojkor Account'})).toBeVisible();
  await expect(offer.locator('li')).toHaveCount(3);
  await expect(offer).toContainText('Payment Certificates');
  await expect(offer).toContainText('previous payment records and challans');
  await expect(offer).toContainText('payment history');
  await expect(offer.getByRole('button', {name:'Log In'})).toBeVisible();
  await expect(offer.getByRole('button', {name:'Continue without Login'})).toBeVisible();
  await expect(dialog.getByRole('button', {name:'Receipt details'})).toHaveCount(0);
  expect(submission()).not.toBeNull();

  await offer.getByRole('button', {name:'Continue without Login'}).click();
  await expect(offer).toHaveCount(0);
  await challan.getByRole('button', {name:'Challan Details'}).click();
  await expect(dialog.locator('.receipt-view__paper')).toBeVisible();
  await expect(dialog.locator('.receipt-view__reference-strip')).toBeVisible();
  await expect(dialog.locator('.receipt-view__actions')).toBeVisible();
  await dialog.getByRole('button', {name:'Back to confirmation'}).click();
  await expect(challan).toBeVisible();
});

test('guest result invitation navigates to existing sign-in, with no automatic payment claim', async ({page}) => {
  await stubCompletedWalkIn(page);
  const dialog = await reachWalkInResult(page, 'en');
  await expect(dialog.getByTestId('walkin-result-benefits')).toContainText('not automatically linked');
  await dialog.getByTestId('walkin-result-benefits').getByRole('button', {name:'Log In'}).click();
  await expect(page.getByRole('dialog', {name:/Sign In To Your .* Account/})).toBeVisible();
});
