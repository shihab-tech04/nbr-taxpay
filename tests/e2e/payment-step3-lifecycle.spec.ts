import { expect, test, type Page } from '@playwright/test';

async function openReview(page: Page, category = 'Tax with Return') {
  await page.goto('/');
  const initialUrl = page.url();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  if (category === 'Tax with Return') {
    await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  } else {
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
  }
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(dialog.locator('.payment-form-payer-confirmation')).toContainText('My own tax');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  if (category === 'Tax with Return') await expect(dialog.locator('.payment-head-single input')).toBeChecked();
  else await dialog.locator('.payment-head-options input').first().check();
  if (category !== 'Source Tax Deposit') await dialog.getByRole('radio', { name: /Person other than company/ }).check();
  await dialog.locator('#guest-tax-amount').fill('12500');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByTestId('payment-review')).toBeVisible();
  await expect(page).toHaveURL(initialUrl);
  return dialog;
}

test('online Step 3 requires channel, method and reviewed details before advancing', async ({ page }) => {
  const dialog = await openReview(page, 'Other Tax');
  const action = dialog.getByRole('button', { name: /Pay BDT 12,500/ });
  await expect(action).toBeDisabled();
  await expect(dialog.getByText('Payment summary', { exact: true })).toHaveCount(0);
  await expect(dialog.locator('.payment-form-summary__total')).toHaveText('BDT 12,500');
  await expect(dialog.getByText('Payment simulation only')).toHaveCount(0);
  await expect(dialog.getByText('No money is transferred and no official challan is issued.')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await expect(action).toBeDisabled();
  await expect(dialog.getByRole('radio', { name: 'Internet Banking' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cards' }).click();
  await expect(dialog.getByRole('radio', { name: 'Visa' })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Mastercard' })).toBeVisible();
  await dialog.getByRole('radio', { name: 'Visa' }).check();
  await expect(action).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /I confirm the TIN/ }).check();
  await expect(action).toBeEnabled();
  await action.click();
  await expect(dialog.getByText('Step 4 of 4')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Payment process complete' })).toBeVisible({ timeout: 12000 });
  await dialog.getByText('Payment progress details').click();
  const timeline = dialog.getByTestId('payment-lifecycle');
  for (const stage of ['INITIATED', 'AUTHORIZED', 'ACS_REFERENCE_CREATED', 'PROCESSING', 'TREASURY_SETTLED', 'NBR_LEDGER_POSTED', 'CREDITED']) {
    await expect(timeline.getByText(stage, { exact: true })).toBeVisible();
  }
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
  await expect(dialog.locator('.payment-form-summary')).toHaveCount(0);
  await expect(dialog.getByText('Not an official challan')).toHaveCount(0);
  await expect(dialog.getByText('Simulation only. No actual money transfer, government challan or tax credit has occurred.')).toHaveCount(0);
});

test('bank branch creates an unpaid challan first, then a receipt after simulated settlement', async ({ page }) => {
  const dialog = await openReview(page);
  await dialog.getByRole('button', { name: 'Pay at a bank branch' }).click();
  await dialog.getByRole('checkbox', { name: /I confirm the TIN/ }).check();
  await dialog.getByRole('button', { name: 'Get payment slip' }).click();
  await expect(dialog.getByRole('heading', { name: 'Bank payment slip ready' })).toBeVisible();
  await expect(dialog.getByText('This is not tax paid yet')).toBeVisible();
  await expect(dialog.getByText('15 days', { exact: false })).toBeVisible();
  await dialog.getByText('Payment progress details').click();
  await expect(dialog.getByTestId('payment-lifecycle').getByText('ACS_REFERENCE_CREATED')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue bank payment' }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment process complete' })).toBeVisible({ timeout: 12000 });
  await dialog.getByText('Payment progress details').click();
  await expect(dialog.getByTestId('payment-lifecycle').getByText('TREASURY_SETTLED')).toBeVisible();
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
});

test('declined online authorization issues no receipt and allows a new method', async ({ page }) => {
  const dialog = await openReview(page);
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: 'Show declined payment outcome' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm the TIN/ }).check();
  await dialog.getByRole('button', { name: /Pay BDT 12,500/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment request declined' })).toBeVisible({ timeout: 12000 });
  await dialog.getByText('Payment progress details').click();
  await expect(dialog.getByTestId('payment-lifecycle').getByText('FAILED')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Try another method' }).click();
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Pay BDT 12,500/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'Nagad' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm the TIN/ }).check();
  await dialog.getByRole('button', { name: /Pay BDT 12,500/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment process complete' })).toBeVisible({ timeout: 12000 });
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
});
