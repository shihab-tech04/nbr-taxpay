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
  await expect(payment.getByRole('heading', { name: 'How would you like to continue?' })).toHaveCount(0);

  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText('My tax liability');
  await expect(payment.getByRole('radio', { name: 'My tax liability' })).toHaveCount(0);
  // The new shared modal keeps the same account-bound data read-only in its TIN search row.
  await expect(payment.locator('#guest-tin')).toHaveValue('2222222222222');
  await expect(payment.locator('#guest-tin')).toHaveAttribute('readonly', '');
  await payment.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(payment.locator('.tin-lookup__result')).toContainText('Meghna Trading Ltd.');
  await expect(payment.locator('#guest-phone')).toHaveValue('01700000002');
  await expect(payment.getByTestId('other-tax-primary-taxpayer')).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await expect(payment.locator('#guest-phone')).toHaveAttribute('readonly', '');
  await expect(payment.locator('#guest-tax-zone')).toHaveCount(0);
  await expect(payment.locator('#guest-tax-circle')).toHaveCount(0);
  await expect(payment.locator('#guest-notice-ref')).toBeEditable();

  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');
});

test('changing from my tax to another taxpayer restores editable 12-digit entry', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await page.getByLabel('Password', { exact: true }).fill('user1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'TAX_WITH_RETURN', 'SELF');
  await expect(payment.locator('#guest-tin')).toHaveValue('1111111111111');
  // Back returns to the unified chooser; its tax selection is preserved.
  await payment.locator('.payment-flow-embedded__footer-actions').getByRole('button', { name: 'Back', exact: true }).click();
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Back', exact: true }).click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText("Facilitate another taxpayer’s payment");
  await expect(payment.locator('#guest-taxpayer-name')).toHaveCount(0);
  await expect(payment.locator('#guest-tin')).not.toHaveAttribute('readonly');
  await expect(payment.locator('#guest-phone')).toHaveValue('01700000001');
  await expect(payment.locator('#guest-phone')).toHaveAttribute('readonly');
  await payment.locator('#guest-tin').fill('123456789012');
  await expect(payment.locator('#guest-tin')).toHaveValue('123456789012');
  await payment.locator('.payment-flow-embedded__footer-actions').getByRole('button', { name: 'Back', exact: true }).click();
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Back', exact: true }).click();
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('#guest-tin')).toHaveValue('1111111111111');
  await expect(payment.locator('#guest-tin')).toHaveCount(1);
});

test('standalone payment form also recognizes an existing account session', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'User ID' }).fill('user3');
  await page.getByLabel('Password', { exact: true }).fill('user3');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=guest');
  await page.getByRole('radio', { name: 'My tax liability' }).check();
  await expect(page.locator('input#guest-tin')).toHaveValue('3333333333333');
  await expect(page.locator('input#guest-tin')).toHaveAttribute('readonly', '');
});
