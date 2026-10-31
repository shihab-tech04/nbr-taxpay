import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('payment stepper has connected numbered states and shows completed progression', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN');
  const progress = dialog.locator('.taxpay-modal__progress');
  await expect(progress).toHaveCSS('height', '10px');
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(dialog.locator('.taxpay-modal__step-count')).toHaveText('1/4 Steps');
  const card = dialog.getByRole('region', { name: 'Account taxpayer details' });
  await expect(card).toHaveCount(0); // Guests enter their identity; account fields never appear accidentally.
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
  await expect(dialog.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');
});

test('guest Other Tax shows one collapsible calculation group per beneficiary and exact subtotal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-payer-name').fill('Example Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  await dialog.getByTestId('other-tax-taxpayer').locator('input[id^="other-tax-tin-"]').fill('234567890123');
  const grouped = dialog.getByTestId('grouped-taxpayer-calculation');
  await expect(grouped.locator('details')).toHaveCount(2);
  await expect(grouped).toContainText('123456789012');
  await expect(grouped).toContainText('234567890123');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('2100');
  const tabs = batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button');
  await tabs.nth(1).click();
  await batch.getByRole('checkbox', { name: /Select 68B/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('3500');
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('5,600');
  await expect(grouped.locator('details')).toHaveCount(2);
  await expect(grouped.locator('details').nth(0).locator('summary')).toContainText('2,100');
  await expect(grouped.locator('details').nth(1).locator('summary')).toContainText('3,500');
  const mobileCalculation = dialog.getByTestId('mobile-payment-calculation');
  if (await mobileCalculation.count()) {
    await mobileCalculation.getByTestId('mobile-payment-calculation-toggle').click();
    await expect(mobileCalculation).toHaveAttribute('open', '');
  }
  await grouped.locator('details').nth(1).locator('summary').click();
  await expect(grouped.locator('details').nth(1)).toHaveAttribute('open', '');
  await expect(grouped.locator('details').nth(1)).toContainText('68B');
  expect(await dialog.locator('.taxpay-modal__body').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(2);
});

test('account taxpayer data is flat and recommendations do not claim liabilities from a historical record', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await page.getByRole('textbox', { name: 'Password' }).fill('user1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN', 'SELF');
  await expect(dialog.locator('#guest-tin')).toHaveValue('1111111111111');
  await expect(dialog.locator('#guest-tin')).toHaveAttribute('readonly', '');
  await expect(dialog.locator('#guest-taxpayer-name')).toHaveValue('Md. Arif Rahman');
  await expect(dialog.locator('#guest-taxpayer-name')).toHaveAttribute('readonly', '');
  await dialog.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(dialog.locator('#guest-taxpayer-name')).toHaveValue('Md. Arif Rahman');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText('Based on this taxpayer’s recorded demo activity.')).toHaveCount(0);
});

test('account beneficiary lists keep selection separate from taxpayer consent', async ({ page }) => {
  let currentStatus: 'PENDING' | 'ACTIVE' = 'PENDING';
  const listId = '00000000-0000-4000-8000-000000000001';
  const timestamp = '2026-01-01T00:00:00Z';
  const members = [
    {id:'00000000-0000-4000-8000-000000000002',list_id:listId,tin:'2222222222222',display_name:'Taxpayer Two',created_at:timestamp,updated_at:timestamp},
    {id:'00000000-0000-4000-8000-000000000003',list_id:listId,tin:'3333333333333',display_name:'Taxpayer Three',created_at:timestamp,updated_at:timestamp}
  ];
  await page.route('**/functions/v1/taxpay-guest-beneficiaries', async route => {
    const input = route.request().postDataJSON() as {action?:string;offset?:number;limit?:number};
    const data = input.action==='open'?{active:true}
      :input.action==='lists'?[{id:listId,name:'Family',created_at:timestamp}]
      :input.action==='people'?members.slice(input.offset??0,(input.offset??0)+(input.limit??500)):[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || url.searchParams.get('actor') !== 'user1') {
      await route.fulfill({ status: 403, body: '{"success":false,"error":"FORBIDDEN"}' });
      return;
    }
    const now = Date.now();
    const records = (['user2','user3'] as const).map((taxpayerId,index) => ({
      id: '11111111-1111-4111-8111-11111111111' + index,
      payerId:'user1',taxpayerId,status:currentStatus,
      requestedAt:now-1000,codeExpiresAt:now+600000,
      consentCode:null,confirmedAt:currentStatus==='ACTIVE'?now-500:null,
      activeUntil:currentStatus==='ACTIVE'?now+86400000:null,
      attempts:0,revokedAt:null,codeSentAt:null,codeResends:0
    }));
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:records})});
  });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user1');
  await page.getByRole('textbox',{name:'Password'}).fill('user1');
  await page.getByRole('button',{name:'Sign In'}).click();
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).first().click();
  let dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog,'OTHER_TAX_PAYMENT','OTHER');
  let picker=dialog.getByTestId('saved-beneficiary-picker');
  await expect(picker.getByRole('button',{name:'Family'})).toHaveAttribute('aria-expanded','true');
  await expect(dialog.getByTestId('authorized-taxpayer-choices')).toHaveCount(0);
  await expect(dialog.locator('#guest-tin')).toHaveCount(0);
  await picker.getByRole('checkbox',{name:'Select Taxpayer Two'}).check();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByText(/not approved for payment through your account/)).toBeVisible();
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
  // Reopen with the same saved list and now-active independent consent for both people.
  currentStatus='ACTIVE';
  await page.reload();
  await page.getByRole('button',{name:'Pay Tax',exact:true}).first().click();
  dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog,'OTHER_TAX_PAYMENT','OTHER');
  picker=dialog.getByTestId('saved-beneficiary-picker');
  await picker.getByRole('checkbox',{name:'Select Taxpayer Two'}).check();
  await picker.getByRole('checkbox',{name:'Select Taxpayer Three'}).check();
  await expect(picker).toContainText('2 selected for this payment');
  await expect(dialog.getByTestId('other-tax-taxpayer-list')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
  await expect(dialog.getByTestId('other-tax-batch')).toContainText('2222222222222');
  await expect(dialog.getByTestId('other-tax-batch')).toContainText('3333333333333');
});
