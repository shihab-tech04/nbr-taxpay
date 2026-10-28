import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('account sign-in at the breakpoint retains the selected service and starts Step 1', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.locator('[data-payment-access="ACCOUNT"]').click();
  await enterTaxPayService(payment, 'OTHER_TAX_PAYMENT', 'SELF');
  const selectedService = payment.locator('.tax-service-choice__selected-service strong');

  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('.taxpay-modal__overlay')).toHaveCount(1);
  await expect(page.locator('.taxpayer-login-backdrop')).toHaveCount(0);
  await expect(login.locator('.taxpayer-login-dialog--embedded')).toBeVisible();
  await expect(login.locator('.taxpayer-login-heading')).toHaveCount(0);
  await expect(login.getByRole('textbox', { name: 'User ID' })).toBeFocused();
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();

  await expect(login).toHaveCount(0);
  await expect(payment).toBeVisible();
  await expect(selectedService).toHaveText('Other Tax Payment');
  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText('My tax liability');
  await expect(payment.getByRole('radio', { name: 'My tax liability' })).toHaveCount(0);
  await expect(payment.locator('#guest-tin')).toBeVisible();
  await expect(payment.getByRole('region', { name: 'Account taxpayer details' })).toContainText('2222222222222');
  await expect(payment.locator('input#guest-tin')).toHaveCount(0);
  await expect(payment.locator('#guest-notice-ref')).toBeEditable();
  await expect(payment.getByText('Continuing with your account')).toBeVisible();
  await expect(page).not.toHaveURL(/action=taxpayer_home/);
});

test('guest payment continues directly from the breakpoint without opening account records', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'OTHER_TAX_PAYMENT', 'OTHER');
  await expect(payment).toBeVisible();
  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText("Facilitate another taxpayer’s payment");
  await expect(payment.getByRole('radio', { name: "Facilitate another taxpayer’s payment" })).toHaveCount(0);
  await expect(payment.locator('#guest-tin')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('payment account login stays in the same dialog when returning Back, rejecting bad credentials and closing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.locator('[data-payment-access="ACCOUNT"]').click();
  await enterTaxPayService(payment, 'TAX_WITH_RETURN', 'OTHER');

  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(login.locator('.taxpayer-login-dialog--embedded')).toBeVisible();
  await expect(page.locator('.taxpayer-login-backdrop')).toHaveCount(0);
  await login.getByRole('textbox', { name: 'User ID' }).fill('invalid-user');
  await login.getByLabel('Password', { exact: true }).fill('incorrect');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login.getByRole('alert')).toContainText('Incorrect User ID or password');
  await expect(page.getByRole('dialog')).toHaveCount(1);

  await login.getByRole('button', { name: 'Back' }).click();
  await expect(payment).toBeVisible();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  // The tax-type card (checked above) owns this choice; the summary names the payer.
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
  const retry = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await expect(retry.getByRole('textbox', { name: 'User ID' })).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.taxpay-modal__overlay')).toHaveCount(0);
});
