import { expect, test } from '@playwright/test';

// F-132 / US-129 negative and recovery: a payment summary is not an
// issuer-backed tax-credit certificate. No-source states cannot export a
// zero-value or otherwise unsupported payment document.
test('Tax Credit Certificates does not export empty or unverified record summaries', async ({ page }) => {
  // Isolate the session-scoped readback: an explicitly empty response is not
  // evidence of an officially issued document, and cannot depend on the
  // availability or seeded data of the hosted demonstration endpoint.
  await page.route(/\/demo-story1-taxpay\/payments\?sessionId=/, async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({success:true,simulationOnly:true,data:{items:[],total:0}})
    });
  });
  for (const language of ['en','bn'] as const) {
    await page.goto('/?action=certificates&demoUser=user2&lang=' + language);
    const bn = language === 'bn';
    const issued = page.getByTestId('issued-tax-credit-certificates');
    await expect(issued).toContainText(bn
      ? 'ইস্যুকারী কর্তৃপক্ষের যাচাইকৃত কর ক্রেডিট সনদপত্র নেই'
      : 'No issuer-verified tax credit certificates are available');
    await expect(issued.getByRole('button', {name: /download|ডাউনলোড/i})).toHaveCount(0);

    // Isolated local-review account has no source-backed payment/session
    // payment records; it must not be displayed as a verified zero total.
    const register = page.getByTestId('account-certificate-record-register');
    await expect(register).toContainText(bn
      ? 'এই সারসংক্ষেপে কোনো পেমেন্ট রেকর্ড নেই।'
      : 'No payment records in this summary.');

    await page.getByRole('button', {name: bn ? 'সারসংক্ষেপ দেখুন' : 'View summary', exact: true}).click();
    const modal = page.getByRole('dialog', {name: bn ? 'সনদের সারসংক্ষেপ' : 'Certificate summary'});
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', {name: bn ? 'ডাউনলোড' : 'Download'})).toBeDisabled();
    await expect(modal.getByRole('button', {name: bn ? 'সারসংক্ষেপ প্রিন্ট' : 'Print summary'})).toBeDisabled();
    await expect(modal.locator('.receipt-view__amount strong')).toHaveText('—');
    await expect(modal.locator('.receipt-view__reference-strip strong').last()).toHaveText('—');
    await expect(modal.locator('[data-testid="certificate-summary-document"]')).toContainText(bn
      ? 'কোনো মিল পাওয়া যায়নি।' : 'No matching records.');
  }
});
