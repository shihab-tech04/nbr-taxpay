import { expect, test, type Page } from '@playwright/test';

async function beginGuestPayment(page: Page, service: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.locator('.tax-service-choice__card')).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  if (service === 'Tax with Return') {
    await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  } else {
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
  }
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  return dialog;
}

test('payer is required before choosing a payment service and is not asked twice', async ({ page }) => {
  const dialog = await beginGuestPayment(page, 'Tax with Return');
  await expect(dialog.getByRole('radio', { name: 'My tax liability' })).toHaveCount(0);
  await expect(dialog.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(dialog.locator('.tax-service-choice__selected-service')).toContainText('My tax liability');
  await expect(dialog.locator('#guest-tin')).toBeVisible();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.locator('.payment-radio-card')).toHaveCount(2);
  await expect(dialog.getByRole('radio', { name: /Person other than company/ })).not.toBeChecked();
  await expect(dialog.getByRole('radio', { name: /Company/ })).not.toBeChecked();
  await expect(dialog.locator('#guest-tin-hint')).toHaveCount(0);
});

test('large multi-head values do not turn into zero; missing head is highlighted with an inline error', async ({ page }) => {
  const dialog = await beginGuestPayment(page, 'Other Tax');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByRole('checkbox', { name: /Select 68B/ }).check();
  const amounts = batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]');
  await amounts.nth(1).fill('1');
  await amounts.first().fill('111122241212');
  const expectedFirst = new Intl.NumberFormat('en-IN').format(111122241213);
  await expect(dialog.locator('.payment-form-summary__total')).toContainText(expectedFirst);
  await amounts.nth(1).fill('');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(batch.getByTestId('other-tax-validation-summary')).toContainText('Correct the highlighted payment heads');
  await expect(amounts.nth(1)).toHaveAttribute('aria-invalid', 'true');
  await amounts.nth(1).fill('12214124442.75');
  const expectedTotal = new Intl.NumberFormat('en-IN').format(123336365654.75);
  await expect(dialog.locator('.payment-form-summary__total')).toContainText(expectedTotal);
  await expect(batch.getByTestId('other-tax-validation-summary')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByTestId('payment-review')).toBeVisible();
  await expect(dialog.getByText('Payment summary', { exact: true })).toHaveCount(0);
});

test('online method categories reveal only relevant providers and reset the previous selection', async ({ page }) => {
  // This is a payment-method UI regression: do not depend on a live backend
  // or create a hosted simulated payment during the disconnected CI run.
  // Preserve the full success gate by requiring a mirror acknowledgment.
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    const payload = route.request().postDataJSON() as { amountMinor?: number; service?: string };
    expect(payload.amountMinor).toBe(2_500_000);
    expect(payload.service).toBe('TAX_WITH_RETURN');
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, id: '33333333-3333-4333-8333-333333333333', status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true })
    });
  });
  const dialog = await beginGuestPayment(page, 'Tax with Return');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await dialog.getByRole('radio', { name: /Person other than company/ }).check();
  await expect(dialog.locator('.payment-head-single')).toHaveCount(0);
  await expect(dialog.locator('.payment-form-section').last()).not.toContainText('Selected payment head');
  await expect(dialog.locator('.payment-form-section').last()).toContainText('See the payment summary for the applicable sections');
  await expect(dialog.locator('.payment-form-summary__rows')).toContainText('Section 173 (on-time) / 174 (late filing)');
  await expect(dialog.locator('.payment-form-summary__rows--return-context')).toBeVisible();
  await dialog.locator('#guest-tax-amount').fill('25000');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await expect(dialog.locator('.payment-review__method-list')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Internet banking' }).click();
  await expect(dialog.getByRole('radio', { name: 'Internet Banking' })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Sonali e-Sheba' })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'BEFTN / RTGS' })).toBeVisible();
  await dialog.getByRole('radio', { name: 'Sonali e-Sheba' }).check();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await expect(dialog.getByRole('radio', { name: 'Internet Banking' })).toHaveCount(0);
  await expect(dialog.getByRole('radio', { name: 'bKash' })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Nagad' })).toBeVisible();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await expect(dialog.getByRole('checkbox', { name: /I confirm the TIN/ })).not.toBeChecked();
  await dialog.getByRole('checkbox', { name: /I confirm the TIN/ }).check();
  await dialog.getByRole('button', { name: /Pay BDT 25,000/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment process complete' })).toBeVisible({ timeout: 12000 });
  await expect(dialog.locator('.payment-form-summary')).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Back to confirmation' }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment process complete' })).toBeVisible();
});

test('payment wizard stays within the viewport at phone widths', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-1280', 'Small-screen layout check');
  const dialog = await beginGuestPayment(page, 'Tax with Return');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.locator('.payment-radio-card')).toHaveCount(2);
  const overflow = await dialog.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await dialog.getByRole('radio', { name: /Person other than company/ }).check();
  await expect(dialog.locator('.payment-head-single')).toHaveCount(0);
  await expect(dialog.locator('.payment-form-section').last()).not.toContainText('Selected payment head');
  await expect(dialog.locator('.payment-form-section').last()).toContainText('See the payment summary for the applicable sections');
  await expect(dialog.locator('.payment-form-summary__rows')).toContainText('Section 173 (on-time) / 174 (late filing)');
  await expect(dialog.locator('.payment-form-summary__rows--return-context')).toBeVisible();
  await dialog.locator('#guest-tax-amount').fill('12000');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Cards' }).click();
  await expect(dialog.getByRole('radio', { name: 'Visa' })).toBeVisible();
  expect(await dialog.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
});


test('desktop Pay Tax steps size to content and align AY with amount without an unnecessary scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Desktop 1280px geometry acceptance');
  await page.setViewportSize({ width: 1280, height: 900 });
  const dialog = await beginGuestPayment(page, 'Tax with Return');
  const outer = dialog.locator('.taxpay-modal__body');
  const stepOneBox = await dialog.boundingBox();
  expect(stepOneBox).not.toBeNull();
  // Step 1 contains one short taxpayer card and a summary, not a 92vh blank canvas.
  expect(stepOneBox!.height).toBeLessThan(760);
  expect(await outer.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(2);

  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.locator('#guest-assessment-year')).toBeVisible();
  await expect(dialog.locator('#guest-tax-amount')).toBeVisible();
  const [year, amount] = await Promise.all([
    dialog.locator('#guest-assessment-year').boundingBox(),
    dialog.locator('#guest-tax-amount').boundingBox()
  ]);
  expect(year).not.toBeNull();
  expect(amount).not.toBeNull();
  expect(Math.abs(year!.y - amount!.y)).toBeLessThanOrEqual(12);
  // The nested AY grid must not collapse the dropdown to half its column.
  expect(year!.width).toBeGreaterThan(amount!.width * 0.75);
  expect(year!.x + year!.width).toBeLessThanOrEqual(amount!.x + 2);
  expect(await outer.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await expect(dialog.getByRole('button', { name: 'Continue to payment channel' })).toBeVisible();
});
