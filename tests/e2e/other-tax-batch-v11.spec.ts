import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

const getFlow = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  return dialog;
};

test('Other Tax has five v11 groups, never Return, and uses in-place clickable checkbox rows', async ({ page }) => {
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  // Taxpayer beneficiary names are optional; payer/receipt names stay distinct.
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();

  const batch = dialog.getByTestId('other-tax-batch');
  await expect(batch).toBeVisible();
  await expect(batch).toContainText('42 available Other Tax heads');
  await expect(batch.locator('[data-head-group]')).toHaveCount(5);
  await expect(batch.locator('[data-head-group="Tax with Return"]')).toHaveCount(0);
  await expect(batch.locator('#other-tax-target')).toHaveCount(0);
  await expect(batch.getByRole('button', { name: /^Add (68A|68B)/ })).toHaveCount(0);
  await expect(batch.getByRole('heading', { name: /Selected payment heads/ })).toHaveCount(0);

  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  const h68a = batch.getByRole('checkbox', { name: /Select 68A/ });
  const h68b = batch.getByRole('checkbox', { name: /Select 68B/ });
  await expect(h68a).toBeVisible();
  await expect(h68b).toBeVisible();
  await expect(batch.locator('[data-head-group="Advance Tax"]')).toContainText('Advance tax on cigarrete manufacturer');
  await expect(batch.locator('[data-head-group="Advance Tax"]')).toContainText('Advance tax for the owners of private motor car');
  await h68a.check();
  await h68b.check();
  await expect(batch.getByTestId('other-tax-line')).toHaveCount(2);
  await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('1000');
  await batch.getByTestId('other-tax-line').last().locator('input[id^="other-tax-amount"]').fill('2000');
  await expect(batch.getByTestId('other-tax-combined-total')).toHaveText('BDT 3,000');
  await expect(dialog.locator('.payment-form-summary__breakdown')).toContainText('68A — Advance tax on cigarrete manufacturer');
  await expect(dialog.locator('.payment-form-summary__breakdown')).toContainText('68B — Advance tax for the owners of private motor car');

  await h68a.uncheck();
  await expect(batch.getByTestId('other-tax-line')).toHaveCount(1);
  await expect(batch.getByTestId('other-tax-combined-total')).toHaveText('BDT 2,000');
  await batch.locator('[data-head-group="Others"] summary').click();
  await expect(batch.getByRole('checkbox', { name: /Select 19AAAAA/ })).toBeDisabled();
});

test('switching taxpayer preserves each person’s head, year and amount without a target dropdown', async ({ page }) => {
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  const other = dialog.getByTestId('other-tax-taxpayer');
  await other.locator('input[id^="other-tax-tin"]').fill('222222222222');
  await other.locator('input[id^="other-tax-name"]').fill('Taxpayer Beta');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('1000');

  const tabs = batch.getByTestId('other-tax-taxpayer-tabs');
  await tabs.getByRole('button').nth(1).click();
  await expect(batch.getByTestId('other-tax-line')).toHaveCount(0);
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('select[id^="other-tax-year"]').selectOption('2025-26');
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('2000');
  await expect(batch.getByTestId('other-tax-combined-total')).toHaveText('BDT 3,000');
  const groupedTotals = dialog.getByTestId('grouped-taxpayer-calculation');
  await expect(groupedTotals.locator('details')).toHaveCount(2);
  await expect(groupedTotals.locator('details').first().locator('summary')).toContainText('1,000');
  await expect(groupedTotals.locator('details').nth(1).locator('summary')).toContainText('2,000');
  await expect(groupedTotals).toContainText('111111111111');
  await expect(groupedTotals).toContainText('Taxpayer Beta');
  await groupedTotals.locator('details').nth(1).locator('summary').click();
  await expect(groupedTotals.locator('details').nth(1)).toContainText('2025-26');

  await tabs.getByRole('button').first().click();
  await expect(batch.getByTestId('other-tax-line')).toHaveCount(1);
  await expect(batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]')).toHaveValue('1000');
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await dialog.getByRole('button', { name: 'Remove taxpayer 2' }).click();
  await dialog.getByRole('button', { name: 'Yes, remove' }).click();
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByTestId('other-tax-combined-total')).toHaveText('BDT 1,000');
});

test('other-tax allocations create individual records with their own receipts', async ({ page }) => {
  const submitted: Record<string, unknown>[] = [];
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, id: '00000000-0000-4000-8000-000000000101', status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
    }) });
  });
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Others"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 16A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('2500');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  await expect(dialog.getByText('A separate payment record will be created for each selected head.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm each taxpayer TIN/ }).check();
  const pay = dialog.getByRole('button', { name: /Pay BDT 2,500/ });
  await expect(pay).toBeEnabled();
  await pay.click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByTestId('other-tax-batch-result')).toHaveCount(1);
  await expect(dialog.getByTestId('other-tax-batch-result')).toContainText('111111111111');
  await expect(dialog.getByTestId('other-tax-batch-result')).toContainText('Record saved');
  expect(submitted).toHaveLength(1);
  expect(submitted[0].amountMinor).toBe(250000);
});

