import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

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
  await page.route('**/functions/v1/demo-story1-taxpay/payments/*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body:JSON.stringify({success:true,simulationOnly:true,data:{id:allocationRecord.id,status:allocationRecord.status,createdAt:allocationRecord.createdAt,data:{origin:'TAXPAY_UI',service:allocationRecord.service,amountMinor:allocationRecord.amountMinor,details:allocationRecord.details}}})
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
  await page.route('**/functions/v1/demo-story1-taxpay/payments/*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body:JSON.stringify({success:true,simulationOnly:true,data:{id:record.id,status:record.status,createdAt:record.createdAt,data:{origin:'TAXPAY_UI',service:record.service,amountMinor:record.amountMinor,details:record.details}}})
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


const accountCertificateBackend = 'https://taxpay-certificate-fixture.invalid';
const accountCertificateOwner = '00000000-0000-4000-8000-000000000111';
const accountCertificateOther = '00000000-0000-4000-8000-000000000222';
const accountCertificateId = '11111111-2222-4333-8444-555555555555';
const accountCertificateDate = '2026-10-18T08:00:00.000Z';
const accountCertificateLine = {
  headId: 120, economicCode: '120', headNameEn: 'Penalty & Simple Interest',
  headNameBn: 'জরিমানা ও সরল সুদ', taxAmount: 0, penaltyAmount: 130,
  surchargeAmount: 0, interestAmount: 0, totalAmount: 130
};
const accountCertificateAllocation = {
  allocationId: 'ws1-certificate-allocation-1', taxpayerTin: '1111111111111',
  taxpayerName: 'Nusrat Jahan', assessmentYear: '2026-27', amountMinor: 13000, headId: 120
};
const accountCertificateSnapshot = {
  id: 'receipt-' + accountCertificateId, challanNo: 'ACS-2026-00130',
  tokenNumber: 'TOKEN-' + accountCertificateId, paymentCategory: 'PENALTY',
  assessmentYear: '2026-27', payerName: 'Sample payer', payerTin: '2222222222222',
  taxpayerTin: '1111111111111', receiptMobile: '01712345678',
  isRepresentativePayment: true, taxZone: 'Taxes Zone 2', taxCircle: 'Circle 2',
  isWithholding: false, items: [accountCertificateLine], totalAmount: 130,
  paymentMethod: 'BKASH', gatewayTransactionId: 'gateway-' + accountCertificateId,
  treasuryStatus: 'GATEWAY_SUCCESS', taxCreditStatus: 'PENDING_RECONCILIATION',
  createdAt: accountCertificateDate, completedAt: accountCertificateDate,
  allocationItems: [{
    allocationId: accountCertificateAllocation.allocationId,
    taxpayerTin: accountCertificateAllocation.taxpayerTin,
    taxpayerName: accountCertificateAllocation.taxpayerName,
    paymentServiceEn: accountCertificateLine.headNameEn,
    paymentServiceBn: accountCertificateLine.headNameBn,
    assessmentYear: accountCertificateAllocation.assessmentYear,
    amountMinor: accountCertificateAllocation.amountMinor,
    economicCode: accountCertificateLine.economicCode
  }]
};
const accountCertificatePayment = {
  id: accountCertificateId, service: 'PENALTY', status: 'SIMULATED_SUCCESS',
  amountMinor: 13000, createdAt: accountCertificateDate,
  details: {
    allocationContractVersion: 3, payerMode: 'OTHER', payerName: 'Sample payer',
    payerTin: '2222222222222', taxpayerTin: '1111111111111',
    assessmentYear: '2026-27', paymentMethod: 'BKASH',
    receiptReference: 'ACS-2026-00130', lines: [accountCertificateLine],
    allocations: [accountCertificateAllocation], receiptSnapshot: accountCertificateSnapshot
  }
};

/** No hosted SQL/Auth is contacted: every signed-in API request is intercepted at .invalid. */
async function installCertificateAccountFixture(
  page: Page,
  userId: string,
  initiallyUnavailable = false
): Promise<{ enableLedger: () => void; ledgerRequests: Array<Record<string, unknown>> }> {
  const accessToken = 'fixture-access-' + userId;
  let ledgerAvailable = !initiallyUnavailable;
  const ledgerRequests: Array<Record<string, unknown>> = [];
  await page.addInitScript(({ authHost, actor, token }) => {
    const user = {
      id: actor, aud: 'authenticated', role: 'authenticated',
      email: actor + '@example.invalid',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {}, created_at: '2026-11-13T00:00:00.000Z'
    };
    const session = {
      access_token: token, token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'fixture-refresh-' + actor, user
    };
    try {
      localStorage.setItem('sb-' + authHost + '-auth-token', JSON.stringify(session));
    } catch {
      // The script runs on about:blank before navigation; it runs again on the app origin.
    }
  }, { authHost: new URL(accountCertificateBackend).hostname.split('.')[0], actor: userId, token: accessToken });
  await page.addInitScript(() => {
    const target = window as unknown as { __taxpayFixturePrintCalls: number };
    target.__taxpayFixturePrintCalls = 0;
    Object.defineProperty(window, 'print', {
      configurable: true,
      value: () => { target.__taxpayFixturePrintCalls += 1; }
    });
  });
  await page.route(accountCertificateBackend + '/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const origin = request.headers().origin || 'http://127.0.0.1:4173';
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info, prefer, accept-profile, content-profile',
      'content-type': 'application/json'
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers, body: '' });
      return;
    }
    expect(request.headers().authorization).toBe('Bearer ' + accessToken);
    if (url.pathname === '/rest/v1/taxpay_site_logo' ||
        url.pathname === '/rest/v1/taxpay_site_banners') {
      expect(request.method()).toBe('GET');
      await route.fulfill({ status: 200, headers, body: '[]' });
      return;
    }
    if (url.pathname === '/auth/v1/user') {
      await route.fulfill({
        status: 200, headers,
        body: JSON.stringify({
          id: userId, aud: 'authenticated', role: 'authenticated',
          email: userId + '@example.invalid',
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {}, created_at: '2026-11-13T00:00:00.000Z'
        })
      });
      return;
    }
    if (url.pathname === '/rest/v1/rpc/taxpay_claim_story1_session' ||
        url.pathname === '/rest/v1/rpc/taxpay_claim_walkin_payer_payments') {
      await route.fulfill({ status: 200, headers, body: 'null' });
      return;
    }
    if (url.pathname === '/rest/v1/rpc/taxpay_my_story1_payments') {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).toEqual({ p_page: 1, p_per_page: 100 });
      expect(JSON.stringify(body)).not.toContain('1111111111111');
      ledgerRequests.push(body);
      if (!ledgerAvailable) {
        await route.fulfill({ status: 503, headers, body: JSON.stringify({ message: 'temporary fixture outage' }) });
        return;
      }
      const items = userId === accountCertificateOwner ? [accountCertificatePayment] : [];
      await route.fulfill({
        status: 200, headers,
        body: JSON.stringify({ items, total: items.length, page: 1 })
      });
      return;
    }
    throw new Error('Unexpected .invalid payment endpoint request: ' + request.method() + ' ' + url.pathname);
  });
  return { enableLedger: () => { ledgerAvailable = true; }, ledgerRequests };
}

