import { expect, test } from '@playwright/test';

/** Regression for the Nov 22 HTTP 400 INVALID_WALKIN_PAYER_TIN outage.
 * No actual SQL writes or real payments: this exercises client recovery
 * against the precise known SQL 422 response. The paired rollback-only SQL
 * trigger acceptance runs in the disposable Phase 02 database.
 */
test('parallel Walk-in accepts approved 13-digit demo payer and recovers from SQL payer rejection', async ({page}) => {
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await dialog.getByRole('button',{name:'Walk-in Payment'}).click();
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  await dialog.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await dialog.getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.getByRole('button',{name:'Continue to Payment Head'}).click();
  const batch=dialog.getByTestId('other-tax-batch');
  const advance=batch.locator('[data-head-group="Advance Tax"]');
  await advance.locator('summary').click();
  await batch.getByRole('checkbox',{name:/Select 68A/}).check();
  await batch.getByTestId('other-tax-line').first()
    .locator('input[id^="other-tax-amount"]').fill('3500');
  await dialog.getByRole('button',{name:'Continue to Final Preview'}).click();
  const payer=dialog.getByTestId('walkin-payer-tin');
  await payer.locator('#guest-payer-tin').fill('1111111111111');
  await payer.getByRole('button',{name:'Search payer TIN'}).click();
  await expect(dialog.getByTestId('unified-v5-payer-result')).toContainText('Md. Arif Rahman');
  await payer.getByRole('button',{name:'Confirm payer'}).click();
  await expect(dialog.locator('#guest-payer-name')).toHaveValue('Md. Arif Rahman');
  await dialog.locator('#guest-phone').fill('01712345678');

  let paymentPosts=0;
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route=>{
    if(route.request().method()!=='POST')return route.continue();
    paymentPosts++;
    const payload=route.request().postDataJSON();
    expect(payload.details.payerTin).toBe('1111111111111');
    expect(payload.details.receiptSnapshot.payerTin).toBe('1111111111111');
    expect(payload.details.receiptSnapshot.payerName).toBe('Md. Arif Rahman');
    await route.fulfill({status:422,contentType:'application/json',
      body:JSON.stringify({success:false,error:'UNCONFIRMED_WALKIN_PAYER',retryable:false})});
  });

  await dialog.getByRole('button',{name:'Make Payment'}).click();
  await dialog.getByRole('button',{name:'Pay online'}).click();
  await dialog.getByRole('button',{name:'Mobile banking'}).click();
  await dialog.getByRole('radio',{name:'bKash'}).check();
  await dialog.getByRole('checkbox',{name:/I have checked the taxpayers/}).check();
  await dialog.getByRole('button',{name:'Confirm payment'}).click();

  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Final Preview',{timeout:15000});
  await expect(dialog.locator('#guest-payer-tin')).toHaveValue('1111111111111');
  await expect(dialog.locator('#guest-phone')).toHaveValue('01712345678');
  await expect(payer.getByRole('alert')).toContainText('Payer name and TIN do not match');
  await expect(dialog.getByRole('heading',{name:'Payment record saved'})).toHaveCount(0);
  expect(paymentPosts).toBe(1);
  // Correcting a permanent validation issue starts a new, user-confirmed
  // attempt; never replay the same rejected SQL request automatically.
  await payer.locator('#guest-payer-tin').fill('');
  await expect(payer.getByRole('alert')).toHaveCount(0);
});
