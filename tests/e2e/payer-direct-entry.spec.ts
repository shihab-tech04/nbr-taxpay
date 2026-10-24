import { expect, test } from '@playwright/test';

for (const payer of [
  { id: 'SELF', label: 'My own tax' },
  { id: 'OTHER', label: "Someone else's tax" }
] as const) {
  test(`Pay Tax enters account gateway directly after choosing ${payer.label}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
    const payment = page.getByRole('dialog', { name: 'Pay Tax' });

    await expect(payment.locator('[data-payer-relationship]')).toHaveCount(2);
    await expect(payment.locator('[data-payment-entry]')).toHaveCount(0);
    await payment.locator(`[data-payer-relationship="${payer.id}"]`).click();
    await payment.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(payment.getByRole('heading', { name: 'How would you like to continue?' })).toBeVisible();
    await expect(payment.locator('#tax-service-other-type')).toHaveCount(0);
    await expect(payment.getByText('Which tax would you like to pay?')).toHaveCount(0);

    await payment.getByRole('button', { name: 'Continue without signing in' }).click();
    await expect(payment.getByText('Step 1 of 4')).toBeVisible();
    await expect(payment.locator('.payment-form-payer-confirmation')).toContainText(payer.label);
  });
}

test('Back from access gate returns to payer selection without tax-type step', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await payment.getByRole('button', { name: 'Continue', exact: true }).click();
  await payment.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(payment.getByRole('heading', { name: 'Who are you paying for?' })).toBeVisible();
  await expect(payment.locator('[data-payer-relationship="OTHER"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(payment.locator('[data-payment-entry], #tax-service-other-type')).toHaveCount(0);
});
