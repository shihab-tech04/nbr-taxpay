import { openLegacyTaxServiceChoice } from './pay-tax-entry-helper';
import {mockSubmittedPaymentSqlReadback} from './mock-submitted-payment-readback';
import { expect, test, type Page } from '@playwright/test';

async function openReview(page: Page, category = 'Tax with Return') {
  // This is the disconnected browser/UI suite. Verify the request payload while
  // avoiding hosted synthetic writes; separate disposable-SQL E2E tests cover
  // actual TaxPay → Office persistence, acknowledgments and notification delivery.
  await mockSubmittedPaymentSqlReadback(page);
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
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
  await openLegacyTaxServiceChoice(page);
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
  await expect(dialog.locator('.taxpay-modal__subtitle')).toContainText('My Tax Liability');
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
  const action = dialog.getByRole('button', { name: /Pay ৳ 12,500/ });
  await expect(action).toBeDisabled();
  await expect(dialog.getByText('Payment summary', { exact: true })).toHaveCount(0);
  await expect(dialog.locator('.payment-form-summary__total')).toHaveText('৳ 12,500');
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
  await expect(dialog.locator('.taxpay-modal__step-count')).toHaveText('4/4 Steps');
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 12000 });
  await expect(dialog.getByText('Payment record saved; settlement is not verified.')).toBeVisible();
  await expect(dialog.locator('.payment-lifecycle__reference-value')).not.toBeEmpty();
  await dialog.locator('.payment-lifecycle__progress-detail summary').click();
  const timeline = dialog.getByTestId('payment-lifecycle');
  for (const stage of ['Payment request started', 'Request details prepared', 'Reference generated', 'Preparing payment record', 'Treasury settlement not verified', 'Ledger entry not confirmed', 'Tax credit not confirmed']) {
    await expect(timeline.getByText(stage, { exact: true })).toBeVisible();
  }
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Challan details' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Payment record status' })).toBeVisible();
  const receiptPaper = dialog.locator('.receipt-view__paper');
  await expect(receiptPaper).toBeVisible();
  // Optional after-payment sign-in never blocks accessing the guest receipt.
  const invitation = dialog.getByTestId('walkin-postpayment-login');
  await expect(invitation).toBeVisible();
  await expect(invitation).toContainText('not automatically linked');
  await expect(dialog.getByTestId('walkin-receipt-toolbar')).toHaveCount(0);
  await expect(dialog.locator('.taxpay-modal__header').getByRole('button', { name: 'Back to confirmation' })).toBeVisible();
  // The receipt reads in financial order: summary -> references ->
  // payer/settlement details -> optional login; Back belongs to modal header.
  const hierarchyIsCorrect = await receiptPaper.evaluate(paper => {
    const selectors = [
      '.receipt-view__summary',
      '.receipt-view__reference-strip',
      '.receipt-view__parties',
      '.walkin-postpayment-login',
    ];
    const elements = selectors.map(selector => paper.querySelector(selector));
    return elements.every((element, index) => element && (index === 0 ||
      Boolean(elements[index - 1]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)));
  });
  expect(hierarchyIsCorrect).toBe(true);
  await expect(dialog.locator('.receipt-view__actions .receipt-view__restart')).toHaveCount(0);
  await invitation.getByRole('button', { name: 'Continue without signing in' }).click();
  await expect(invitation).toHaveCount(0);
  await expect(receiptPaper).toBeVisible();
  const backToConfirmation = dialog.getByRole('button', { name: 'Back to confirmation', exact: true });
  await expect(backToConfirmation).toBeVisible();
  await backToConfirmation.click();
  await expect(receiptPaper).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Receipt details', exact: true })).toBeVisible();
  await expect(dialog.locator('.payment-form-summary')).toHaveCount(0);
  await expect(dialog.getByText('Not an official challan')).toHaveCount(0);
  await expect(dialog.getByText('Simulation only. No actual money transfer, government challan or tax credit has occurred.')).toHaveCount(0);
});


test('after a saved walk-in record, Sign in is optional and opens the existing login route', async ({ page }) => {
  const dialog = await openReview(page, 'Other Tax');
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Cards' }).click();
  await dialog.getByRole('radio', { name: 'Visa' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await dialog.getByRole('button', { name: /Pay ৳ 12,500/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 12000 });
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  const invitation = dialog.getByTestId('walkin-postpayment-login');
  await expect(invitation).toBeVisible();
  await expect(dialog.locator('.receipt-view__reference-strip')).toBeVisible();
  await invitation.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await expect(page.getByRole('dialog').getByLabel('User ID')).toBeVisible();
});

test('bank branch creates an unpaid challan first, then a receipt after simulated settlement', async ({ page }) => {
  const dialog = await openReview(page);
  await dialog.getByRole('button', { name: 'Pay at a bank branch' }).click();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await dialog.getByRole('button', { name: 'Get payment slip' }).click();
  await expect(dialog.getByRole('heading', { name: 'Bank payment slip ready' })).toBeVisible();
  await expect(dialog.getByText('This is not tax paid yet')).toBeVisible();
  await expect(dialog.getByText('Bank settlement and tax credit are not confirmed.')).toBeVisible();
  await dialog.locator('.payment-lifecycle__progress-detail summary').click();
  await expect(dialog.getByTestId('payment-lifecycle').getByText('Reference generated')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue bank payment' }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 12000 });
  await dialog.locator('.payment-lifecycle__progress-detail summary').click();
  await expect(dialog.getByTestId('payment-lifecycle').getByText('Treasury settlement not verified')).toBeVisible();
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Challan details' })).toBeVisible();
});

test('declined online authorization issues no receipt and allows a new method', async ({ page }) => {
  const dialog = await openReview(page);
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: 'Show declined payment outcome' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await dialog.getByRole('button', { name: /Pay ৳ 12,500/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment request declined' })).toBeVisible({ timeout: 12000 });
  await dialog.locator('.payment-lifecycle__progress-detail summary').click();
  await expect(dialog.getByTestId('payment-lifecycle').getByText('Request declined')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Try another method' }).click();
  await expect(dialog.locator('.taxpay-modal__step-count')).toHaveText('3/4 Steps');
  await expect(dialog.getByRole('button', { name: /Pay ৳ 12,500/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'Nagad' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm/ }).check();
  await dialog.getByRole('button', { name: /Pay ৳ 12,500/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 12000 });
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Challan details' })).toBeVisible();
});
