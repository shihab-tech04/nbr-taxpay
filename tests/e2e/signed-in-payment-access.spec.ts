import { expect, test } from '@playwright/test';
import { openLegacyTaxServiceChoice, openUnifiedSignedInPayment } from './pay-tax-entry-helper';

for (const locale of ['en', 'bn'] as const) {
  test(`already signed-in ${locale.toUpperCase()} taxpayer skips redundant account/walk-in choice for both payers`, async ({ page }) => {
    await page.goto('/?action=taxpayer_login');
    const login = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
    await login.getByRole('textbox', { name: 'User ID' }).fill('user1');
    await login.getByLabel('Password', { exact: true }).fill('user1');
    await login.getByRole('button', { name: 'Sign In' }).click();
    await expect(login).toHaveCount(0);
    const payment=await openUnifiedSignedInPayment(page,locale);
    const own=payment.getByTestId('unified-account-own').getByRole('checkbox');
    const other=payment.getByTestId('unified-tin-input');
    const next=payment.getByRole('button',{name:locale==='bn'?'পেমেন্ট খাতে এগিয়ে যান':'Continue to Payment Head'});
    await expect(next).toBeDisabled();
    await expect(other).toBeEditable();
    await expect(payment.getByTestId('saved-beneficiary-picker')).toBeVisible();
    await own.check();
    await expect(payment.getByTestId('unified-taxpayer-count')).toHaveText('1');
    await next.click();
    await expect(payment.getByTestId('other-tax-batch')).toBeVisible();
    await expect(payment.locator('.taxpay-modal__step-count')).toContainText('2/3');
    await payment.locator('.taxpay-modal__back').click();
    await expect(own).toBeChecked();
    await own.uncheck();
    await expect(payment.getByTestId('unified-taxpayer-count')).toHaveText('0');
    await expect(next).toBeDisabled();
    await expect(payment.getByTestId('saved-beneficiary-picker')).toBeVisible();
    await other.fill('333333333333');
    await payment.getByRole('button',{name:locale==='bn'?'করদাতার টিআইএন অনুসন্ধান':'Search taxpayer TIN'}).click();
    await expect(payment.getByTestId('unified-taxpayer-search-result')).toBeVisible();
    await payment.getByRole('button',{name:locale==='bn'?'করদাতা যোগ করুন':'Add taxpayer',exact:true}).click();
    await expect(own).not.toBeChecked();
    await expect(payment.getByTestId('unified-taxpayer-count')).toHaveText('1');
    await next.click();
    await expect(payment.getByTestId('other-tax-batch')).toBeVisible();
    await expect(payment.locator('.taxpay-modal__step-count')).toContainText('2/3');
    await expect(payment.locator('[data-entry-section="access"],[data-payment-access]')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' })).toHaveCount(0);
  });
}

test('signed-out taxpayer still sees Sign-in and Walk-in payment options', async ({ page }) => {
  await page.goto('/');
  await openLegacyTaxServiceChoice(page);
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await payment.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await expect(payment.locator('[data-entry-section="access"]')).toBeVisible();
  await expect(payment.locator('[data-payment-access]')).toHaveCount(2);
  await payment.locator('[data-payment-access="GUEST"]').click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(payment.locator('.taxpay-modal__step-count')).toHaveText('1/4 Steps');
  await expect(payment.locator('.tax-service-choice__account-access')).toHaveCount(0);
});
