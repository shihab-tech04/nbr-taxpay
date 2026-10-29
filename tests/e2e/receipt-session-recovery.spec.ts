import { expect, test } from '@playwright/test';

const reference = 'ACS-2026-99887766';
const paymentId = '853f43d4-a39e-4ae2-9bb2-0bbcdf4d58e5';
const mobile = '01712345678';

const snapshot = {
  id: 'rcpt-session-recovery',
  challanNo: reference,
  tokenNumber: 'TKN-998877',
  paymentTransactionId: 'PT-2026-998877',
  gatewayTransactionId: 'BKSH-TXN-998877',
  paymentCategory: 'TAX_WITH_RETURN',
  assessmentYear: '2026-27',
  payerName: 'Sample Taxpayer',
  payerTin: 'GUEST',
  taxpayerTin: '123456789012',
  receiptMobile: mobile,
  isRepresentativePayment: false,
  taxZone: '—',
  taxCircle: '—',
  isWithholding: false,
  items: [{
    headId: 74, economicCode: '74', headNameEn: 'Tax with return',
    taxAmount: 12500, penaltyAmount: 0, surchargeAmount: 0,
    interestAmount: 0, totalAmount: 12500,
  }],
  totalAmount: 12500,
  paymentMethod: 'BKASH',
  treasuryStatus: 'GATEWAY_SUCCESS',
  taxCreditStatus: 'PENDING_RECONCILIATION',
  createdAt: '2026-10-24 10:00:00',
  isSimulatedDemo: true,
};

async function stubSessionRecord(page: import('@playwright/test').Page) {
  await page.route(/\/demo-story1-taxpay\/payments\?sessionId=/, async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, simulationOnly: true,
        data: { items: [{ id: paymentId, service: 'TAX_WITH_RETURN',
          amountMinor: 1250000, status: 'SIMULATED_SUCCESS',
          createdAt: '2026-10-24T10:00:00Z' }], total: 1 } }),
    });
  });
  await page.route(/\/demo-story1-taxpay\/payments\/[0-9a-f-]+\?sessionId=/, async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, simulationOnly: true,
        data: { id: paymentId, status: 'SIMULATED_SUCCESS',
          data: { details: { receiptSnapshot: snapshot } } } }),
    });
  });
}

test('status lookup restores a same-session simulated receipt after a page reload', async ({ page }) => {
  await stubSessionRecord(page);
  await page.goto('/?action=verify');
  await page.reload();
  await page.getByRole('textbox', { name: 'Challan, token or transaction reference' }).fill(reference);
  await page.getByRole('textbox', { name: 'Receipt mobile number' }).fill(mobile);
  await page.getByRole('dialog', { name: 'Payment status & receipt' }).getByRole('button', { name: 'Search records' }).click();
  await expect(page.locator('.receipt-view')).toBeVisible();
  await expect(page.locator('.receipt-view')).toContainText(reference);
  // The receipt is recovered without reintroducing the redundant status/credit badges.
  await expect(page.locator('.receipt-view__status')).toHaveCount(0);
  await expect(page.locator('.receipt-view__paper')).toContainText('12,500');
});

test('a matching reference does not expose a receipt with the wrong mobile', async ({ page }) => {
  await stubSessionRecord(page);
  await page.goto('/?action=verify');
  await page.getByRole('textbox', { name: 'Challan, token or transaction reference' }).fill(reference);
  await page.getByRole('textbox', { name: 'Receipt mobile number' }).fill('01700000000');
  await page.getByRole('dialog', { name: 'Payment status & receipt' }).getByRole('button', { name: 'Search records' }).click();
  await expect(page.getByRole('heading', { name: 'No matching record' })).toBeVisible();
  await expect(page.locator('.receipt-view')).toHaveCount(0);
});

test('backend outage is not misreported as a missing receipt', async ({ page }) => {
  await page.route(/\/demo-story1-taxpay\/payments\?sessionId=/, async route =>
    route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'BACKEND_UNAVAILABLE' }) }));
  await page.goto('/?action=verify');
  await page.getByRole('textbox', { name: 'Challan, token or transaction reference' }).fill(reference);
  await page.getByRole('textbox', { name: 'Receipt mobile number' }).fill(mobile);
  await page.getByRole('dialog', { name: 'Payment status & receipt' }).getByRole('button', { name: 'Search records' }).click();
  await expect(page.getByRole('alert')).toContainText('Saved session records are temporarily unavailable');
  await expect(page.getByRole('heading', { name: 'No matching record' })).toHaveCount(0);
});
