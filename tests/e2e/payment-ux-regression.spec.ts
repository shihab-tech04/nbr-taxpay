import { enterTaxPayService } from './pay-tax-entry-helper';
import { expect, test, type Page } from '@playwright/test';

async function beginGuestPayment(page: Page, service: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.locator('.tax-service-choice__card')).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  const ids: Record<string, string> = {
    'Tax with Return': 'TAX_WITH_RETURN',
    'Penalty': 'PENALTY'
  };
  await enterTaxPayService(dialog, ids[service]);
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  return dialog;
}

test('payer is required before choosing a payment service and is not asked twice', async ({ page }) => {
  const dialog = await beginGuestPayment(page, 'Tax with Return');
  await expect(dialog.getByRole('radio', { name: 'My own tax' })).toHaveCount(0);
  await expect(dialog.locator('.payment-form-payer-confirmation')).toContainText('My own tax');
  await expect(dialog.locator('#guest-tin')).toBeVisible();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.locator('.payment-radio-card')).toHaveCount(2);
  await expect(dialog.getByRole('radio', { name: /Person other than company/ })).not.toBeChecked();
  await expect(dialog.getByRole('radio', { name: /Company/ })).not.toBeChecked();
  await expect(dialog.locator('#guest-tin-hint')).toHaveCount(0);
});

test('large multi-head values do not turn into zero; missing head is focused with an inline error', async ({ page }) => {
  const dialog = await beginGuestPayment(page, 'Penalty');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await dialog.getByRole('radio', { name: /Person other than company/ }).check();
  await dialog.locator('.payment-head-options input[type="checkbox"]').first().check();
  const secondHead = dialog.locator('.payment-head-options input[type="checkbox"]').nth(1);
  const secondId = await secondHead.inputValue();
  await secondHead.check();
  await dialog.locator('#guest-tax-amount').fill('111122241212');
  const expectedFirst = new Intl.NumberFormat('en-IN').format(111122241212);
  await expect(dialog.locator('.payment-form-summary__total')).toContainText(expectedFirst);
  await expect(dialog.locator('.payment-form-summary__breakdown')).toContainText('—');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.locator(`#guest-tax-amount-${secondId}`)).toBeFocused();
  await expect(dialog.getByRole('alert')).toContainText('greater than zero');
  await dialog.locator(`#guest-tax-amount-${secondId}`).fill('12214124442.75');
  const expectedTotal = new Intl.NumberFormat('en-IN').format(123336365654.75);
  await expect(dialog.locator('.payment-form-summary__total')).toContainText(expectedTotal);
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByTestId('payment-review')).toBeVisible();
  await expect(dialog.getByText('Payment summary', { exact: true })).toHaveCount(0);
});

test('online method categories reveal only relevant providers and reset the previous selection', async ({ page }) => {
  const dialog = await beginGuestPayment(page, 'Tax with Return');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await dialog.getByRole('radio', { name: /Person other than company/ }).check();
  await expect(dialog.locator('.payment-head-single input[type="checkbox"]')).toBeChecked();
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
  await expect(dialog.locator('.payment-head-single input[type="checkbox"]')).toBeChecked();
  await dialog.locator('#guest-tax-amount').fill('12000');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Cards' }).click();
  await expect(dialog.getByRole('radio', { name: 'Visa' })).toBeVisible();
  expect(await dialog.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
});
