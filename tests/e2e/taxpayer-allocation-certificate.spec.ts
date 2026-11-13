import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const transactionId = '9a5ec4cb-8d85-4a7d-903c-2cfacbafe160';
const allocationRecord = {
  id: transactionId,
  service: 'OTHER_TAX_PAYMENT',
  status: 'SIMULATED_SUCCESS',
  amountMinor: 13000,
  createdAt: '2026-10-18T08:00:00.000Z',
  details: {
    payerName: 'Sample payer',
    payerTin: '2222222222222',
    taxpayerTin: '2222222222222',
    payerMode: 'OTHER',
    assessmentYear: '2026-27',
    receiptReference: 'ACS-2026-00130',
    paymentMethod: 'BKASH',
    taxZone: 'Taxes Zone 2',
    taxCircle: 'Circle 2',
    lines: [
      { beneficiary: 'user8', taxpayerTin: '1111111111111', category: 'TAX_WITH_RETURN', assessmentYear: '2026-27', amountMinor: 12345 },
      { beneficiary: 'user9', taxpayerTin: '9999999999999', category: 'PENALTY', assessmentYear: '2026-27', amountMinor: 655 }
    ]
  }
};

test.beforeEach(async ({ page }) => {
  await page.route('**/functions/v1/demo-story1-office/payments*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: [allocationRecord], total: 1, page: 1, perPage: 100 } })
  }));
});

test('synced certificate displays every taxpayer allocation across responsive layouts', async ({ page }) => {
  await page.goto('/?action=payment_details&transactionId=' + transactionId);
  const certificate = page.getByTestId('payment-certificate-document');
  await expect(certificate).toBeVisible();
  await expect(certificate.getByRole('heading', { name: 'Payment Certificate' })).toBeVisible();
  await expect(page.getByTestId('payment-certificate-reference')).toContainText('SK-PC-' + transactionId);
  await expect(certificate).toContainText('Sample payer');
  await expect(certificate).toContainText('1111111111111');
  await expect(certificate).toContainText('9999999999999');
  await expect(certificate).toContainText('Tax with Return');
  await expect(certificate).toContainText('Penalty & Simple Interest');
  await expect(certificate).toContainText('2026-27');
  await expect(certificate).toContainText('৳ 123.45');
  await expect(certificate).toContainText('৳ 6.55');
  await expect(page.getByTestId('payment-certificate-total')).toHaveText('৳ 130');

  if ((page.viewportSize()?.width ?? 0) <= 650) {
    const cards = page.getByTestId('payment-certificate-mobile-lines');
    await expect(cards).toBeVisible();
    await expect(cards.getByTestId('payment-certificate-line-card')).toHaveCount(2);
    await expect(page.getByTestId('payment-certificate-allocation-table-wrap')).toBeHidden();
  } else {
    const table = page.getByTestId('payment-certificate-allocation-table');
    await expect(table).toBeVisible();
    await expect(table.getByTestId('payment-certificate-line-row')).toHaveCount(2);
    await expect(page.getByTestId('payment-certificate-mobile-lines')).toBeHidden();
  }
});

test('certificate content and download remain Bengali and produce PDF bytes', async ({ page }) => {
  await page.goto('/?action=payment_details&transactionId=' + transactionId + '&lang=bn');
  const paper = page.locator('.receipt-view__paper');
  const certificate = page.getByTestId('payment-certificate-document');
  await expect(paper).toBeVisible();
  await expect(paper).toHaveAttribute('lang', 'bn');
  await expect(certificate.getByRole('heading', { name: 'পেমেন্ট সনদ' })).toBeVisible();
  await expect(certificate).toContainText('প্রাপক ও পেমেন্ট বরাদ্দ');
  await expect(certificate).toContainText('user8');
  await expect(certificate).toContainText('user9');
  await expect(certificate).toContainText('রিটার্নের সাথে কর');
  await expect(certificate).toContainText('জরিমানা ও সরল সুদ');
  await expect(certificate).toContainText('৳ ১২৩.৪৫');
  await expect(certificate).toContainText('৳ ৬.৫৫');
  if ((page.viewportSize()?.width ?? 0) <= 650) {
    await expect(page.getByTestId('payment-certificate-mobile-lines').getByTestId('payment-certificate-line-card')).toHaveCount(2);
  } else {
    await expect(page.getByTestId('payment-certificate-allocation-table').getByTestId('payment-certificate-line-row')).toHaveCount(2);
  }

  const download = page.waitForEvent('download', { timeout: 20000 });
  await page.getByRole('button', { name: 'ডাউনলোড', exact: true }).click();
  const result = await download;
  expect(result.suggestedFilename()).toBe('Payment-certificate-' + transactionId + '.pdf');
  const path = await result.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.toString('latin1')).toContain('/Subtype /Image');
  expect(bytes.toString('latin1')).toContain('Sohojkor Payment Certificate ' + transactionId);
});

test('certificate retains every beneficiary head and year in its reconciled total', async ({ page }) => {
  const record = { ...allocationRecord, amountMinor: 16000, details: {
    ...allocationRecord.details, lines: [
      { beneficiary: 'user8', taxpayerTin: '1111111111111', category: 'PENALTY', assessmentYear: '2026-27', amountMinor: 12345 },
      { beneficiary: 'user9', taxpayerTin: '9999999999999', category: 'PENALTY', assessmentYear: '2026-27', amountMinor: 655 },
      { beneficiary: 'user8', taxpayerTin: '1111111111111', category: 'ADVANCE_TAX', assessmentYear: '2025-26', amountMinor: 3000 }
    ]
  }};
  await page.route('**/functions/v1/demo-story1-office/payments*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { items: [record], total: 1, page: 1, perPage: 100 } })
  }));
  await page.goto('/?action=payment_details&transactionId=' + transactionId);
  const certificate = page.getByTestId('payment-certificate-document');
  await expect(certificate).toContainText('1111111111111');
  await expect(certificate).toContainText('9999999999999');
  await expect(certificate).toContainText('Penalty & Simple Interest');
  await expect(certificate).toContainText('Advance Tax');
  await expect(certificate).toContainText('2025-26');
  await expect(page.getByTestId('payment-certificate-total')).toHaveText('৳ 160');
  if ((page.viewportSize()?.width ?? 0) <= 650) {
    await expect(page.getByTestId('payment-certificate-mobile-lines').getByTestId('payment-certificate-line-card')).toHaveCount(3);
  } else {
    const table = page.getByTestId('payment-certificate-allocation-table');
    await expect(table.getByTestId('payment-certificate-line-row')).toHaveCount(3);
    await expect(table.locator('tbody tr').nth(1).locator('td').last()).toHaveCSS('text-align', 'right');
  }
});
