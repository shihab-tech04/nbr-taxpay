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
  await expect(payment.getByRole('heading', { name: 'How would you like to continue?' })).toBeVisible();
  await expect(payment.locator('[data-payment-access="ACCOUNT"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(payment.locator('[data-payment-access="GUEST"]')).toBeVisible();
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
  await expect(payment.locator('input#guest-tin')).toHaveValue('2222222222222');
  await expect(payment.locator('input#guest-tin')).toHaveAttribute('readonly', '');
  await expect(payment.locator('#guest-phone')).toHaveValue('01700000002');
  await expect(payment.locator('#guest-phone')).toHaveAttribute('readonly', '');
  await expect(payment.locator('.tin-lookup__result')).toContainText('TIN information will be displayed here.');
  await payment.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(payment.locator('.tin-lookup__result')).toContainText('Meghna Trading Ltd.');
  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');

  await payment.getByRole('button', { name: 'Back', exact: true }).click();
  await payment.locator('.payment-flow-embedded__footer-actions').getByRole('button', { name: 'Back', exact: true }).click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText("Facilitate another taxpayer’s payment");
  const manualTin = payment.getByRole('textbox', { name: 'Taxpayer’s TIN *' });
  await expect(manualTin).toHaveValue('');
  await expect(manualTin).not.toHaveAttribute('readonly', '');
  await manualTin.fill('123456789012');
  await payment.locator('.payment-flow-embedded__footer-actions').getByRole('button', { name: 'Back', exact: true }).click();
  await payment.locator('[data-payer-relationship="SELF"]').click();
  await expect(payment.locator('[data-payment-entry="TAX_WITH_RETURN"]')).toHaveAttribute('aria-pressed', 'true');
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('input#guest-tin')).toHaveValue('2222222222222');
  await expect(payment.locator('input#guest-tin')).toHaveAttribute('readonly', '');
});
