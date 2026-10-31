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

test('account beneficiary selector separates pending consent and adds multiple approved taxpayers without replacing them', async ({ page }) => {
  let currentStatus: 'PENDING' | 'ACTIVE' = 'PENDING';
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || url.searchParams.get('actor') !== 'user1') {
      await route.fulfill({ status: 403, body: '{"success":false,"error":"FORBIDDEN"}' });
      return;
    }
    const now = Date.now();
    const records = (['user2','user3'] as const).map((taxpayerId,index) => ({
      id: '11111111-1111-4111-8111-11111111111' + index,
      payerId: 'user1', taxpayerId, status: currentStatus,
      requestedAt: now - 1000, codeExpiresAt: now + 600000,
      consentCode: null, confirmedAt: currentStatus === 'ACTIVE' ? now - 500 : null,
      activeUntil: currentStatus === 'ACTIVE' ? now + 86400000 : null,
      attempts: 0, revokedAt: null, codeSentAt: null, codeResends: 0
    }));
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({success:true,data:records}) });
  });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await page.getByRole('textbox', { name: 'Password' }).fill('user1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  const panel = dialog.getByTestId('authorized-taxpayer-choices');
  await expect(panel.getByRole('heading', { name: 'Awaiting authorization: 2' })).toBeVisible();
  await expect(panel.getByText('Awaiting taxpayer approval')).toHaveCount(2);
  await expect(panel.getByRole('button', { name: /Add to this payment/ })).toHaveCount(0);
  // Reopen with now-approved records, exercising the exact same UI without altering hosted SQL.
  currentStatus = 'ACTIVE';
  await page.reload();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  const choices = dialog.getByTestId('authorized-taxpayer-choices');
  await expect(choices.getByText('You can pay for these taxpayers: 2')).toBeVisible();
  await choices.getByRole('button', { name: /2222222222222/ }).click();
  await expect(dialog.locator('#guest-tin')).toHaveValue('2222222222222');
  await choices.getByRole('button', { name: /3333333333333/ }).click();
  const list = dialog.getByTestId('other-tax-taxpayer-list');
  await expect(list.getByTestId('other-tax-taxpayer')).toHaveCount(1);
  await expect(list.locator('input[id^="other-tax-tin-"]')).toHaveValue('3333333333333');
  await expect(dialog.locator('#guest-tin')).toHaveValue('2222222222222');
});
