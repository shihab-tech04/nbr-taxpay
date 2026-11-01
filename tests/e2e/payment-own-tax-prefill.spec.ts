import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('already signed-in user2 pays own tax with prefilled locked account identity', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user2');
  await login.getByLabel('Password', { exact: true }).fill('user2');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await expect(login).toHaveCount(0);

  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'ADVANCE_TAX', 'SELF');
  await expect(payment.locator('.taxpay-modal__step-count')).toHaveText('1/4 Steps');
  // Signed-in uses the same borderless payment section and 60:40 desktop geometry.
  await expect(payment.locator('.payment-form-section--static').first()).toHaveCSS('border-top-width', '0px');
  await expect(payment.locator('.payment-form-section--static').first().locator('.payment-form-section__body')).toHaveCSS('padding-left', '0px');
  await expect(payment.getByRole('heading', { name: 'How would you like to continue?' })).toHaveCount(0);

  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText('My tax liability');
  await expect(payment.getByRole('radio', { name: 'My tax liability' })).toHaveCount(0);
  // Account-bound display data is not a second taxpayer lookup form.
  const account = payment.locator('#signed-in-account-taxpayer-card');
  await expect(account).toBeVisible();
  await expect(account.getByRole('heading', { name: 'Taxpayer details' })).toBeVisible();
  await expect(account.getByText('Account information')).toHaveCount(0);
  await expect(payment.getByText('Account details', { exact: true })).toHaveCount(0);
  await expect(payment.getByText('Continuing with your account')).toHaveCount(0);
  await expect(account).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(account).toHaveCSS('border-top-style', 'solid');
  await expect(account).toContainText('Meghna Trading Ltd.');
  await expect(account).toContainText('2222222222222');
  await expect(account).toContainText('01700000002');
  await expect(account).toContainText('Taxes Zone 2');
  await expect(payment.locator('#guest-tin, #guest-taxpayer-name, #guest-phone')).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Search', exact: true })).toHaveCount(0);
  await expect(payment.getByTestId('other-tax-primary-taxpayer')).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await expect(payment.locator('.payment-identity__fields input')).toHaveCount(1);
  await expect(payment.locator('#guest-notice-ref')).toBeEditable();
  await payment.locator('#guest-notice-ref').fill('PN-2026-000392');

  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');
});

test('changing from own tax to another taxpayer shows saved beneficiary lists without manual TIN entry', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await page.getByLabel('Password', { exact: true }).fill('user1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'TAX_WITH_RETURN', 'SELF');
  await expect(payment.locator('#signed-in-account-taxpayer-card')).toContainText('1111111111111');
  // Back returns to the unified chooser; its tax selection is preserved.
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText("Facilitate another taxpayer’s payment");
  await expect(payment.getByTestId('saved-beneficiary-picker')).toBeVisible();
  await expect(payment.getByTestId('saved-beneficiary-picker').getByRole('button', {name:'Manage beneficiaries'})).toBeVisible();
  await expect(payment.locator('#guest-tin, #guest-taxpayer-name, #guest-payer-name')).toHaveCount(0);
  await expect(payment.getByRole('button',{name:'Add another taxpayer'})).toHaveCount(0);
  await expect(payment.locator('#guest-notice-ref')).toBeEditable();
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('#signed-in-account-taxpayer-card')).toContainText('1111111111111');
  await expect(payment.locator('#guest-tin')).toHaveCount(0);
});

test('standalone payment form also recognizes an existing account session', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'User ID' }).fill('user3');
  await page.getByLabel('Password', { exact: true }).fill('user3');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=guest');
  await page.getByRole('radio', { name: 'My tax liability' }).check();
  await expect(page.locator('#signed-in-account-taxpayer-card')).toContainText('3333333333333');
  await expect(page.locator('#guest-tin, #guest-phone')).toHaveCount(0);
  await expect(page.locator('#guest-notice-ref')).toBeEditable();
});
