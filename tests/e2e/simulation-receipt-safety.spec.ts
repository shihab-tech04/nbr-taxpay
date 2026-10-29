import { expect, test, type Page } from '@playwright/test';

const paymentId = '10000000-0000-4000-8000-000000000002';
type PaymentInput = { idempotencyKey: string; service: string; details: { receiptReference: string; receiptSnapshot: Record<string, unknown> } };
async function mockStoryPayments(page: Page) {
  const submissions: PaymentInput[] = [];
  // No test makes a hosted write, even if another backend call is introduced.
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    if (route.request().method() !== 'POST') return route.abort();
    submissions.push(route.request().postDataJSON() as PaymentInput);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, id: paymentId, status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
    }) });
  });
  return submissions;
}
function expectSafeSnapshot(input: PaymentInput) {
  const snapshot = input.details.receiptSnapshot;
  expect(snapshot.isSimulatedDemo).toBe(true);
  expect(snapshot.challanNo).toBe('SIM-' + input.idempotencyKey);
  expect(snapshot.gatewayTransactionId).toBe('SIM-TXN-' + input.idempotencyKey);
  expect(snapshot.treasuryStatus).toBe('GATEWAY_SUCCESS');
  expect(snapshot.treasuryScrollNo).toBeUndefined();
  expect(snapshot.treasuryDate).toBeUndefined();
  expect(input.details.receiptReference).toContain(input.idempotencyKey);
}
async function travelReview(page: Page) {
  await page.goto('/?action=travel');
  await page.locator('#travel-tax-route-0').check();
  await page.getByRole('button', { name: 'Continue to passenger details' }).click();
  await page.locator('#travel-passenger-name').fill('SAMPLE TRAVELLER');
  await page.locator('#travel-passport').fill('DEMO1234');
  await page.locator('#travel-mobile').fill('01712345678');
  await page.locator('#travel-departure-date').fill('2026-12-01');
  await page.getByRole('button', { name: 'Continue to review' }).click();
}

