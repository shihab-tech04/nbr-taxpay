import { test, expect } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

// Shared UI checks exercise existing guest payment entry; no hosted financial writes.
test('shared TIN/name card is used by normal guest payment, with lookup and clear', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN');
  const card = dialog.getByTestId('shared-taxpayer-tin-lookup');
  await expect(card).toHaveCount(1);
  await expect(card.locator('#guest-taxpayer-name')).toHaveAttribute('readonly', '');
  await expect(card.locator('label[for="guest-taxpayer-name"]')).toHaveText('Taxpayer name');
  await card.locator('#guest-tin').fill('111111111111');
  await card.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(card.locator('#guest-taxpayer-name')).toHaveValue('User 1');
  await card.getByRole('button', { name: 'Clear TIN search' }).click();
  await expect(card.locator('#guest-tin')).toHaveValue('');
  await expect(card.locator('#guest-taxpayer-name')).toHaveValue('');
  await expect(card.getByRole('button', { name: 'Search', exact: true })).toBeDisabled();
  expect(await dialog.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(2);
});

test('every additional Other Tax taxpayer uses the same stacked TIN/name and clear pattern', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  const list = dialog.getByTestId('other-tax-taxpayer-list');
  const primary = list.getByTestId('other-tax-primary-taxpayer');
  await expect(primary.getByTestId('shared-taxpayer-tin-lookup')).toHaveCount(1);
  await expect(primary.locator('label[for="other-tax-primary-name"]')).toHaveText('Taxpayer name');
  await primary.locator('#guest-tin').fill('111111111111');
  await primary.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(primary.locator('#other-tax-primary-name')).toHaveValue('User 1');

  await list.getByRole('button', { name: 'Add another taxpayer' }).click();
  const additional = list.getByTestId('other-tax-taxpayer').last();
  await expect(additional.getByTestId('shared-taxpayer-tin-lookup')).toHaveCount(1);
  const tin = additional.locator('input[id^="other-tax-tin-"]');
  await tin.fill('222222222222');
  await additional.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(additional.locator('input[id^="other-tax-name-"]')).toHaveValue('User 2');
  await additional.getByRole('button', { name: 'Clear TIN search' }).click();
  await expect(tin).toHaveValue('');
  await expect(additional.locator('input[id^="other-tax-name-"]')).toHaveValue('');
  const geometry = await additional.evaluate(card => {
    const tin = card.querySelector('input[id^="other-tax-tin-"]')!.getBoundingClientRect();
    const name = card.querySelector('input[id^="other-tax-name-"]')!.getBoundingClientRect();
    return { stacked: name.top > tin.bottom, overflow: card.scrollWidth - card.clientWidth };
  });
  expect(geometry.stacked).toBe(true);
  expect(geometry.overflow).toBeLessThanOrEqual(2);
});
