import { expect, test, type Page } from '@playwright/test';

async function openReview(page: Page, category = 'Tax with Return') {
  await page.goto('/');
  const initialUrl = page.url();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.getByRole('button', { name: new RegExp(category) }).click();
  await dialog.getByRole('button', { name: /Continue/ }).click();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.locator('#guest-tax-amount').fill('12500');
  await dialog.getByRole('button', { name: 'Continue to Review & Pay' }).click();
  await expect(dialog.getByTestId('payment-review')).toBeVisible();
  await expect(page).toHaveURL(initialUrl);
  return dialog;
}

test('online preview requires a selected method and acknowledgement, then stays unsent', async ({ page }) => {
  const dialog = await openReview(page, 'Advance Tax');
  const action = dialog.getByRole('button', { name: 'Prepare payment preview' });
  await expect(action).toBeDisabled();
  await expect(dialog.getByText('Taxpayer TIN')).toBeVisible();
  await expect(dialog.getByText('Receipt mobile')).toBeVisible();
  await expect(dialog.getByText('Taxpayer account')).toBeVisible();
  await expect(dialog.getByText('Preview only. No money is transferred, and no official challan, Treasury settlement, or tax credit is created.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Online method preview' }).click();
  await expect(action).toBeDisabled();
  await dialog.getByRole('radio', { name: 'Visa' }).check();
  await expect(action).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /I checked the TIN/ }).check();
  await expect(action).toBeEnabled();
  await action.click();
  await expect(dialog.getByText('Step 4 of 4')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Payment preview prepared' })).toBeVisible({ timeout: 12000 });
  const timeline = dialog.getByTestId('payment-lifecycle');
  await expect(timeline.getByText('PREVIEW_CREATED', { exact: true })).toBeVisible();
  await expect(timeline.getByText('SIMULATION_NOT_SENT', { exact: true })).toBeVisible();
  for (const forbidden of ['AUTHORIZED', 'ACS_REFERENCE_CREATED', 'TREASURY_SETTLED', 'NBR_LEDGER_POSTED', 'CREDITED']) {
    await expect(timeline.getByText(forbidden, { exact: true })).toHaveCount(0);
  }
  await expect(dialog.getByRole('heading', { name: 'TaxPay — Receipt details' })).toBeVisible();
  await expect(dialog.getByText(/PREVIEW-\d{4}-PAY-/)).toBeVisible();
  await expect(dialog.getByText('Not sent')).toBeVisible();
  await expect(dialog.getByText('No scroll reference')).toBeVisible();
  await expect(dialog.getByText(/SIMULATION-NOT-SENT/)).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test('bank branch choice creates only an unsent preview and no payment slip', async ({ page }) => {
  const dialog = await openReview(page);
  await dialog.getByRole('button', { name: 'Bank branch preview' }).click();
  await dialog.getByRole('checkbox', { name: /I checked the TIN/ }).check();
  await dialog.getByRole('button', { name: 'Prepare payment preview' }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment preview prepared' })).toBeVisible({ timeout: 12000 });
  await expect(dialog.getByRole('heading', { name: 'TaxPay — Receipt details' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Bank payment slip ready' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Continue bank payment' })).toHaveCount(0);
  await expect(dialog.getByTestId('payment-lifecycle').getByText('SIMULATION_NOT_SENT', { exact: true })).toBeVisible();
  await expect(dialog.getByText('No scroll reference')).toBeVisible();
});

test('local mock failure creates no receipt and supports a fresh preview', async ({ page }) => {
  const dialog = await openReview(page);
  await dialog.getByRole('button', { name: 'Online method preview' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: 'Show local mock failure' }).check();
  await dialog.getByRole('checkbox', { name: /I checked the TIN/ }).check();
  await dialog.getByRole('button', { name: 'Prepare payment preview' }).click();
  await expect(dialog.getByRole('heading', { name: 'Local mock failure' })).toBeVisible({ timeout: 12000 });
  await expect(dialog.getByTestId('payment-lifecycle').getByText('MOCK_FAILURE', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'TaxPay — Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Retry preview' }).click();
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Prepare payment preview' })).toBeDisabled();
});