for (const [language, project] of [['en', 'desktop-1280'], ['bn', 'mobile-320']] as const) {
  test('F-168 / US-169 signed-in certificate register opens separate receipt and Payment Certificate (' + language + ')', async ({ page }, info) => {
    test.skip(info.project.name !== project, 'Run the English desktop and Bengali phone representatives.');
    const fixture = await installCertificateAccountFixture(page, accountCertificateOwner);
    await page.goto('/?action=certificates' + (language === 'bn' ? '&lang=bn' : ''));
    const pageHeading = language === 'bn' ? 'কর ক্রেডিট সনদপত্র' : 'Tax Credit Certificates';
    const receiptAction = language === 'bn' ? 'রসিদ দেখুন' : 'View receipt';
    const certificateAction = language === 'bn' ? 'পেমেন্ট সনদ দেখুন' : 'View payment certificate';
    const downloadAction = language === 'bn' ? 'ডাউনলোড' : 'Download';
    const register = page.getByTestId('account-certificate-record-register');
    const visibleRecords = page.getByTestId(language === 'bn'
      ? 'account-certificate-payment-cards' : 'account-certificate-payment-table');
    await expect(page.getByRole('heading', { name: pageHeading, exact: true })).toBeVisible();
    await expect(page.getByTestId('issued-tax-credit-certificates'))
      .toContainText(language === 'bn' ? 'ইস্যুকারী কর্তৃপক্ষের যাচাইকৃত কর ক্রেডিট সনদপত্র নেই' :
        'No issuer-verified tax credit certificates are available');
    await expect(visibleRecords).toBeVisible();
    await expect(visibleRecords.getByText(accountCertificateId)).toBeVisible();
    await expect(register).toContainText('Nusrat Jahan');
    await expect(register).toContainText('2026-27');
    await expect(register).toContainText('৳');
    await expect(visibleRecords.getByRole('button', { name: receiptAction, exact: true })).toBeVisible();

    await register.getByRole('button', { name: receiptAction, exact: true }).click();
    const paper = page.locator('.receipt-view__paper');
    await expect(paper).toBeVisible();
    await expect(paper).toContainText('Nusrat Jahan');
    await expect(paper).toContainText('1111111111111');
    await expect(paper).toContainText('ACS-2026-00130');

    if (language === 'en') {
      const receiptDownload = page.waitForEvent('download', { timeout: 20000 });
      await page.getByRole('button', { name: downloadAction, exact: true }).click();
      const receiptFile = await receiptDownload;
      const receiptPath = await receiptFile.path();
      expect(receiptPath).toBeTruthy();
      expect((await readFile(receiptPath!)).subarray(0, 5).toString()).toBe('%PDF-');
      await page.getByRole('button', { name: 'Print receipt', exact: true }).click();
      expect(await page.evaluate(() => (window as unknown as { __taxpayFixturePrintCalls: number }).__taxpayFixturePrintCalls)).toBe(1);
    }

    await page.getByRole('button', { name: certificateAction, exact: true }).click();
    const certificate = page.getByTestId('payment-certificate-document');
    await expect(certificate).toBeVisible();
    await expect(certificate.getByRole('heading', {
      name: language === 'bn' ? 'পেমেন্ট সনদ' : 'Payment Certificate'
    })).toBeVisible();
    await expect(page.getByTestId('payment-certificate-reference')).toContainText('SK-PC-' + accountCertificateId);
    await expect(certificate).toContainText('Nusrat Jahan');
    await expect(certificate).toContainText('1111111111111');
    await expect(certificate).toContainText(language === 'bn' ? 'জরিমানা ও সরল সুদ' : 'Penalty & Simple Interest');
    await expect(certificate).toContainText('2026-27');
    await expect(page.getByTestId('payment-certificate-total')).toContainText(language === 'bn' ? '১৩০' : '130');
    await expect(certificate).not.toContainText('SIMULATED_SUCCESS');
    await expect(certificate).not.toContainText('PENDING_RECONCILIATION');

    const certificateDownload = page.waitForEvent('download', { timeout: 20000 });
    await page.getByRole('button', { name: downloadAction, exact: true }).click();
    const certificateFile = await certificateDownload;
    expect(certificateFile.suggestedFilename()).toBe('Payment-certificate-' + accountCertificateId + '.pdf');
    const certificatePath = await certificateFile.path();
    expect(certificatePath).toBeTruthy();
    const certificateBytes = await readFile(certificatePath!);
    expect(certificateBytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(certificateBytes.toString('latin1')).toContain('Sohojkor Payment Certificate ' + accountCertificateId);

    await page.getByRole('button', {
      name: language === 'bn' ? 'সনদ প্রিন্ট' : 'Print certificate', exact: true
    }).click();
    expect(await page.evaluate(() => (window as unknown as { __taxpayFixturePrintCalls: number }).__taxpayFixturePrintCalls))
      .toBe(language === 'bn' ? 1 : 2);
    expect(fixture.ledgerRequests.length).toBeGreaterThan(0);
  });
}

test('F-168 / US-169 restores the account payment register after a temporary document-read failure', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Representative recovery breakpoint.');
  const fixture = await installCertificateAccountFixture(page, accountCertificateOwner, true);
  await page.goto('/?action=certificates');
  await expect(page.getByRole('alert')).toContainText('Payment records are temporarily unavailable.');
  expect(fixture.ledgerRequests.length).toBeGreaterThan(0);

  fixture.enableLedger();
  await page.reload();
  const register = page.getByTestId('account-certificate-record-register');
  await expect(register.getByText(accountCertificateId, { exact: true })).toBeVisible();
  await expect(register.getByRole('button', { name: 'View receipt', exact: true })).toHaveCount(1);
  expect(fixture.ledgerRequests.length).toBeGreaterThan(1);
});

