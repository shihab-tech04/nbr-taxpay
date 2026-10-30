import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('guest manages isolated SQL-backed lists and prefills Pay Tax for Others without account auth', async ({ browser, page }) => {
  const localUrl = process.env.VITE_SUPABASE_URL;
  if (!localUrl) throw new Error('Refusing guest beneficiary acceptance without a disposable local Supabase URL.');
  const api = new URL(localUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(api.hostname))
    throw new Error('Refusing guest beneficiary acceptance outside loopback Supabase.');

  await page.goto('/?action=beneficiaries');
  const records = page.locator('[data-testid="beneficiaries-page"] ul:visible');
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create list', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in with email' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Manage taxpayer authorizations' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Create your first list' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Create list', exact: true }).first().click();
  const listDialog = page.getByRole('dialog', { name: 'Create list' });
  await listDialog.locator('#beneficiary-create-list-name').fill('Guest Family');
  await listDialog.getByRole('button', { name: 'Create list', exact: true }).click();
  await expect(page.getByText(/Guest Family.*is empty/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Create list', exact: true }).first().click();
  const secondListDialog = page.getByRole('dialog', { name: 'Create list' });
  await secondListDialog.locator('#beneficiary-create-list-name').fill('Guest Work');
  await secondListDialog.getByRole('button', { name: 'Create list', exact: true }).click();
  await expect(page.getByText(/Guest Work.*is empty/)).toBeVisible({ timeout: 15_000 });
  await page.locator('#beneficiary-list').selectOption({ label: 'Guest Family' });

  await page.getByRole('button', { name: 'Add beneficiary', exact: true }).first().click();
  const addDialog = page.getByRole('dialog', { name: 'Beneficiary entry' });
  await addDialog.locator('#beneficiary-tin').fill('012345678901');
  await addDialog.locator('#beneficiary-name').fill('Synthetic Guest One');
  await addDialog.getByRole('button', { name: 'Add beneficiary', exact: true }).click();
  await expect(records).toContainText('Synthetic Guest One', { timeout: 15_000 });
  await expect(page.getByText('Beneficiary saved.')).toBeVisible();

  await page.reload();
  await expect(records).toContainText('Synthetic Guest One', { timeout: 15_000 });
  await expect(page.locator('#beneficiary-list')).toContainText('Guest Family');

  await page.getByRole('button', { name: 'Import Excel', exact: true }).first().click();
  const workbook = readFileSync('tests/fixtures/beneficiary-two-rows.xlsx.base64', 'utf8').trim();
  await page.locator('#beneficiary-file').setInputFiles({
    name: 'guest-beneficiaries.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(workbook, 'base64'),
  });
  const importDialog = page.getByRole('dialog', { name: 'Beneficiary entry' });
  await importDialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(importDialog.getByText('Already saved in this list.')).toBeVisible();
  await importDialog.getByRole('button', { name: 'Next', exact: true }).click();
  await importDialog.getByRole('button', { name: 'Finish import' }).click();
  await expect(page.getByText('1 beneficiaries added to the list.')).toBeVisible({ timeout: 15_000 });
  await expect(records).toContainText('Local Beneficiary Two');

  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  try {
    const otherGuest = await otherContext.newPage();
    await otherGuest.goto('/?action=beneficiaries');
    await expect(otherGuest.getByRole('heading', { name: 'Create your first list' })).toBeVisible({ timeout: 15_000 });
    await expect(otherGuest.getByText('Synthetic Guest One')).toHaveCount(0);
    await expect(otherGuest.getByText('Local Beneficiary Two')).toHaveCount(0);
  } finally {
    await otherContext.close();
  }

  const firstRow = records.locator('li').filter({ hasText: '012345678901' });
  await firstRow.getByRole('button', { name: 'Pay Tax for Others' }).click();
  const paymentDialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(paymentDialog.locator('[data-payer-relationship="OTHER"]')).toHaveAttribute('aria-pressed', 'true');
  await paymentDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await paymentDialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await paymentDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(paymentDialog.locator('[data-payment-access="GUEST"]')).toHaveAttribute('aria-pressed', 'true');
  await paymentDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(paymentDialog.locator('#guest-tin')).toHaveValue('012345678901');
  await expect(paymentDialog.locator('#other-tax-primary-name')).toHaveValue('Synthetic Guest One');
  await expect(paymentDialog.getByText('Sign-in Payment')).toHaveCount(0);
  await paymentDialog.getByRole('button', { name: 'Close payment services' }).click();

  const secondRow = records.locator('li').filter({ hasText: '987654321098' });
  const firstSelect = firstRow.getByRole('checkbox');
  const secondSelect = secondRow.getByRole('checkbox');
  await firstSelect.check();
  await secondSelect.check();
  await page.getByRole('button', { name: 'Pay Tax for Others' }).first().click();
  const multiplePaymentDialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(multiplePaymentDialog.locator('[data-payer-relationship="OTHER"]')).toHaveAttribute('aria-pressed', 'true');
  await multiplePaymentDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(multiplePaymentDialog.locator('[data-payment-entry="OTHER_TAX"]')).toHaveAttribute('aria-pressed', 'true');
  await multiplePaymentDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await multiplePaymentDialog.getByRole('button', { name: 'Continue', exact: true }).click();
  const primaryTin = await multiplePaymentDialog.locator('#guest-tin').inputValue();
  const primaryName = await multiplePaymentDialog.locator('#other-tax-primary-name').inputValue();
  const additionalTaxpayer = multiplePaymentDialog.getByTestId('other-tax-taxpayer');
  const additionalTin = await additionalTaxpayer.locator('input[id^="other-tax-tin-"]').inputValue();
  expect([primaryTin, additionalTin].sort()).toEqual(['012345678901', '987654321098'].sort());
  expect(primaryName).toBe(primaryTin === '012345678901' ? 'Synthetic Guest One' : 'Local Beneficiary Two');
  await multiplePaymentDialog.getByRole('button', { name: 'Close payment services' }).click();

  const editRow = firstRow;
  await editRow.getByRole('button', { name: 'Edit' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit beneficiary' });
  await editDialog.locator('#beneficiary-edit-name').fill('Synthetic Guest Renamed');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(records).toContainText('Synthetic Guest Renamed');

  await secondRow.getByRole('button', { name: 'Remove beneficiary' }).click();
  const removeDialog = page.getByRole('dialog', { name: 'Confirm beneficiary removal' });
  await removeDialog.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(records).not.toContainText('Local Beneficiary Two');
});
