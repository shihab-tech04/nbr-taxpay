import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('guest manages isolated SQL-backed lists and prefills Pay Tax for Others without account auth', async ({ browser, page }) => {
  const localUrl = process.env.VITE_SUPABASE_URL;
  if (!localUrl) throw new Error('Refusing guest beneficiary acceptance without a disposable local Supabase URL.');
  const api = new URL(localUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(api.hostname))
    throw new Error('Refusing guest beneficiary acceptance outside loopback Supabase.');

  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?action=beneficiaries');
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add single' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in with email' })).toHaveCount(0);
  await expect(page.getByText('No beneficiaries in this list')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Add single' }).click();
  const addDialog = page.getByRole('dialog', { name: 'Beneficiary entry' });
  await addDialog.locator('#beneficiary-new-list-name').fill('Guest Family');
  await addDialog.locator('#beneficiary-tin').fill('012345678901');
  await addDialog.locator('#beneficiary-name').fill('Synthetic Guest One');
  await addDialog.getByRole('button', { name: 'Add beneficiary', exact: true }).click();
  await expect(page.getByText('Synthetic Guest One')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Beneficiary saved.')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Synthetic Guest One')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#beneficiary-list')).toContainText('Guest Family');

  await page.getByRole('button', { name: 'Bulk add' }).click();
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
  await importDialog.getByRole('button', { name: 'Finish Import' }).click();
  await expect(page.getByText('1 beneficiaries added to the list.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Local Beneficiary Two')).toBeVisible();

  const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' });
  try {
    const otherGuest = await otherContext.newPage();
    await otherGuest.goto('/?action=beneficiaries');
    await expect(otherGuest.getByText('No beneficiaries in this list')).toBeVisible({ timeout: 15_000 });
    await expect(otherGuest.getByText('Synthetic Guest One')).toHaveCount(0);
    await expect(otherGuest.getByText('Local Beneficiary Two')).toHaveCount(0);
  } finally {
    await otherContext.close();
  }

  const firstRow = page.getByRole('row').filter({ hasText: '012345678901' });
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

  const editRow = page.getByRole('row').filter({ hasText: '012345678901' });
  await editRow.getByRole('button', { name: 'Edit' }).click();
  await editRow.getByRole('textbox', { name: 'Edit name' }).fill('Synthetic Guest Renamed');
  await editRow.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Synthetic Guest Renamed')).toBeVisible();

  const removeRow = page.getByRole('row').filter({ hasText: '987654321098' });
  await removeRow.getByRole('button', { name: 'Remove Local Beneficiary Two' }).click();
  await removeRow.getByRole('button', { name: 'Confirm remove' }).click();
  await expect(page.getByText('Local Beneficiary Two')).toHaveCount(0);
});
