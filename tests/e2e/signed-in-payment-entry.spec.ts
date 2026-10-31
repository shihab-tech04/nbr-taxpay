import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('an already signed-in taxpayer starts payment without a second login prompt', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);

  // Sign-in lands in the taxpayer dashboard; the payment service chooser is on Home.
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.locator('[data-payment-entry="OTHER_TAX"]').click();
  await expect(payment.getByRole('heading', { name: 'How would you like to continue?' })).toHaveCount(0);
  await expect(payment.locator('[data-entry-section="access"]')).toHaveCount(0);
  await expect(payment.locator('[data-payment-access]')).toHaveCount(0);
  // A real signed-in session goes directly into the existing account payment flow.
  await expect(payment.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(payment.locator('.taxpay-modal__step-count')).toHaveText('1/4 Steps');
  await expect(payment.getByText('Continuing with your account')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' })).toHaveCount(0);
});

test('signed-in own-tax payment uses the account TIN read-only and never carries it into someone else’s tax', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'TAX_WITH_RETURN', 'SELF');

  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText('My tax liability');
  await expect(payment.getByRole('radio', { name: 'My tax liability' })).toHaveCount(0);
  const card = payment.locator('#signed-in-account-taxpayer-card');
  await expect(card).toContainText('Meghna Trading Ltd.');
  await expect(card).toContainText('2222222222222');
  await expect(card).toContainText('01700000002');
  await expect(payment.locator('#guest-tin, #guest-phone, #guest-taxpayer-name')).toHaveCount(0);
  await expect(payment.locator('.payment-identity__fields input')).toHaveCount(1);
  await expect(payment.locator('#guest-notice-ref')).toBeEditable();
  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');

  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText("Facilitate another taxpayer’s payment");
  // Keep saved-beneficiary selection available after verified account sign-in.
  await expect(payment.getByTestId('saved-beneficiary-picker')).toHaveCount(1);
  await expect(payment.getByTestId('saved-beneficiary-picker').getByRole('button',{name:'Manage beneficiaries'})).toBeVisible();
  await expect(payment.locator('#guest-tin, #guest-payer-name, #guest-taxpayer-name')).toHaveCount(0);
  await expect(payment.getByRole('button',{name:'Add another taxpayer'})).toHaveCount(0);
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('#signed-in-account-taxpayer-card')).toContainText('2222222222222');
  await expect(payment.locator('#guest-tin')).toHaveCount(0);
});
