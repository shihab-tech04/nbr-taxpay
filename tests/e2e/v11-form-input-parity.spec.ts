import { expect, test } from '@playwright/test';

test('payer relationship is required at entry and head choice is still validated in Step 2', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await dialog.locator('[data-payer-relationship="OTHER"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
  await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(dialog.locator('.payment-form-payer-confirmation')).toContainText("Someone else's tax");
  await expect(dialog.getByLabel('Your name (payer)')).toBeVisible();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-payer-name').fill('Sample Agent');
  await dialog.locator('#other-tax-primary-name').fill('Sample Taxpayer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await expect(batch).toBeVisible();
  await expect(batch).toContainText('43 liability heads');
  await expect(batch.locator('[data-head-group]')).toHaveCount(6);
  await expect(dialog.getByText('Income tax type', { exact: true })).toHaveCount(0);
  await expect(batch.getByTestId('other-tax-line')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(batch.getByRole('alert')).toContainText('Choose at least one eligible head');
});

test('sample v11 notices validate the TIN pair and prefill locked AY and amount', async ({ page }) => {
  // A legacy v11 category is still testable through its explicit guest deep link.
  await page.goto('/?action=guest&initialCategory=PENALTY');
  const dialog = page;
  await dialog.getByRole('radio', { name: 'My own tax' }).check();
  await expect(dialog.getByRole('radio', { name: 'My own tax' })).toBeChecked();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.locator('#guest-notice-ref').fill('DN-2026-001187');
  await dialog.getByRole('button', { name: 'Continue to Payment Head' }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not confirm');
  await dialog.locator('#guest-notice-ref').fill('pn-2026-000392');
  await dialog.getByRole('button', { name: 'Continue to Payment Head' }).click();

  const year = dialog.locator('#guest-assessment-year');
  await expect(year).toHaveValue('2025-26');
  await expect(year).toBeDisabled();
  await expect(dialog.locator('.payment-head-options input:checked')).toHaveCount(0);
  await dialog.locator('.payment-head-options input').first().check();
  await expect(dialog.locator('#guest-tax-amount')).toHaveValue('10000');
  await expect(dialog.locator('#guest-tax-amount')).toHaveAttribute('readonly', '');
});

test('standalone travel form requires explicit payment method and acknowledgement', async ({ page }) => {
  await page.goto('/?action=travel');
  const travel = page.locator('.travel-flow');
  await travel.locator('#travel-tax-route-1').check();
  await travel.getByRole('button', { name: 'Continue to passenger details' }).click();
  await travel.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await travel.getByLabel('Passport number').fill('EXAMPLE123');
  await travel.getByLabel('Mobile number for receipt').fill('01712345678');
  await travel.getByLabel('Travel date').fill('2026-10-25');
  await travel.getByRole('button', { name: 'Continue to review' }).click();

  const submit = travel.getByRole('button', { name: 'Continue payment' });
  await expect(submit).toBeDisabled();
  const online = travel.getByRole('button', { name: 'Pay online' });
  await expect(online).toHaveAttribute('aria-pressed', 'false');
  await online.click();
  await expect(submit).toBeDisabled();
  await travel.getByRole('button', { name: 'Mobile banking' }).click();
  await travel.getByRole('radio', { name: 'bKash' }).check();
  await expect(submit).toBeDisabled();
  await travel.getByRole('checkbox', { name: 'The journey, passenger details and amount are correct.' }).check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(travel.locator('.travel-flow__receipt')).toContainText('Payment reference', { timeout: 10000 });
});
