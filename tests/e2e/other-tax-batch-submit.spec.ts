import { expect, test, type Page } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

async function openOtherTax(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  return dialog;
}

test('two taxpayer records survive a lost response and reload without duplication', async ({ page }) => {
  const stored = new Map<string, { id: string; input: Record<string, any> }>();
  const calls: Record<string, any>[] = [];
  let loseSecondResponse = true;
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    const input = route.request().postDataJSON() as Record<string, any>;
    calls.push(input);
    let record = stored.get(input.idempotencyKey);
    if (!record) {
      record = { id: `00000000-0000-4000-8000-${String(stored.size + 201).padStart(12, '0')}`, input };
      stored.set(input.idempotencyKey, record);
    }
    if (stored.size === 2 && loseSecondResponse) {
      loseSecondResponse = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'OFFICE_SYNC_PENDING' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, id: record.id, status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
    }) });
  });
  let dialog = await openOtherTax(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.getByRole('button', { name: /^Search(?: TIN)?$/ }).click();
  await dialog.locator('#guest-payer-name').fill('Payer Name');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  const other = dialog.getByTestId('other-tax-taxpayer');
  await other.locator('input[id^="other-tax-tin"]').fill('222222222222');
  await other.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(other.locator('input[id^="other-tax-name"]')).toHaveValue('User 2');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('15');
  await batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button').nth(1).click();
  await batch.getByRole('checkbox', { name: /Select 68B/ }).check();
  await batch.getByTestId('other-tax-line').locator('select[id^="other-tax-year"]').selectOption('2025-26');
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('35');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm each taxpayer TIN/ }).check();
  await dialog.getByRole('button', { name: /Pay ৳ 50/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment records pending' })).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByTestId('other-tax-batch-result').first()).toContainText('Record saved');
  await expect(dialog.getByTestId('other-tax-batch-result').last()).toContainText('Pending');

  dialog = await openOtherTax(page);
  await expect(dialog.getByRole('heading', { name: 'Payment records pending' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry pending records' }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByTestId('other-tax-batch-result')).toHaveCount(2);
  await expect(dialog.getByTestId('other-tax-batch-result').last()).toContainText('Record saved');
  expect(stored.size).toBe(2);
  expect(calls).toHaveLength(3);
  expect(calls[2]).toEqual(calls[1]);
  const records = [...stored.values()].map(record => record.input);
  expect(records.map(record => record.amountMinor)).toEqual([1500, 3500]);
  expect(records.map(record => record.details.taxpayerTin)).toEqual(['111111111111', '222222222222']);
  expect(records.map(record => record.details.assessmentYear)).toEqual(['2026-27', '2025-26']);
  expect(records.every(record => record.details.allocations.length === 1 && record.details.lines.length === 1)).toBeTruthy();
  const receiptButton = dialog.getByTestId('other-tax-batch-result').last().getByRole('button', { name: /View receipt for 222222222222/ });
  expect(await receiptButton.evaluate(button => parseFloat(getComputedStyle(button).minHeight))).toBeGreaterThanOrEqual(44);
  expect((await receiptButton.boundingBox())?.height).toBeGreaterThanOrEqual(43.9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  await receiptButton.click();
  await expect(dialog.getByText('222222222222', { exact: true })).toBeVisible();
  await expect(dialog.getByText('2025-26', { exact: true })).toBeVisible();
  dialog = await openOtherTax(page);
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible();
  await expect(dialog.getByText('Payment progress and references')).toContainText('7 / 7');
  await expect(dialog.getByTestId('other-tax-batch-result')).toHaveCount(2);
  expect(calls).toHaveLength(3);
});

test('a bank-branch request remains pending across reload until continued', async ({ page }) => {
  const calls: Record<string, any>[] = [];
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, id: '00000000-0000-4000-8000-000000000301', status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
    }) });
  });
  let dialog = await openOtherTax(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.getByRole('button', { name: /^Search(?: TIN)?$/ }).click();
  await dialog.locator('#guest-payer-name').fill('Payer Name');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('25');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay at a bank branch' }).click();
  await dialog.getByRole('checkbox', { name: /I confirm each taxpayer TIN/ }).check();
  await dialog.getByRole('button', { name: 'Get payment slip' }).click();
  await expect(dialog.getByRole('heading', { name: 'Bank payment slip ready' })).toBeVisible();
  expect(calls).toHaveLength(0);

  dialog = await openOtherTax(page);
  await expect(dialog.getByRole('heading', { name: 'Bank payment slip ready' })).toBeVisible();
  expect(calls).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Continue bank payment' }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 15000 });
  expect(calls).toHaveLength(1);
  expect(calls[0].amountMinor).toBe(2500);
  await expect(dialog.getByTestId('other-tax-batch-result')).toContainText('Record saved');
});
