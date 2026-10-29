import { test, expect, type Page } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

type Status = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'REVOKED';
function authorization(taxpayerId: 'user2' | 'user3', status: Status, activeUntil: number | null = null) {
  return { id: taxpayerId === 'user2' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
    payerId: 'user1', taxpayerId, status, requestedAt: Date.now() - 10000, codeExpiresAt: Date.now() + 60000,
    consentCode: null, confirmedAt: status === 'ACTIVE' ? Date.now() - 5000 : null, activeUntil, attempts: 0, revokedAt: null };
}
async function mockAuthorizations(page: Page, records: ReturnType<typeof authorization>[] | null) {
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?actor=user1', route => route.fulfill({
    status: records ? 200 : 503, contentType: 'application/json',
    body: JSON.stringify(records ? { success: true, data: records, simulationOnly: true } : { success: false, error: 'AUTHORIZATION_READ_FAILED' })
  }));
}
async function openSignedInOtherTax(page: Page, service = 'OTHER_TAX_PAYMENT') {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await login.getByLabel('Password', { exact: true }).fill('user1');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, service, 'OTHER');
  return dialog;
}

test('recognized, actively authorized demo TINs are not truncated', async ({ page }) => {
  await mockAuthorizations(page, [authorization('user2', 'ACTIVE')]);
  const dialog = await openSignedInOtherTax(page);
  const tin = dialog.locator('#guest-tin');
  await tin.fill('2222222222222');
  await expect(tin).toHaveValue('2222222222222');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText('Step 2 of 4')).toBeVisible();
});

test('the single-beneficiary service also accepts an authorized fictional TIN', async ({ page }) => {
  await mockAuthorizations(page, [authorization('user2', 'ACTIVE')]);
  const dialog = await openSignedInOtherTax(page, 'TAX_WITH_RETURN');
  const tin = dialog.locator('#guest-tin');
  await tin.fill('2222222222222');
  await expect(tin).toHaveValue('2222222222222');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText('Step 2 of 4')).toBeVisible();
});

for (const state of ['PENDING', 'EXPIRED', 'REVOKED', 'ACTIVE_EXPIRED'] as const) {
  test(`${state} consent cannot authorize a demo beneficiary`, async ({ page }) => {
    const status = state === 'ACTIVE_EXPIRED' ? 'ACTIVE' : state;
    await mockAuthorizations(page, [authorization('user2', status, state === 'ACTIVE_EXPIRED' ? Date.now() - 1000 : null)]);
    const dialog = await openSignedInOtherTax(page);
    await dialog.locator('#guest-tin').fill('2222222222222');
    await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
    await expect(dialog.getByText(/not approved for payment through your account/)).toBeVisible();
    await expect(dialog.getByText('Step 2 of 4')).toHaveCount(0);
  });
}

test('each additional demo taxpayer needs separate active consent', async ({ page }) => {
  await mockAuthorizations(page, [authorization('user2', 'ACTIVE')]);
  const dialog = await openSignedInOtherTax(page);
  await dialog.locator('#guest-tin').fill('2222222222222');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  const otherTin = dialog.locator('input[id^="other-tax-tin-"]');
  await otherTin.fill('3333333333333');
  await expect(otherTin).toHaveValue('3333333333333');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText(/Taxpayer 2 .* is not approved for payment/)).toBeVisible();
  await expect(dialog.getByText('Step 2 of 4')).toHaveCount(0);
});

test('an authorization read failure prevents continuing', async ({ page }) => {
  await mockAuthorizations(page, null);
  const dialog = await openSignedInOtherTax(page);
  await dialog.locator('#guest-tin').fill('2222222222222');
  await expect(dialog.getByText(/Authorizations could not be verified/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText(/Authorization could not be verified/)).toBeVisible();
});

test('guest TIN input stays limited to twelve digits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  const tin = dialog.locator('#guest-tin');
  await expect(tin).toHaveAttribute('maxlength', '12');
  await tin.fill('1234567890123');
  await expect(tin).toHaveValue('123456789012');
  await tin.fill('1234');
  await dialog.locator('#guest-payer-name').fill('Sample payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText('Enter the taxpayer’s 12-digit TIN.')).toBeVisible();
});

test('Bengali entry rejects an unknown demo TIN and accepts an approved one', async ({ page }) => {
  await mockAuthorizations(page, [authorization('user2', 'ACTIVE')]);
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await login.getByLabel('Password', { exact: true }).fill('user1');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
  await page.getByRole('button', { name: 'কর পরিশোধ', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'কর পরিশোধ' });
  await dialog.locator('[data-payer-relationship="OTHER"]').click();
  await dialog.locator('.tax-service-choice__actions button').click();
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await dialog.locator('.tax-service-choice__actions button').click();
  const tin = dialog.locator('#guest-tin');
  await tin.fill('1234567890123');
  await dialog.getByRole('button', { name: 'খাত ও পরিমাণে এগিয়ে যান' }).click();
  await expect(dialog.getByText('১২ সংখ্যার টিআইএন বা পরিচিত ১৩ সংখ্যার টিআইএন দিন।')).toBeVisible();
  await tin.fill('2222222222222');
  await dialog.getByRole('button', { name: 'খাত ও পরিমাণে এগিয়ে যান' }).click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
});

test('a taxpayer with saved heads cannot silently be changed to another TIN', async ({ page }) => {
  await mockAuthorizations(page, [authorization('user2', 'ACTIVE'), authorization('user3', 'ACTIVE')]);
  const dialog = await openSignedInOtherTax(page);
  const choices = dialog.getByTestId('authorized-taxpayer-choices');
  await choices.getByRole('button', { name: /2222222222222/ }).click();
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('1234.50');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.locator('#guest-tin')).toHaveAttribute('readonly', '');
  await expect(dialog.getByText(/first remove this taxpayer’s selected payment heads/)).toBeVisible();
  await choices.getByRole('button', { name: /3333333333333/ }).click();
  await expect(dialog.locator('#guest-tin')).toHaveValue('2222222222222');
  await expect(dialog.locator('input[id^="other-tax-tin-"]')).toHaveValue('3333333333333');
  await expect(dialog.getByTestId('grouped-taxpayer-calculation').locator('details').first()).toContainText('1,234.5');
});

test('signed-in facilitated payments save one record per selected taxpayer item', async ({ page }) => {
  await mockAuthorizations(page, [authorization('user2', 'ACTIVE'), authorization('user3', 'ACTIVE')]);
  const submitted: Array<Record<string, any>> = [];
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, id: `00000000-0000-4000-8000-${String(400 + submitted.length).padStart(12, '0')}`,
      status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
    }) });
  });
  const dialog = await openSignedInOtherTax(page);
  await dialog.locator('#guest-tin').fill('2222222222222');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  await dialog.locator('input[id^="other-tax-tin-"]').fill('3333333333333');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('15');
  await batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button').nth(1).click();
  await batch.getByRole('checkbox', { name: /Select 68B/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('35');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm each taxpayer TIN/ }).check();
  await dialog.getByRole('button', { name: /Pay BDT 50/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 15000 });
  expect(submitted.map(record => record.details.taxpayerTin)).toEqual(['2222222222222', '3333333333333']);
  expect(submitted.map(record => record.amountMinor)).toEqual([1500, 3500]);
  await expect(dialog.getByTestId('other-tax-batch-result')).toHaveCount(2);
});
