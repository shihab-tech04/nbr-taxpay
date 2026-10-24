import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

const getFlow = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  return dialog;
};

test('Other Tax supports multiple unique taxpayer identities and deleting taxpayers', async ({ page }) => {
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.locator('#other-tax-primary-name').fill('Taxpayer Alpha');
  await dialog.getByRole('button', { name: '+ Add another taxpayer' }).click();
  const second = dialog.getByTestId('other-tax-taxpayer');
  await expect(second).toHaveCount(1);
  await second.locator('input[id^="other-tax-tin"]').fill('222222222222');
  await second.locator('input[id^="other-tax-name"]').fill('Taxpayer Beta');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();

  const batch = dialog.getByTestId('other-tax-batch');
  await expect(batch).toBeVisible();
  await expect(batch).toContainText('43 liability heads');
  await expect(batch.locator('[data-head-group]')).toHaveCount(6);
  await expect(batch.locator('button[aria-label^="Add "]')).toHaveCount(43);
  await expect(dialog.getByText('Income tax type')).toHaveCount(0);

  await batch.locator('[data-head-group="Others"] summary').click();
  await expect(batch.getByRole('button', { name: 'Add 19AAAAA' })).toBeDisabled();
  await batch.getByRole('button', { name: 'Add 16A' }).click();
  await batch.locator('#other-tax-target').selectOption({ label: 'Taxpayer Beta · 222222222222' });
  await batch.getByRole('button', { name: 'Add 16A' }).click();

  const lines = batch.getByTestId('other-tax-line');
  await expect(lines).toHaveCount(2);
  await lines.first().locator('input[id^="other-tax-amount"]').fill('1000');
  await lines.last().locator('select[id^="other-tax-year"]').selectOption('2025-26');
  await lines.last().locator('input[id^="other-tax-amount"]').fill('2000');
  await expect(batch.locator('strong.font-mono-plex.text-taxpay-primary')).toHaveText('BDT 3,000');
  await expect(dialog.locator('.payment-form-summary__total')).toHaveText('BDT 3,000');

  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.getByTestId('other-tax-taxpayer')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Remove taxpayer' }).click();
  await expect(dialog.getByTestId('other-tax-taxpayer')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByTestId('other-tax-line')).toHaveCount(1);
  await expect(dialog.locator('.payment-form-summary__total')).toHaveText('BDT 1,000');
});

test('other-tax multi-person batch can be reviewed but cannot issue one combined challan', async ({ page }) => {
  const dialog = await getFlow(page);
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.locator('#other-tax-primary-name').fill('Taxpayer Alpha');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Others"] summary').click();
  await batch.getByRole('button', { name: 'Add 16A' }).click();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('2500');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  await expect(dialog.getByText(/Batch settlement is reserved for the future A-Challan integration/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm the TIN/ }).check();
  await expect(dialog.getByRole('button', { name: /Pay BDT 2,500/ })).toBeDisabled();
  await expect(dialog.getByRole('heading', { name: 'Payment process complete' })).toHaveCount(0);
});
