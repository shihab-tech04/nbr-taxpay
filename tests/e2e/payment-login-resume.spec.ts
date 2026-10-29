import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('account sign-in preserves tax and payer selections and resumes payment Step 1', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.locator('[data-payment-entry="OTHER_TAX"]').click();
  await payment.locator('[data-payment-access="ACCOUNT"]').click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();

  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('.taxpay-modal__overlay')).toHaveCount(1);
  await expect(page.locator('.taxpayer-login-backdrop')).toHaveCount(0);
  await expect(login.locator('.taxpayer-login-dialog--embedded')).toBeVisible();
  await expect(login.getByRole('textbox', { name: 'User ID' })).toBeFocused();
  await expect(login.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await expect(login.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await expect(login.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  await login.getByRole('button', { name: 'Sign In' }).click();

  await expect(login).toHaveCount(0);
  await expect(payment).toBeVisible();
  await expect(payment.locator('.taxpay-modal__title')).toHaveText('Pay Tax');
  await expect(payment.locator('[data-payment-entry]')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText('My tax liability');
  await expect(payment.locator('.tax-service-choice__selected-service strong').first()).toHaveText('Other Tax Payment');
  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText('My tax liability');
  await expect(payment.locator('#guest-tin')).toBeVisible();
  await expect(payment.getByRole('region', { name: 'Account taxpayer details' })).toContainText('2222222222222');
  await expect(payment.locator('input#guest-tin')).toHaveCount(0);
  await expect(payment.locator('#guest-notice-ref')).toBeEditable();
  await expect(payment.getByText('Continuing with your account')).toBeVisible();
  await expect(page).not.toHaveURL(/action=taxpayer_home/);
});

test('guest payment bypasses login and continues to the standard four steps', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'OTHER_TAX_PAYMENT', 'OTHER');
  await expect(payment).toBeVisible();
  await expect(payment.getByText('Step 1 of 4')).toBeVisible();
  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText('Facilitate another taxpayer’s payment');
  await expect(payment.getByRole('radio', { name: 'Facilitate another taxpayer’s payment' })).toHaveCount(0);
  await expect(payment.locator('#guest-tin')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('payment account login preserves payer and access on Back, errors and close', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await payment.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await payment.locator('[data-payment-access="ACCOUNT"]').click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
  const login = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(login.locator('.taxpayer-login-dialog--embedded')).toBeVisible();
  await login.getByRole('textbox', { name: 'User ID' }).fill('invalid-user');
  await login.getByLabel('Password', { exact: true }).fill('incorrect');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login.getByRole('alert')).toContainText('Incorrect User ID or password');

  await login.getByRole('button', { name: 'Back' }).click();
  await expect(payment.locator('[data-payer-relationship="OTHER"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(payment.locator('[data-payment-access="ACCOUNT"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
  const retry = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
  await expect(retry.getByRole('textbox', { name: 'User ID' })).toHaveValue('');
  await expect(retry.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.taxpay-modal__overlay')).toHaveCount(0);
});

test('Tax and access decisions appear beneath payer and are both required', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  const next = payment.getByRole('button', { name: 'Continue', exact: true });
  await expect(next).toBeDisabled();
  await payment.locator('[data-payer-relationship="SELF"]').click();
  const lastTax = payment.locator('[data-payment-entry]').last();
  await expect(lastTax).toBeVisible();
  await expect(payment.locator('[data-payment-access]')).toHaveCount(0);
  await payment.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  const firstAccess = payment.locator('[data-payment-access]').first();
  const taxBounds = await lastTax.boundingBox();
  const accessBounds = await firstAccess.boundingBox();
  expect(accessBounds!.y).toBeGreaterThan(taxBounds!.y + taxBounds!.height);
  const secondAccess = await payment.locator('[data-payment-access]').last().boundingBox();
  expect(Math.abs(accessBounds!.y - secondAccess!.y)).toBeLessThan(2);
  await expect(next).toBeDisabled();
  await firstAccess.click();
  await expect(next).toBeEnabled();
});
