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

test('US-050 recovery preserves entered reference across an outage and retries the original receipt', async ({ page }) => {
  const paymentWrites: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/demo-story1-taxpay/payments') && request.method() !== 'GET')
      paymentWrites.push(request.method());
  });
  await page.route(/\/demo-story1-taxpay\/payments\?sessionId=/, async route =>
    route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'BACKEND_UNAVAILABLE' }) }));
  await page.goto('/?action=verify');
  const dialog = page.getByRole('dialog', { name: 'Payment status & receipt' });
  const referenceField = dialog.getByRole('textbox', { name: 'Challan, token or transaction reference' });
  const mobileField = dialog.getByRole('textbox', { name: 'Receipt mobile number' });
  await referenceField.fill(reference);
  await mobileField.fill(mobile);
  await dialog.getByRole('button', { name: 'Search records' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Saved session records are temporarily unavailable');
  await expect(dialog.getByRole('heading', { name: 'No matching record' })).toHaveCount(0);
  await expect(referenceField).toHaveValue(reference);
  await expect(mobileField).toHaveValue(mobile);
  await expect(dialog.locator('.receipt-view')).toHaveCount(0);

  // Replace only the disposable HTTP fixture; do not create a new transaction
  // or reset the payment reference/verified receipt-mobile values.
  await stubSessionRecord(page);
  await dialog.getByRole('button', { name: 'Search records' }).click();
  const receipt = dialog.locator('.receipt-view');
  await expect(receipt).toBeVisible();
  await expect(receipt).toContainText(reference);
  await expect(receipt.locator('.receipt-view__paper')).toContainText('12,500');
  await expect(receipt.locator('.receipt-view__status')).toHaveCount(0);
  // The approved receipt-success view replaces the form; the input-preservation
  // assertions above apply before retry, while this verifies clean completion.
  await expect(referenceField).toHaveCount(0);
  await expect(mobileField).toHaveCount(0);
  expect(paymentWrites).toEqual([]);
});


// F-129 / US-050: the new B-owned Edge reference lookup requires an existing
// private profile possession capability. All records below are synthetic
// browser fixtures; these tests do not connect to hosted Supabase or issue a
// payment. The old guest session/mobile read remains a safe fallback.
const profilePaymentId='853f43d4-a39e-4ae2-9bb2-0bbcdf4d58e5';
const profileCapability='A'.repeat(43);
const profileSessionId='8a32e1c4-6be6-43ea-9ab8-995b28f5f6c7';
const profileReceiptSource={
  id:profilePaymentId,service:'TAX_WITH_RETURN',status:'SIMULATED_SUCCESS',
  amountMinor:1250000,createdAt:'2026-10-24T10:00:00Z',
  details:{payerId:'user1',receiptReference:reference,receiptMobile:mobile,
    receiptSnapshot:snapshot}
};
async function installReferenceProfile(page:import('@playwright/test').Page) {
  await page.addInitScript(({capability,sessionId})=>{
    sessionStorage.setItem('taxpay-taxpayer-preview-user','user1');
    sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({
      profileId:'user1',capability,paymentSessionId:sessionId,language:'en',selectedListId:null
    }));
  },{capability:profileCapability,sessionId:profileSessionId});
}

test('F-129 US-050 capability-backed original reference opens the saved receipt after refresh',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Owner capability representative');
  await installReferenceProfile(page);
  const reads:string[]=[];
  await page.route(/\/demo-story1-taxpay\/payments\/reference\?/,async route=>{
    const req=route.request();
    expect(req.headers()['x-taxpay-guest-capability']).toBe(profileCapability);
    expect(req.url()).toContain('reference='+encodeURIComponent(reference));
    reads.push(req.method());
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,simulationOnly:true,data:profileReceiptSource})});
  });
  await page.goto('/?action=verify');
  await page.reload();
  const dialog=page.getByRole('dialog',{name:'Payment status & receipt'});
  await dialog.getByRole('textbox',{name:'Challan, token or transaction reference'}).fill(reference);
  await dialog.getByRole('button',{name:'Search records'}).click();
  await expect(dialog.locator('.receipt-view__paper')).toContainText(reference);
  await expect(dialog.locator('.receipt-view__paper')).toContainText('12,500');
  expect(reads).toEqual(['GET']);
});

test('F-129 US-050 valid profile wrong-mobile 404 denies without falling through to another session',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Profile denial representative');
  await installReferenceProfile(page);
  let legacyReads=0;
  await page.route(/\/demo-story1-taxpay\/payments\?sessionId=/,async route=>{
    legacyReads++;await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,data:{items:[],total:0}})});
  });
  await page.route(/\/demo-story1-taxpay\/payments\/reference\?/,route=>
    route.fulfill({status:404,contentType:'application/json',
      body:JSON.stringify({success:false,error:'NOT_FOUND'})}));
  await page.goto('/?action=verify');
  const dialog=page.getByRole('dialog',{name:'Payment status & receipt'});
  await dialog.getByRole('textbox',{name:'Challan, token or transaction reference'}).fill(reference);
  await dialog.getByRole('textbox',{name:'Receipt mobile number'}).fill('01700000000');
  await dialog.getByRole('button',{name:'Search records'}).click();
  await expect(dialog.getByRole('heading',{name:'No matching record'})).toBeVisible();
  await expect(dialog.locator('.receipt-view')).toHaveCount(0);
  expect(legacyReads).toBe(0);
});

test('F-129 US-050 source outage keeps reference for retry, never fabricates a missing receipt',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Outage and retry representative');
  await installReferenceProfile(page);
  let calls=0;
  await page.route(/\/demo-story1-taxpay\/payments\/reference\?/,async route=>{
    calls++;
    await route.fulfill({status:calls===1?503:200,contentType:'application/json',
      body:JSON.stringify(calls===1?{success:false,error:'PAYMENT_LOOKUP_UNAVAILABLE'}
        :{success:true,simulationOnly:true,data:profileReceiptSource})});
  });
  await page.goto('/?action=verify');
  const dialog=page.getByRole('dialog',{name:'Payment status & receipt'});
  const input=dialog.getByRole('textbox',{name:'Challan, token or transaction reference'});
  await input.fill(reference);
  await dialog.getByRole('button',{name:'Search records'}).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'No matching record'})).toHaveCount(0);
  await expect(input).toHaveValue(reference);
  await dialog.getByRole('button',{name:'Search records'}).click();
  await expect(dialog.locator('.receipt-view__paper')).toContainText(reference);
  expect(calls).toBe(2);
});
