import { expect, test, type Page } from '@playwright/test';

// Disposable API responses only: never create a real tax payment in this UI test.
async function stubRecordedPayment(page: Page) {
  const id = '10000000-0000-4000-8000-000000000291';
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/*.supabase.co/**', route =>
    ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
  await page.route('**/functions/v1/demo-story1-taxpay/payments**', async route => {
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({status: 204, headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': '*',
    }});
    if (method === 'POST') {
      submitted = route.request().postDataJSON();
      return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, id, status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
      })});
    }
    if (method !== 'GET') return route.abort();
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/' + id) && submitted
      ? {id, status: 'SIMULATED_SUCCESS', createdAt: '2026-11-22T00:00:00Z', data: submitted}
      : {items: [], total: 0};
    return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, simulationOnly: true, data,
    })});
  });
}

test('Walk-in Challan uses the one shared header and an accessible receipt/certificate document switcher', async ({page}) => {
  await stubRecordedPayment(page);
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog = page.getByRole('dialog', {name: 'Pay Tax'});
  await dialog.getByRole('button', {name: 'Walk-in Payment'}).click();
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  await dialog.getByRole('button', {name: 'Search taxpayer TIN'}).click();
  await dialog.getByRole('button', {name: 'Add taxpayer'}).click();
  await dialog.locator('.tax-service-choice__continue').filter({hasText: 'Continue to Payment Head'}).click();
  const editor = dialog.getByTestId('other-tax-batch');
  // Reuse the approved grouped tax-head controls restored on protected Main #997.
  const group = editor.locator('[data-head-group="Advance Tax"]');
  if (await group.getAttribute('open') === null) await group.locator('summary').click();
  await editor.getByRole('checkbox', {name:/Select 68A|68A/}).check();
  await editor.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('35');
  await dialog.getByRole('button', {name: 'Continue to Final Preview'}).click();
  await dialog.locator('#guest-payer-name').fill('Guest Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', {name: 'Make Payment'}).click();
  await dialog.getByRole('button', {name: 'Pay online'}).click();
  await dialog.getByRole('button', {name: 'Mobile banking'}).click();
  await dialog.getByRole('radio', {name: 'bKash'}).check();
  await dialog.getByRole('checkbox', {name: /I have checked the taxpayers/}).check();
  await dialog.getByRole('button', {name: 'Confirm payment'}).click();
  await expect(dialog.getByTestId('walkin-challan-action')).toBeVisible({timeout: 20000});
  await dialog.getByTestId('walkin-challan-action').getByRole('button', {name: 'Challan Details'}).click();
  await expect(dialog.locator('.taxpay-modal__header .taxpay-modal__title')).toHaveText('Challan details');
  await expect(dialog.getByRole('button', {name: 'Back to confirmation'})).toBeVisible();
  await expect(dialog.getByTestId('walkin-receipt-toolbar')).toHaveCount(0);
  await expect(dialog.locator('.receipt-view__paper')).toBeVisible();
  await expect(dialog.locator('.receipt-view__actions')).toHaveCount(1);
  const certificate = dialog.getByRole('tab', {name: 'Payment record certificate'});
  if (await certificate.count()) {
    await certificate.click();
    await expect(dialog.locator('.taxpay-modal__header .taxpay-modal__title')).toHaveText('Payment record certificate');
    await expect(dialog.getByText('Saved payment record certificate only')).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Back to receipt'})).toBeVisible();
    await dialog.getByRole('button', {name: 'Back to receipt'}).click();
    await expect(dialog.locator('.taxpay-modal__header .taxpay-modal__title')).toHaveText('Challan details');
  }
  await dialog.getByRole('button', {name: 'Back to confirmation'}).click();
  await expect(dialog.getByTestId('walkin-challan-action')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
