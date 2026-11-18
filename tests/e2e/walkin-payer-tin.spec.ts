import { expect, test, type Page } from '@playwright/test';
import { enterTaxPayService, ensureNewPaymentEntry } from './pay-tax-entry-helper';

async function openGuestOtherTax(page: Page, locale: 'en' | 'bn' = 'en') {
  await page.goto(locale === 'bn' ? '/?action=landing&lang=bn' : '/');
  await page.getByRole('button', { name: locale === 'bn' ? 'কর পরিশোধ' : 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: locale === 'bn' ? 'কর পরিশোধ' : 'Pay Tax' });
  if (locale === 'en') {
    await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  } else {
    await ensureNewPaymentEntry(dialog);
    await dialog.locator('[data-payer-relationship="OTHER"]').click();
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await dialog.locator('[data-payment-access="GUEST"]').click();
    await dialog.locator('.tax-service-choice__actions').getByRole('button', { name: 'এগিয়ে যান', exact: true }).click();
  }
  const primary = dialog.getByTestId('other-tax-primary-taxpayer');
  await dialog.locator('#guest-tin').fill('222222222222');
  await primary.getByRole('button', { name: locale === 'bn' ? /খুঁজুন/ : /^Search(?: TIN)?$/ }).click();
  await primary.getByRole('button', { name: locale === 'bn' ? /করদাতা যোগ করুন/ : 'Add taxpayer' }).click();
  await dialog.locator('#guest-payer-name').fill('Walk-in Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  return dialog;
}

test('optional payer TIN requires lookup and explicit confirmation without changing beneficiary', async ({ page }) => {
  const dialog = await openGuestOtherTax(page);
  const payer = dialog.getByTestId('walkin-payer-tin');
  const payerTin = payer.locator('#guest-payer-tin');
  const payerName = payer.locator('#guest-payer-tin-name');
  const next = dialog.getByRole('button', { name: 'Continue to purpose & amount' });
  await expect(payerTin).toBeVisible();
  await expect(payerName).toBeHidden();
  await expect(payerTin).not.toHaveAttribute('required','');
  await expect(next).toBeEnabled(); // Blank payer TIN retains existing walk-in flow.
  await payerTin.fill('123456789012');
  await expect(payerName).toBeHidden();
  await expect(next).toBeDisabled();
  await payer.getByRole('button', { name: 'Search payer TIN' }).click();
  await expect(payer.getByRole('button',{ name:'Confirm payer' })).toHaveCount(0);
  await expect(payerName).toBeHidden();
  await expect(next).toBeDisabled();

  await payerTin.fill('111111111111');
  await expect(payerName).toBeHidden(); // A result is not shown before Search.
  await expect(next).toBeDisabled();
  await payer.getByRole('button', { name: 'Search payer TIN' }).click();
  await expect(payerName).toBeVisible();
  await expect(payerName).toHaveValue('User 1');
  await expect(next).toBeDisabled();
  await payer.getByRole('button', { name:'Confirm payer' }).click();
  await expect(dialog.locator('#guest-payer-name')).toHaveValue('User 1');
  await expect(dialog.getByTestId('other-tax-primary-taxpayer').getByTestId('confirmed-taxpayer-summary')).toContainText('222222222222');
  await expect(next).toBeEnabled();

  await payerTin.fill('333333333333');
  await expect(payerName).toBeHidden(); // Editing the TIN removes the previous result.
  await expect(next).toBeDisabled();
  await payer.getByRole('button', { name: 'Clear TIN search' }).click();
  await expect(payerName).toBeHidden();
  await expect(next).toBeEnabled(); // The payer TIN is optional.
  await payerTin.fill('111111111111');
  await expect(payerName).toBeHidden();
  await payer.getByRole('button', { name: 'Search payer TIN' }).click();
  await expect(payerName).toBeVisible();
  await payer.getByRole('button', { name:'Confirm payer' }).click();
  await next.click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
});

test('Bangla payer name stays hidden until a matching TIN search', async ({ page }) => {
  const dialog = await openGuestOtherTax(page, 'bn');
  const payer = dialog.getByTestId('walkin-payer-tin');
  const payerTin = payer.locator('#guest-payer-tin');
  const payerName = payer.locator('#guest-payer-tin-name');
  await expect(payerTin).toBeVisible();
  await expect(payerName).toBeHidden();

  await payerTin.fill('123456789012');
  await payer.getByRole('button', { name: 'পরিশোধকারীর টিআইএন খুঁজুন' }).click();
  await expect(payerName).toBeHidden();

  await payerTin.fill('111111111111');
  await expect(payerName).toBeHidden();
  await payer.getByRole('button', { name: 'পরিশোধকারীর টিআইএন খুঁজুন' }).click();
  await expect(payerName).toBeVisible();
  await expect(payerName).toHaveValue('ইউজার 1');

  await payerTin.fill('333333333333');
  await expect(payerName).toBeHidden();
  await payer.getByRole('button', { name: 'টিআইএন অনুসন্ধান মুছুন' }).click();
  await expect(payerName).toBeHidden();
});

test('confirmed payer TIN stays distinct from allocations and receipt on one SQL payment', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280');
  const submissions: Record<string, unknown>[] = [];
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,id:'00000000-0000-4000-8000-000000000901',
        status:'SIMULATED_SUCCESS',mirrored:true,simulationOnly:true})});
  });
  const dialog = await openGuestOtherTax(page);
  const payer = dialog.getByTestId('walkin-payer-tin');
  await payer.locator('#guest-payer-tin').fill('111111111111');
  await payer.getByRole('button', { name: 'Search payer TIN' }).click();
  await payer.getByRole('button', { name:'Confirm payer' }).click();
  await dialog.getByRole('button', { name:'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox',{name:/Select 68A/}).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('25');
  await dialog.getByRole('button',{name:'Continue to payment channel'}).click();
  await dialog.getByRole('button',{name:'Pay online'}).click();
  await dialog.getByRole('button',{name:'Mobile banking'}).click();
  await dialog.getByRole('radio',{name:'bKash'}).check();
  await dialog.getByRole('checkbox',{name:/I confirm each taxpayer TIN/}).check();
  await dialog.getByRole('button',{name:/Pay ৳ 25/}).click();
  await expect(dialog.getByRole('heading',{name:'Payment record saved'})).toBeVisible({timeout:15000});
  expect(submissions).toHaveLength(1);
  const details = submissions[0].details as Record<string,unknown>;
  const snapshot = details.receiptSnapshot as Record<string,unknown>;
  const allocations = details.allocations as Array<Record<string,unknown>>;
  expect(details.payerTin).toBe('111111111111');
  expect(details.payerName).toBe('User 1');
  expect(snapshot.payerTin).toBe('111111111111');
  expect(snapshot.payerName).toBe('User 1');
  expect(allocations).toHaveLength(1);
  expect(allocations[0].taxpayerTin).toBe('222222222222');
  expect(details.taxpayerTin).toBe('222222222222');
  expect(submissions[0].amountMinor).toBe(2500);
});