test('Other Tax starts with one TIN and an optional name, and added rows remain clear on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const dialog = await getFlow(page);
  const list = dialog.getByTestId('other-tax-taxpayer-list');
  await expect(list).toContainText('1 taxpayer added');
  await expect(dialog.getByTestId('other-tax-primary-taxpayer')).toContainText('Taxpayer 1');
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  await expect(list).toContainText('2 taxpayers added');
  const added = dialog.getByTestId('other-tax-taxpayer');
  await expect(added).toHaveCount(1);
  await expect(added.locator('input[id^="other-tax-tin-"]')).toBeFocused();
  await added.locator('input[id^="other-tax-tin-"]').fill('222222222222');
  await expect(added.getByText('Taxpayer name (optional)')).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
  await expect(dialog.getByTestId('other-tax-batch').getByTestId('other-tax-taxpayer-tabs').getByRole('button')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await dialog.getByRole('button', { name: 'Remove taxpayer 2' }).click();
  await expect(added).toHaveCount(0);
  await expect(list).toContainText('1 taxpayer added');
  expect(await list.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
test('Other Tax rejects duplicate TINs but does not require names', async ({ page }) => {
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  const tin2 = dialog.locator('input[id^="other-tax-tin-"]');
  await tin2.fill('111111111111');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText('Enter a different 12-digit TIN for each taxpayer. Names are optional.')).toBeVisible();
  await tin2.fill('222222222222');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
});

test('Other Tax numeric-only amounts and inline invalid-row guidance survive correction', async ({ page }) => {
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  const amount = batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]');
  await amount.fill('letters and e+');
  await expect(amount).toHaveValue('');
  await amount.fill('123.456');
  await expect(amount).toHaveValue('');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(batch.getByTestId('other-tax-validation-summary')).toContainText('Correct the highlighted payment heads');
  await expect(batch.locator('[data-head-group="Advance Tax"]')).toHaveAttribute('data-invalid', 'true');
  await expect(batch.locator('[data-head-id]')).toHaveAttribute('data-invalid', 'true');
  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await expect(batch.locator('.other-tax-section--invalid')).toHaveCount(1);
  await expect(batch.locator('#' + await amount.getAttribute('aria-describedby'))).toContainText('Enter a positive amount');
  await amount.fill('১২৩.৪৫');
  await expect(amount).toHaveValue('123.45');
  await expect(batch.getByTestId('other-tax-validation-summary')).toHaveCount(0);
  await expect(amount).not.toHaveAttribute('aria-invalid', 'true');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
});

test('Other Tax shows the affected taxpayer when another beneficiary has a missing amount', async ({ page }) => {
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  await dialog.getByTestId('other-tax-taxpayer').locator('input[id^="other-tax-tin"]').fill('222222222222');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  const tabs = batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button');
  await tabs.nth(1).click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('2000');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(tabs.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(tabs.first()).toContainText('1 incomplete');
  const invalid = batch.locator('[data-head-id][data-invalid="true"]');
  await expect(invalid).toHaveCount(1);
  await expect(batch.locator('[data-head-group="Advance Tax"]')).toHaveAttribute('open', '');
  await invalid.locator('input[id^="other-tax-amount"]').fill('1000');
  await expect(batch.getByTestId('other-tax-validation-summary')).toHaveCount(0);
  await expect(batch.getByTestId('other-tax-combined-total')).toHaveText('BDT 3,000');
});

test('every added taxpayer needs a selected head before review', async ({ page }) => {
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Payer Name');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  await dialog.getByTestId('other-tax-taxpayer').locator('input[id^="other-tax-tin"]').fill('222222222222');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('15');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(batch.getByTestId('other-tax-validation-summary')).toContainText('Select at least one payment head for taxpayer 2.');
  await expect(batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await batch.getByRole('checkbox', { name: /Select 68B/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('35');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByTestId('payment-review')).toBeVisible();
});

test('long BDT amounts and taxpayer descriptions stay inside the calculation panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.locator('#other-tax-primary-name').fill('Long Taxpayer Name Sample');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByRole('checkbox', { name: /Select 68B/ }).check();
  await batch.getByTestId('other-tax-line').nth(0).locator('input[id^="other-tax-amount"]').fill('43122314534');
  await batch.getByTestId('other-tax-line').nth(1).locator('input[id^="other-tax-amount"]').fill('124123412124');
  const summary = dialog.locator('.payment-form-summary');
  await expect(summary.locator('.payment-form-summary__entry-description small')).toHaveCount(2);
  await expect(summary.locator('.payment-form-summary__total')).toContainText('1,67,24,57,26,658');
  expect(await summary.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  for (const entry of await summary.locator('.payment-form-summary__entry').all()) {
    expect(await entry.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await summary.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test('SELF and OTHER guest Other Tax choices use the same grouped heads and omit the legacy income-type UI', async ({ page }) => {
  for (const relationship of ['SELF', 'OTHER'] as const) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
    await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', relationship);
    await dialog.locator('#guest-tin').fill('111111111111');
    if (relationship === 'OTHER') await dialog.locator('#guest-payer-name').fill('Sample Payer');
    await dialog.locator('#guest-phone').fill('01712345678');
    await expect(dialog.getByTestId('other-tax-taxpayer-list')).toBeVisible();
    if (relationship === 'SELF') await expect(dialog.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
    else await expect(dialog.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
    await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
    await expect(dialog.locator('[data-head-group]')).toHaveCount(5);
    await expect(dialog.locator('#guest-income-type-NON_COMPANY')).toHaveCount(0);
    await expect(dialog.locator('#guest-head-search')).toHaveCount(0);
    await expect(dialog.getByTestId('other-tax-batch')).toContainText('42 available Other Tax heads');
    await dialog.locator('[data-head-group="Advance Tax"] summary').click();
    await dialog.getByRole('checkbox', { name: /Select 68A/ }).check();
    await dialog.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('250');
    await expect(dialog.getByTestId('other-tax-combined-total')).toHaveText('BDT 250');
  }
});

test('signed-in SELF Other Tax preserves the locked account identity and canonical head catalogue', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'SELF');
  const identity = dialog.getByRole('region', { name: 'Account taxpayer details' });
  await expect(identity).toContainText('2222222222222');
  await expect(identity).toContainText('Meghna Trading Ltd.');
  await expect(identity).toContainText('01700000002');
  await expect(identity.locator('input')).toHaveCount(0);
  await expect(dialog.getByTestId('other-tax-primary-taxpayer')).toHaveCount(0);
  await expect(dialog.locator('#guest-phone')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await expect(batch.locator('[data-head-group]')).toHaveCount(5);
  await expect(batch.locator('[data-head-group="Tax with Return"]')).toHaveCount(0);
});

test('signed-in OTHER Tax leaves the beneficiary TIN editable and never substitutes the account TIN', async ({ page }) => {
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?actor=user1', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], simulationOnly: true }),
  }));
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await login.getByLabel('Password', { exact: true }).fill('user1');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  await expect(dialog.locator('#guest-tin')).toHaveValue('');
  await expect(dialog.locator('#guest-tin')).not.toHaveAttribute('readonly');
  await dialog.locator('#guest-tin').fill('123456789012');
  await expect(dialog.locator('#other-tax-primary-name')).not.toHaveAttribute('readonly');
  await expect(dialog.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
  await expect(dialog.locator('#guest-payer-name')).toHaveValue('Md. Arif Rahman');
  await expect(dialog.locator('#guest-payer-name')).toHaveAttribute('readonly');
  await expect(dialog.locator('#guest-phone')).toHaveValue('01700000001');
  await expect(dialog.locator('#guest-phone')).toHaveAttribute('readonly');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText(/Taxpayer 1 \(123456789012\) is not approved for payment through your account/)).toBeVisible();
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
});


test('Step 1 shows a pending calculation rather than a misleading zero', async ({ page }) => {
  const dialog = await getFlow(page);
  await expect(dialog.getByTestId('other-tax-taxpayer-list')).toContainText('1 taxpayer added');
  await expect(dialog.locator('.payment-form-summary__total')).toHaveText('—');
  await expect(dialog.locator('.payment-form-summary__help'))
    .toContainText('Your total will appear after you choose payment heads and amounts in Step 2.');
});

test('additional taxpayers are not blocked by an unapproved 20-person limit', async ({ page }) => {
  const dialog = await getFlow(page);
  const add = dialog.getByRole('button', { name: 'Add another taxpayer' });
  for (let index = 0; index < 20; index++) {
    await add.click();
  }
  await expect(dialog.getByTestId('other-tax-taxpayer')).toHaveCount(20);
  await expect(dialog.getByTestId('other-tax-taxpayer-list')).toContainText('21 taxpayers added');
  await expect(add).toBeEnabled();
  await expect(dialog.getByText('Maximum 20 taxpayers per payment.')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Remove taxpayer 21' }).click();
  await expect(dialog.getByTestId('other-tax-taxpayer')).toHaveCount(19);
});
