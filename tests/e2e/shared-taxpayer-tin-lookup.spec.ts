import { test, expect } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

// Shared UI checks exercise existing guest payment entry; no hosted financial writes.
test('shared TIN/name card is used by normal guest payment, with lookup and clear', async ({ page }) => {
  await page.goto('/?action=landing');
  const dialog = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN');
  const card = dialog.getByTestId('shared-taxpayer-tin-lookup');
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId('taxpayer-tin-digits').locator('span')).toHaveCount(12);
  await expect(card.locator('#guest-tin')).toHaveAttribute('maxlength', '12');
  await expect(card.locator('#guest-taxpayer-name')).toHaveAttribute('readonly', '');
  await expect(card.locator('label[for="guest-taxpayer-name"]')).toHaveText('Taxpayer name');
  await card.locator('#guest-tin').fill('111111111111');
  const [digitsBox,clearBox]=await Promise.all([
    card.getByTestId('taxpayer-tin-digits').boundingBox(),
    card.getByRole('button',{name:'Clear TIN search'}).boundingBox(),
  ]);
  expect(digitsBox && clearBox).toBeTruthy();
  if (digitsBox && clearBox) {
    expect(clearBox.y + clearBox.height, 'Clear stays in the label row, not over any TIN digit').toBeLessThanOrEqual(digitsBox.y + 1);
  }

  await card.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(card.locator('#guest-taxpayer-name')).toHaveValue('User 1');
  const preview = card.getByTestId('searched-taxpayer-card');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('User 1');
  await expect(preview).toContainText('111*********');
  await preview.getByRole('button',{name:'Reveal TIN'}).click();
  await expect(preview).toContainText('111111111111');
  await preview.getByRole('button',{name:'Hide TIN'}).click();
  await expect(preview).not.toContainText('111111111111');
  await expect(preview.getByRole('button',{name:/copy/i})).toHaveCount(0);

  await card.getByRole('button', { name: 'Clear TIN search' }).click();
  await expect(card.locator('#guest-tin')).toHaveValue('');
  await expect(card.locator('#guest-taxpayer-name')).toHaveValue('');
  await expect(card.getByTestId('searched-taxpayer-card')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Search', exact: true })).toBeDisabled();
  expect(await dialog.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(2);
});

test('every additional Other Tax taxpayer reveals a details review and keeps clear-input behavior', async ({ page }) => {
  await page.goto('/?action=landing');
  const dialog = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  const list = dialog.getByTestId('other-tax-taxpayer-list');
  const primary = list.getByTestId('other-tax-primary-taxpayer');
  await expect(primary.getByTestId('shared-taxpayer-tin-lookup')).toHaveCount(1);
  await expect(primary.locator('.tin-lookup__name')).toBeVisible();
  await expect(primary.locator('#other-tax-primary-name')).toHaveValue('');
  // Focus alone must not reveal suggestions; only deliberate typing opens them.
  const entry = primary.locator('#guest-tin');
  await entry.focus();
  await expect(entry).toHaveAttribute('aria-expanded','false');
  await expect(page.getByRole('listbox',{name:'Sample TIN suggestions — not NBR verified'})).toHaveCount(0);
  await entry.fill('1');
  const suggestionBox=page.getByRole('listbox',{name:'Sample TIN suggestions — not NBR verified'});
  await expect(suggestionBox).toBeVisible();
  const relative=await entry.evaluate(element=>({bottom:element.getBoundingClientRect().bottom}));
  const popupRect=await suggestionBox.boundingBox();
  expect(popupRect!.y).toBeGreaterThanOrEqual(relative.bottom-1);
  // Search dismisses suggestions rather than leaving them over subsequent controls.
  await entry.fill('111111111111');

  await primary.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(primary.locator('#other-tax-primary-name')).toHaveValue('User 1');
  await expect(primary.getByTestId('searched-taxpayer-card')).toBeVisible(); // One shared masked result card.
  // Match the Travel Tax sequence: preview details first, separate full-width
  // Add action below the preview, and no Add another before confirmation.
  await expect(primary.getByTestId('shared-taxpayer-tin-lookup').getByRole('button', { name: 'Add taxpayer' })).toHaveCount(0);
  await expect(primary.locator('.taxpay-taxpayer-row__fields > .taxpay-taxpayer-row__confirm-add')).toHaveCount(1);
  await expect(primary.getByRole('button', { name: 'Add taxpayer' })).toBeVisible();
  await expect(list.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await primary.getByRole('button', { name: 'Add taxpayer' }).click();
  await expect(primary.getByTestId('confirmed-taxpayer-summary')).toContainText('User 1');

  await list.getByRole('button', { name: 'Add another taxpayer' }).click();
  const additional = list.getByTestId('other-tax-taxpayer').last();
  await expect(additional.getByTestId('shared-taxpayer-tin-lookup')).toHaveCount(1);
  await expect(additional.getByTestId('taxpayer-tin-digits').locator('span')).toHaveCount(12);
  const tin = additional.locator('input[id^="other-tax-tin-"]');
  await tin.fill('222222222222');
  await additional.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(additional.locator('input[id^="other-tax-name-"]')).toHaveValue('User 2');
  await additional.getByRole('button', { name: 'Clear TIN search' }).click();
  await expect(tin).toHaveValue('');
  await expect(additional.locator('input[id^="other-tax-name-"]')).toHaveValue('');
  await expect(additional.locator('.tin-lookup__name')).toBeVisible();
  const overflow = await additional.evaluate(card => card.scrollWidth - card.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test('a valid Other Tax TIN remains addable when the optional name lookup has no match', async ({ page }) => {
  await page.goto('/?action=landing');
  const dialog = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  const list = dialog.getByTestId('other-tax-taxpayer-list');
  const primary = list.getByTestId('other-tax-primary-taxpayer');
  await primary.locator('#guest-tin').fill('123456789012');
  await primary.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(primary.locator('#other-tax-primary-name')).toHaveValue('');
  await expect(primary.getByRole('button', { name: 'Add taxpayer' })).toBeVisible();
  await primary.getByRole('button', { name: 'Add taxpayer' }).click();
  const summary = primary.getByTestId('confirmed-taxpayer-summary');
  await expect(summary).toContainText('123*********');
  await expect(summary).toContainText('Not provided');
  await expect(list.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
});

test('Other Tax follows search, review, add taxpayer, then add another; duplicates cannot be added', async ({ page }) => {
  await page.goto('/?action=landing');
  const dialog = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  const list = dialog.getByTestId('other-tax-taxpayer-list');
  const primary = list.getByTestId('other-tax-primary-taxpayer');
  await expect(list.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await expect(primary.getByRole('button', { name: 'Add taxpayer' })).toHaveCount(0);
  await primary.locator('#guest-tin').fill('111111111111');
  await expect(primary.getByRole('button', { name: 'Add taxpayer' })).toHaveCount(0);
  await primary.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(primary.locator('#other-tax-primary-name')).toHaveValue('User 1');
  await primary.getByRole('button', { name: 'Add taxpayer' }).click();
  await expect(primary.getByTestId('confirmed-taxpayer-summary')).toContainText('111*********');
  await expect(list.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
  await list.getByRole('button', { name: 'Add another taxpayer' }).click();
  const additional = list.getByTestId('other-tax-taxpayer').last();
  await expect(list.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await expect(additional.getByRole('button', { name: 'Add taxpayer' })).toHaveCount(0);
  const tin = additional.locator('input[id^="other-tax-tin-"]');
  await tin.fill('111111111111');
  await additional.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(additional.getByText('Taxpayer already added.')).toBeVisible();
  await expect(additional.getByRole('button', { name: 'Add taxpayer' })).toHaveCount(0);
  await tin.fill('222222222222');
  await additional.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(additional.locator('input[id^="other-tax-name-"]')).toHaveValue('User 2');
  await additional.getByRole('button', { name: 'Add taxpayer' }).click();
  await expect(additional.getByTestId('confirmed-taxpayer-summary')).toContainText('User 2');
  await expect(list.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
  await primary.getByRole('button', { name: 'Edit' }).click();
  await expect(list.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await expect(primary.getByRole('button', { name: 'Add taxpayer' })).toHaveCount(0);
  await primary.getByRole('button', { name: 'Search', exact: true }).click();
  await primary.getByRole('button', { name: 'Add taxpayer' }).click();
  await expect(list.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
  expect(await dialog.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(2);
});