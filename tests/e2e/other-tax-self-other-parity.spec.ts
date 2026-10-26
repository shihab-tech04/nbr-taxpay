import { expect, test, type Page } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

// The choice of payer changes identity handling, never the catalogue or amount UX.
async function openOtherTax(page: Page, payer: 'SELF' | 'OTHER') {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', payer);
  return dialog;
}

test('logged-out own and other tax share the exact Other Tax head catalogue', async ({ page }) => {
  for (const payer of ['SELF', 'OTHER'] as const) {
    const dialog = await openOtherTax(page, payer);
    await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
    await dialog.locator('#guest-tin').fill('111111111111');
    await dialog.locator('#guest-payer-name').fill('Guest Payer');
    await dialog.locator('#guest-phone').fill('01712345678');
    if (payer === 'SELF') {
      await expect(dialog.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
      await expect(dialog.locator('#other-tax-primary-name')).toHaveCount(0);
    } else {
      await expect(dialog.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
      await expect(dialog.locator('#other-tax-primary-name')).toBeVisible();
    }
    await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
    const batch = dialog.getByTestId('other-tax-batch');
    await expect(batch).toBeVisible();
    await expect(batch.locator('[data-head-group]')).toHaveCount(5);
    await expect(batch).toContainText('42 available Other Tax heads');
    await expect(batch.locator('[data-head-group="Tax with Return"]')).toHaveCount(0);
    await expect(dialog.getByText('Income tax type', { exact: true })).toHaveCount(0);
    await batch.locator('[data-head-group="Advance Tax"] summary').click();
    await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
    await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('1250.50');
    await expect(batch.getByTestId('other-tax-combined-total')).toHaveText('BDT 1,250.50');
    await expect(dialog.locator('.payment-form-summary__breakdown')).toContainText('68A');
    await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
    await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
    // Existing safety boundary: batch payments never fabricate government challans.
    await expect(dialog.getByText(/Batch settlement is reserved for the future A-Challan integration/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Close payment services' }).click();
  }
});

test('signed-in own Other Tax uses account-bound identity and the shared catalogue', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);
  const dialog = await openOtherTax(page, 'SELF');
  await expect(dialog.getByText('Continuing with your account')).toBeVisible();
  await expect(dialog.locator('#guest-tin')).toHaveValue('2222222222222');
  await expect(dialog.locator('#guest-tin')).toHaveAttribute('readonly');
  await expect(dialog.locator('#guest-phone')).toHaveValue('01700000002');
  await expect(dialog.locator('#guest-phone')).toHaveAttribute('readonly');
  await expect(dialog.locator('#guest-payer-name')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByTestId('other-tax-batch').locator('[data-head-group]')).toHaveCount(5);
  await expect(dialog.getByText('Income tax type', { exact: true })).toHaveCount(0);
});

test('signed-in someone-else Other Tax never substitutes the account holder TIN', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await page.getByLabel('Password', { exact: true }).fill('user1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  const dialog = await openOtherTax(page, 'OTHER');
  await expect(dialog.getByText('Continuing with your account')).toBeVisible();
  await expect(dialog.locator('#guest-tin')).toHaveValue('');
  await expect(dialog.locator('#guest-tin')).not.toHaveAttribute('readonly');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-payer-name').fill('Authorized Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByTestId('other-tax-batch')).toContainText('123456789012');
  await expect(dialog.getByTestId('other-tax-batch').locator('[data-head-group]')).toHaveCount(5);
});

test('unrelated guest own Tax with Return keeps its existing identity and step-two contract', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN', 'SELF');
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(dialog.locator('#guest-payer-name')).toHaveCount(0);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText('Step 2 of 4')).toBeVisible();
  await expect(dialog.getByText('Income tax type', { exact: true })).toBeVisible();
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
});