test('F-168 / US-169 keeps a different signed-in taxpayer document list owner-scoped', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-375', 'Representative account privacy breakpoint.');
  await installCertificateAccountFixture(page, accountCertificateOther);
  await page.goto('/?action=certificates');
  await expect(page.getByTestId('issued-tax-credit-certificates'))
    .toContainText('No issuer-verified tax credit certificates are available');
  const register = page.getByTestId('account-certificate-record-register');
  await expect(register).toContainText('No payment records in this summary.');
  await expect(register.getByText(accountCertificateId, { exact: true })).toHaveCount(0);
  await expect(register.getByText('Nusrat Jahan', { exact: true })).toHaveCount(0);
});


test('F-172 signed-in certificate parent deep link reads only its original Taxpayer SQL owner', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Representative signed-in owner device.');
  await installCertificateAccountFixture(page, accountCertificateOwner);
  await page.goto('/?action=payment_details&transactionId=' + accountCertificateId);
  const certificate = page.getByTestId('payment-certificate-document');
  await expect(certificate).toBeVisible();
  await expect(certificate).toContainText('Nusrat Jahan');
  await expect(page.getByTestId('payment-certificate-reference'))
    .toContainText('SK-PC-' + accountCertificateId);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('F-172 signed-in certificate parent cannot be read through another owner', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-375', 'Representative signed-in privacy device.');
  await installCertificateAccountFixture(page, accountCertificateOther);
  await page.goto('/?action=payment_details&transactionId=' + accountCertificateId);
  await expect(page.getByRole('alert'))
    .toContainText('Payment record is not linked to this account');
  await expect(page.getByTestId('payment-certificate-document')).toHaveCount(0);
});
