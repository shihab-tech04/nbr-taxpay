import { expect, test, type Page } from '@playwright/test';

async function openReview(page: Page, category = 'Tax with Return') {
  // This is the disconnected browser/UI suite. Verify the request payload while
  // avoiding hosted synthetic writes; separate disposable-SQL E2E tests cover
  // actual TaxPay → Office persistence, acknowledgments and notification delivery.
  await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/functions/v1/demo-story1-taxpay/payments', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const request = route.request().postDataJSON() as {
      amountMinor?: number; sessionId?: string; origin?: string; service?: string;
    };
    expect(request.amountMinor).toBe(1250000);
    expect(request.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(request.origin).toBe('QA_BROWSER');
    expect(request.service).toBe(category === 'Tax with Return' ? 'TAX_WITH_RETURN' : 'OTHER_TAX_PAYMENT');
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true, id: '10000000-0000-4000-8000-000000000002',
        status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
      }),
    });
  });
  await page.goto('/');
  const initialUrl = page.url();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  if (category === 'Tax with Return') {
    await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  } else {
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
  }
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(dialog.locator('.tax-service-choice__selected-service')).toContainText('My tax liability');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  if (category === 'Tax with Return') {
    await expect(dialog.locator('.payment-head-single')).toHaveCount(0);
    await expect(dialog.locator('.payment-form-section').last()).toContainText('Enter the amount from your return');
  await expect(dialog.locator('.payment-form-section').last()).toContainText('See the payment summary for the applicable sections');
  await expect(dialog.locator('.payment-form-summary__rows')).toContainText('Section 173 (on-time) / 174 (late filing)');
    await expect(dialog.locator('#guest-tax-amount')).toBeVisible();
  }
  else {
    await dialog.locator('[data-head-group="Advance Tax"] summary').click();
    await dialog.getByRole('checkbox', { name: /Select 68A/ }).check();
    await dialog.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('12500');
  }
  if (category === 'Tax with Return') {
    await dialog.getByRole('radio', { name: /Person other than company/ }).check();
    await dialog.locator('#guest-tax-amount').fill('12500');
  }
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
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await expect(action).toBeEnabled();
  await action.click();
  await expect(dialog.getByText('Step 4 of 4')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 12000 });
  await expect(dialog.getByText('Review the payment reference and current record status below.')).toBeVisible();
  await expect(dialog.getByText('Payment record saved. Reference and current status are available below.')).toBeVisible();
  await dialog.getByText('Payment progress details').click();
  const timeline = dialog.getByTestId('payment-lifecycle');
  for (const stage of ['Payment request started', 'Request details prepared', 'Reference generated', 'Preparing payment record', 'Treasury settlement not verified', 'Ledger entry not confirmed', 'Tax credit not confirmed']) {
    await expect(timeline.getByText(stage, { exact: true })).toBeVisible();
  }
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
  await expect(dialog.getByRole('note')).toContainText('Demo receipt only — no money transferred');
  await expect(dialog.locator('.payment-form-summary')).toHaveCount(0);
  await expect(dialog.getByText('Not an official challan')).toHaveCount(0);
  await expect(dialog.getByText('Simulation only. No actual money transfer, government challan or tax credit has occurred.')).toHaveCount(0);
});

test('bank branch creates an unpaid challan first, then a receipt after simulated settlement', async ({ page }) => {
  const dialog = await openReview(page);
  await dialog.getByRole('button', { name: 'Pay at a bank branch' }).click();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await dialog.getByRole('button', { name: 'Get payment slip' }).click();
  await expect(dialog.getByRole('heading', { name: 'Bank payment slip ready' })).toBeVisible();
  await expect(dialog.getByText('This is not tax paid yet')).toBeVisible();
  await expect(dialog.getByText('Bank settlement is pending. Tax credit has not been confirmed.')).toBeVisible();
  await dialog.getByText('Payment progress details').click();
  await expect(dialog.getByTestId('payment-lifecycle').getByText('Reference generated')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue bank payment' }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 12000 });
  await dialog.getByText('Payment progress details').click();
  await expect(dialog.getByTestId('payment-lifecycle').getByText('Treasury settlement not verified')).toBeVisible();
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
});

test('declined online authorization issues no receipt and allows a new method', async ({ page }) => {
  const dialog = await openReview(page);
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: 'Show declined payment outcome' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await dialog.getByRole('button', { name: /Pay BDT 12,500/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment request declined' })).toBeVisible({ timeout: 12000 });
  await dialog.getByText('Payment progress details').click();
  await expect(dialog.getByTestId('payment-lifecycle').getByText('Request declined')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Try another method' }).click();
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Pay BDT 12,500/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'Nagad' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await dialog.getByRole('button', { name: /Pay BDT 12,500/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 12000 });
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
});
