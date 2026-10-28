import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

test('payment stepper has connected numbered states and shows completed progression', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN');
  const progress = dialog.locator('.tax-service-choice__progress');
  await expect(progress.locator('li')).toHaveCount(4);
  await expect(progress.locator('li').nth(0)).toHaveAttribute('data-progress-status', 'current');
  await expect(progress.locator('li').nth(1)).toHaveAttribute('data-progress-status', 'upcoming');
  await expect(progress.locator('li').nth(0).locator('.tax-service-choice__stage-number')).toHaveText('1');
  await expect(progress).toHaveCSS('border-top-style', 'solid');
  const card = dialog.getByRole('region', { name: 'Account taxpayer details' });
  await expect(card).toHaveCount(0); // Guests enter their identity; account fields never appear accidentally.
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(progress.locator('li').nth(0)).toHaveAttribute('data-progress-status', 'complete');
  await expect(progress.locator('li').nth(1)).toHaveAttribute('data-progress-status', 'current');
  await expect(progress.locator('li').nth(0).locator('svg')).toBeVisible();
  await expect(progress.locator('li').nth(1).locator('.tax-service-choice__stage-number')).toHaveText('2');
});

test('guest Other Tax shows one collapsible calculation group per beneficiary and exact subtotal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-payer-name').fill('Example Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Add another taxpayer' }).click();
  await dialog.getByTestId('other-tax-taxpayer').locator('input[id^="other-tax-tin-"]').fill('234567890123');
  const grouped = dialog.getByTestId('grouped-taxpayer-calculation');
  await expect(grouped.locator('details')).toHaveCount(2);
  await expect(grouped).toContainText('123456789012');
  await expect(grouped).toContainText('234567890123');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('2100');
  const tabs = batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button');
  await tabs.nth(1).click();
  await batch.getByRole('checkbox', { name: /Select 68B/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('3500');
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('5,600');
  await expect(grouped.locator('details')).toHaveCount(2);
  await expect(grouped.locator('details').nth(0).locator('summary')).toContainText('2,100');
  await expect(grouped.locator('details').nth(1).locator('summary')).toContainText('3,500');
  await grouped.locator('details').nth(1).locator('summary').click();
  await expect(grouped.locator('details').nth(1)).toHaveAttribute('open', '');
  await expect(grouped.locator('details').nth(1)).toContainText('68B');
  expect(await dialog.locator('.taxpay-modal__body').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(2);
});

test('account taxpayer data is flat and recommendations do not claim liabilities from a historical record', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await page.getByRole('textbox', { name: 'Password' }).fill('user1');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN', 'SELF');
  const card = dialog.getByRole('region', { name: 'Account taxpayer details' });
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(card).toHaveCSS('border-top-style', 'none');
  await expect(card).toContainText('1111111111111');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.getByText('Based on this taxpayer’s recorded demo activity.')).toHaveCount(0);
});
