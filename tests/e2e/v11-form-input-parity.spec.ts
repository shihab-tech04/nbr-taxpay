import { expect, test } from '@playwright/test';

test('guest fields start unselected and require a payer relationship and a head', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.getByRole('button', { name: /Advance Tax/ }).click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();

  const self = dialog.getByRole('radio', { name: 'My own tax' });
  const other = dialog.getByRole('radio', { name: "Someone else's tax" });
  await expect(self).not.toBeChecked();
  await expect(other).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Choose who you are paying for');
  await expect(self).toBeFocused();

  await other.check();
  await expect(dialog.getByLabel('Your name (payer)')).toBeVisible();
  await self.check();
  await expect(dialog.getByLabel('Your name (payer)')).toHaveCount(0);
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.locator('.payment-head-options input:checked')).toHaveCount(0);
  await dialog.getByRole('radio', { name: /Person other than company/ }).check();
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Select an available payment head');
});

test('sample v11 notices validate the TIN pair and prefill locked AY and amount', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.getByRole('button', { name: /Penalty/ }).click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  await dialog.getByRole('radio', { name: 'My own tax' }).check();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.locator('#guest-notice-ref').fill('DN-2026-001187');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not confirm');
  await dialog.locator('#guest-notice-ref').fill('pn-2026-000392');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();

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
  await expect(travel.getByRole('radio', { name: 'Pay online' })).not.toBeChecked();
  await travel.getByRole('radio', { name: 'Pay online' }).check();
  await expect(submit).toBeDisabled();
  await travel.getByRole('radio', { name: 'bKash' }).check();
  await expect(submit).toBeDisabled();
  await travel.getByRole('checkbox', { name: 'The journey, passenger details and amount are correct.' }).check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(travel.locator('.travel-flow__receipt')).toContainText('Payment reference', { timeout: 10000 });
});
