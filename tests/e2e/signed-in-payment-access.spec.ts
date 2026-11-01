import { expect, test } from '@playwright/test';

for (const locale of ['en', 'bn'] as const) {
  test(`already signed-in ${locale.toUpperCase()} taxpayer skips redundant account/walk-in choice for both payers`, async ({ page }) => {
    await page.goto('/?action=taxpayer_login');
    const login = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
    await login.getByRole('textbox', { name: 'User ID' }).fill('user1');
    await login.getByLabel('Password', { exact: true }).fill('user1');
    await login.getByRole('button', { name: 'Sign In' }).click();
    await expect(login).toHaveCount(0);
    await page.goto(locale === 'bn' ? '/?action=landing&lang=bn' : '/?action=landing');
    await page.getByRole('button', { name: locale === 'bn' ? 'কর পরিশোধ' : 'Pay Tax', exact: true }).first().click();
    const payment = page.getByRole('dialog', { name: locale === 'bn' ? 'কর পরিশোধ' : 'Pay Tax' });

    for (const payer of ['OTHER', 'SELF'] as const) {
      await payment.locator(`[data-payer-relationship="${payer}"]`).click();
      await payment.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
      await expect(payment.locator('[data-entry-section="access"]')).toHaveCount(0);
      await expect(payment.locator('[data-payment-access]')).toHaveCount(0);
      await expect(payment.getByRole('heading', { name: locale === 'bn' ? 'কীভাবে এগিয়ে যেতে চান?' : 'How would you like to continue?' })).toHaveCount(0);
      const continueButton = payment.locator('.tax-service-choice__actions').getByRole('button', { name: locale === 'bn' ? 'এগিয়ে যান' : 'Continue', exact: true });
      await expect(continueButton).toBeEnabled();
      await continueButton.click();
      await expect(payment.locator('.taxpay-modal__step-count')).toContainText('1/4');
      await expect(payment.locator('.tax-service-choice__account-access')).toHaveCount(0);
      await expect(page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' })).toHaveCount(0);
      if (payer === 'OTHER') {
        await expect(payment.getByTestId('saved-beneficiary-picker')).toHaveCount(1);
      }
      await payment.locator('.taxpay-modal__back').click();
    }
  });
}

test('signed-out taxpayer still sees Sign-in and Walk-in payment options', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
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
