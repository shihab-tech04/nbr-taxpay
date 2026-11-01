import { expect, test, type Page } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

async function startOwnPayment(page: Page, user: 'user1' | 'user2', service: 'TAX_WITH_RETURN' | 'OTHER_TAX_PAYMENT') {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill(user);
  await login.getByLabel('Password', { exact: true }).fill(user);
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, service, 'SELF');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');
  await expect(dialog.getByTestId('payment-suggestions')).toHaveCount(0);
  await expect(dialog.getByText('Payment suggestions from scenario history')).toHaveCount(0);
  return dialog;
}

test('User1 return amount starts filled, explains its origin and remains editable', async ({ page }) => {
  const dialog = await startOwnPayment(page, 'user1', 'TAX_WITH_RETURN');
  const input = dialog.locator('#guest-tax-amount');
  await expect(input).toHaveValue('12750');
  await expect(input).toBeEditable();
  const info = dialog.getByRole('button', { name: 'Why was this amount filled automatically?' });
  await info.click();
  await expect(dialog.getByRole('note')).toContainText('not an NBR-verified liability');
  await expect(dialog.getByRole('note')).toContainText('U1-AMT-01');
  await info.click();
  await input.fill('4200');
  await expect(input).toHaveValue('4200');
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('4,200');
  await dialog.locator('#guest-assessment-year').selectOption('2025-26');
  await expect(input).toHaveValue('');
  await dialog.locator('#guest-assessment-year').selectOption('2026-27');
  await expect(input).toHaveValue('12750');
});

test('User1 Other Tax fills only the chosen head/year, not every selected head', async ({ page }) => {
  const dialog = await startOwnPayment(page, 'user1', 'OTHER_TAX_PAYMENT');
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /^Select 64 —/ }).check();
  const first = batch.getByTestId('other-tax-line').first();
  const amount = first.locator('input[id^="other-tax-amount"]');
  const year = first.locator('select[id^="other-tax-year"]');
  await expect(amount).toHaveValue('4500');
  await expect(first.getByTestId('payment-amount-suggestion-info')).toBeVisible();
  await first.getByRole('button', { name: 'Why was this amount filled automatically?' }).click();
  await expect(first.getByRole('note')).toContainText('U1-AMT-02');
  await year.selectOption('2024-25');
  await expect(amount).toHaveValue('3200');
  await year.selectOption('2025-26');
  await expect(amount).toHaveValue('');
  await year.selectOption('2026-27');
  await expect(amount).toHaveValue('4500');
  await amount.fill('1234.50');
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('1,234');
  await batch.getByRole('checkbox', { name: /^Select 68A/ }).check();
  await expect(batch.getByTestId('other-tax-line').nth(1).locator('input[id^="other-tax-amount"]')).toHaveValue('');
  await expect(batch.getByTestId('payment-amount-suggestion-info')).toHaveCount(0);
});

test('Other signed-in users never inherit User1 suggested amounts', async ({ page }) => {
  const dialog = await startOwnPayment(page, 'user2', 'TAX_WITH_RETURN');
  await expect(dialog.locator('#guest-tax-amount')).toHaveValue('');
  await expect(dialog.getByTestId('payment-amount-suggestion-info')).toHaveCount(0);
});

test('Signed-out guest never receives sample amount suggestions', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.getByRole('button', { name: /^Search(?: TIN)?$/ }).click();
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /^Select 64 —/ }).check();
  await expect(batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]')).toHaveValue('');
  await expect(batch.getByTestId('payment-amount-suggestion-info')).toHaveCount(0);
  await expect(dialog.getByTestId('payment-suggestions')).toHaveCount(0);
});
