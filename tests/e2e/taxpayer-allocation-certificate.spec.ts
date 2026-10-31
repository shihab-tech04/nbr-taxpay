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
    receiptReference: 'MIXED-DEMO-130',
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

test('shared receipt reconciles and displays every taxpayer allocation across responsive layouts', async ({ page }) => {
  await page.goto('/?action=payment_details&transactionId=' + transactionId);
  const paper = page.locator('.receipt-view__paper');
  await expect(paper).toBeVisible();
  await expect(paper).toContainText('MIXED-DEMO-130');
  await expect(paper).toContainText('user8');
  await expect(paper).toContainText('user9');
  await expect(paper).toContainText('1111111111111');
  await expect(paper).toContainText('9999999999999');
  await expect(paper).toContainText('Tax with Return');
  await expect(paper).toContainText('Penalty & Simple Interest');
  await expect(paper).toContainText('123.45');
  await expect(paper).toContainText('6.55');
  await expect(paper).toContainText('৳ 130');
  await expect(page.getByTestId('receipt-breakdown-mobile')).toHaveCount(0);
  await expect(page.getByTestId('receipt-breakdown-table')).toHaveCount(0);

  if ((page.viewportSize()?.width ?? 0) <= 650) {
    const cards = page.getByTestId('receipt-allocation-mobile');
    await expect(cards).toBeVisible();
    await expect(cards.locator('article')).toHaveCount(2);
    await expect(page.getByTestId('receipt-allocation-table')).toBeHidden();
  } else {
    const table = page.getByTestId('receipt-allocation-table');
    await expect(table).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(page.getByTestId('receipt-allocation-mobile')).toBeHidden();
  }
});

test('shared receipt allocation labels and values stay in Bengali', async ({ page }) => {
  await page.goto('/?action=payment_details&transactionId=' + transactionId + '&lang=bn');
  const paper = page.locator('.receipt-view__paper');
  await expect(paper).toBeVisible();
  await expect(paper).toHaveAttribute('lang', 'bn');
  await expect(paper).toContainText('করদাতাভিত্তিক পেমেন্ট বরাদ্দ');
  await expect(paper).toContainText('user8');
  await expect(paper).toContainText('user9');
  await expect(paper).toContainText('রিটার্নের সাথে কর');
  await expect(paper).toContainText('জরিমানা ও সরল সুদ');
  await expect(paper).toContainText('৳ ১২৩.৪৫');
  await expect(paper).toContainText('৳ ৬.৫৫');
});