test('guest submission and receipt use only synthetic references', async ({ page }) => {
  const submissions = await mockStoryPayments(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await dialog.getByRole('radio', { name: /Person other than company/ }).check();
  await dialog.locator('#guest-tax-amount').fill('12500');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await dialog.getByRole('button', { name: /Pay BDT 12,500/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment process complete' })).toBeVisible({ timeout: 12000 });
  expect(submissions).toHaveLength(1);
  expectSafeSnapshot(submissions[0]);
  await expect(dialog.getByText('Payment reference', { exact: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.locator('.receipt-view')).toContainText('No Treasury scroll issued');
  await expect(dialog.locator('.receipt-view')).not.toContainText('BB-SCRL');
});

test('legacy wizard submits only a synthetic receipt', async ({ page }) => {
  const submissions = await mockStoryPayments(page);
  // Local visual-only role enables the old wizard without an authenticated account.
  await page.addInitScript(() => history.replaceState({ taxpayRoute: 'wizard', taxpaySampleRole: 'TAXPAYER_INDIVIDUAL' }, ''));
  await page.goto('/?action=wizard');
  await page.getByRole('button', { name: 'Continue to amounts' }).click();
  await page.getByRole('button', { name: 'Continue to review' }).click();
  await page.getByRole('button', { name: /Continue payment/ }).click();
  await expect(page.locator('.receipt-view')).toBeVisible();
  expect(submissions).toHaveLength(1);
  expectSafeSnapshot(submissions[0]);
  await expect(page.locator('.receipt-view')).toContainText('No Treasury scroll issued');
});

test('travel online records simulation only, with no Treasury scroll', async ({ page }) => {
  const submissions = await mockStoryPayments(page);
  await travelReview(page);
  await page.getByRole('button', { name: 'Pay online' }).click();
  await page.getByRole('button', { name: 'Mobile banking' }).click();
  await page.getByRole('radio', { name: 'bKash' }).check();
  await page.locator('.travel-flow__channel-option input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Continue payment' }).click();
  await expect(page.locator('.receipt-view')).toBeVisible();
  expect(submissions).toHaveLength(1);
  expectSafeSnapshot(submissions[0]);
  await expect(page.locator('.receipt-view')).toContainText('No Treasury scroll issued');
  await expect(page.locator('.receipt-view')).toContainText('Payment record saved');
  await expect(page.locator('.receipt-view')).not.toContainText('BB-SCRL');
});

test('travel bank-slip simulation cannot instruct a real bank payment', async ({ page }) => {
  const submissions = await mockStoryPayments(page);
  await travelReview(page);
  await page.getByRole('button', { name: 'Pay at a bank branch' }).click();
  await expect(page.getByText('Bank settlement is not connected; tax credit is not confirmed.')).toBeVisible();
  await page.locator('.travel-flow__channel-option input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Continue payment' }).click();
  await expect(page.getByText('Bank slip ready — payment not confirmed')).toBeVisible();
  await expect(page.getByText('Bank settlement is not connected; payment and tax credit are not confirmed.')).toBeVisible();
  expect(submissions).toHaveLength(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('.receipt-view')).toBeVisible();
  expect(submissions).toHaveLength(1);
  expectSafeSnapshot(submissions[0]);
  await expect(page.locator('.receipt-view')).toContainText('No Treasury scroll issued');
});

for (const language of ['en', 'bn'] as const) test(`legacy ${language} receipt stays searchable but hides a sample Treasury scroll`, async ({ page }) => {
  const reference = 'ACS-2026-99887766';
  const snapshot = {
    id: 'rcpt-legacy', challanNo: reference, tokenNumber: 'TKN-998877',
    gatewayTransactionId: 'BKSH-TXN-998877', paymentCategory: 'TAX_WITH_RETURN',
    assessmentYear: '2026-27', payerName: 'Sample Taxpayer', payerTin: 'GUEST',
    taxpayerTin: '123456789012', receiptMobile: '01712345678', isRepresentativePayment: false,
    taxZone: '—', taxCircle: '—', isWithholding: false,
    items: [{ headId: 74, economicCode: '74', headNameEn: 'Tax with return', taxAmount: 1,
      penaltyAmount: 0, surchargeAmount: 0, interestAmount: 0, totalAmount: 1 }],
    totalAmount: 1, paymentMethod: 'BKASH', treasuryStatus: 'TREASURY_SCROLLED',
    treasuryScrollNo: 'BB-SCRL-2026-99999', taxCreditStatus: 'PENDING_RECONCILIATION',
    createdAt: '2026-10-24 10:00:00', isSimulatedDemo: true,
  };
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.route(/\/demo-story1-taxpay\/payments\?sessionId=/, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
      items: [{ id: paymentId, service: 'TAX_WITH_RETURN', amountMinor: 100, status: 'SIMULATED_SUCCESS' }], total: 1,
    } }),
  }));
  await page.route(/\/demo-story1-taxpay\/payments\/[0-9a-f-]+\?sessionId=/, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, simulationOnly: true,
      data: { id: paymentId, status: 'SIMULATED_SUCCESS', data: { details: { receiptSnapshot: snapshot } } },
    }),
  }));
  await page.goto('/?action=verify&lang=' + language);
  await page.locator('#receipt-lookup-reference').fill(reference);
  await page.locator('#receipt-lookup-mobile').fill('01712345678');
  await page.locator('.receipt-lookup__submit').click();
  const receipt = page.locator('.receipt-view');
  await expect(receipt).toContainText(reference);
  await expect(receipt).toContainText(language === 'bn' ? 'ট্রেজারির অবস্থা যাচাই হয়নি' : 'Treasury status not verified');
  await expect(receipt).toContainText(language === 'bn' ? 'ট্রেজারি স্ক্রল ইস্যু হয়নি' : 'No Treasury scroll issued');
  await expect(receipt).not.toContainText('BB-SCRL-2026-99999');
});
