import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('payment amount matches the endpoint limit and preserves the last paisa', async ({ page }) => {
  let sentMinor: number | undefined;
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    if (route.request().method() !== 'POST') return route.abort();
    sentMinor = (route.request().postDataJSON() as { amountMinor: number }).amountMinor;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, id: '10000000-0000-4000-8000-000000000002',
      status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
    }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await dialog.getByRole('radio', { name: /Person other than company/ }).check();
  await dialog.locator('#guest-tax-amount').fill('10000000000.00');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByRole('alert')).toContainText('maximum supported total');
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await expect(dialog.getByRole('button', { name: /Pay BDT/ })).toBeDisabled();
  expect(sentMinor).toBeUndefined();

  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await dialog.locator('#guest-tax-amount').fill('9999999999.99');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await dialog.getByRole('button', { name: /Pay BDT/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 12000 });
  expect(sentMinor).toBe(999999999999);
});
