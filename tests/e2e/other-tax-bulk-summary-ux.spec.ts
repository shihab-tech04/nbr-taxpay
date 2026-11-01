import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

async function openPurposeAndAmount(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.getByRole('button', { name: /^Search(?: TIN)?$/ }).click();
  await dialog.locator('#guest-payer-name').fill('Sample Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  return dialog;
}

test('total spells Taka and paisa while repeated years are easy to add and remove', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Desktop two-column calculation contract');
  const dialog = await openPurposeAndAmount(page);
  const batch = dialog.getByTestId('other-tax-batch');
  const calculation = dialog.locator('.payment-form-summary');
  await expect(calculation.getByTestId('payment-total-in-words')).toHaveText('Zero Taka only');
  await expect(calculation).not.toContainText('Updates as you complete the form.');
  await batch.locator('[data-head-group="Advance Tax"] > summary').click();
  await batch.getByRole('checkbox', { name: /Select 64 —/ }).check();
  await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('10.50');
  await expect(calculation.getByTestId('payment-total-in-words')).toHaveText('Ten Taka and Fifty Paisa only');
  await batch.getByRole('button', { name: /Add another assessment year/ }).click();
  await expect(batch.getByTestId('other-tax-line')).toHaveCount(2);
  const secondYear = batch.getByTestId('other-tax-line').nth(1);
  await expect(secondYear.locator('.other-tax-year-allocation__fields > button.other-tax-year-remove')).toBeVisible();
  await expect(secondYear.locator('.other-tax-year-allocation__toolbar')).toHaveCount(0);
  await secondYear.getByRole('button', { name: /^Remove assessment year:/ }).click();
  await expect(batch.getByTestId('other-tax-line')).toHaveCount(1);
  await expect(calculation.getByTestId('payment-total-in-words')).toHaveText('Ten Taka and Fifty Paisa only');
});

test('select all never overflows the pinned desktop calculation', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Desktop pinned calculation contract');
  await page.setViewportSize({ width: 1280, height: 900 });
  const dialog = await openPurposeAndAmount(page);
  const batch = dialog.getByTestId('other-tax-batch');
  const menu = batch.getByTestId('other-tax-selection-menu');
  await menu.locator('summary').click();
  await menu.getByRole('button', { name: 'Select all', exact: true }).click();
  const calculation = dialog.locator('.taxpay-modal__body .payment-form-summary');
  await expect(calculation.locator('.payment-form-summary__more-heads')).toBeVisible();
  await expect(calculation.locator('.payment-form-summary__breakdown > button')).toHaveCount(6);
  await expect(calculation.locator('.payment-form-summary__more-heads > summary')).toContainText(/Show \d+ more selected heads/);
  await expect(calculation).toHaveCSS('overflow', 'hidden');
  await calculation.locator('.payment-form-summary__more-heads > summary').click();
  await expect(calculation.locator('.payment-form-summary__more-heads')).toHaveAttribute('open', '');
  expect(await dialog.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
});

// Remove appears as a compact third field action, not a separate row heading.
test('year, amount and delete share one desktop row with correct removal semantics', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Desktop three-column contract');
  const dialog = await openPurposeAndAmount(page);
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] > summary').click();
  await batch.getByRole('checkbox', { name: /Select 64 —/ }).check();
  await batch.getByRole('button', { name: /Add another assessment year/ }).click();
  const lines = batch.getByTestId('other-tax-line');
  await expect(lines).toHaveCount(2);
  for (const item of await lines.all()) {
    const rects = await item.locator('.other-tax-year-allocation__fields > *').evaluateAll(nodes => nodes.map(node => {
      const { x, y, width } = node.getBoundingClientRect();
      return { x, y, width };
    }));
    expect(rects).toHaveLength(3);
    expect(Math.abs(rects[0].y - rects[1].y)).toBeLessThan(2);
    expect(rects[0].x).toBeLessThan(rects[1].x);
    expect(rects[1].x).toBeLessThan(rects[2].x);
    expect(rects[2].width).toBe(44);
  }
  await lines.first().getByRole('button', { name: /Remove assessment year/ }).click();
  await expect(lines).toHaveCount(1);
  await expect(batch.getByRole('checkbox', { name: /Select 64 —/ })).toBeChecked();
  await expect(lines.first().getByRole('button', { name: /Remove assessment year/ })).toHaveCount(0);
  await expect(lines.first().locator('.other-tax-year-allocation__fields > *')).toHaveCount(2);
  // Removing the last year is intentionally done by unchecking the head.
  await batch.getByRole('checkbox', { name: /Select 64 —/ }).uncheck();
  await expect(lines).toHaveCount(0);
});

test('320px mobile stacks fields with delete beside amount and no row overflow', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-320', '320px mobile contract');
  const dialog = await openPurposeAndAmount(page);
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] > summary').click();
  await batch.getByRole('checkbox', { name: /Select 64 —/ }).check();
  await batch.getByRole('button', { name: /Add another assessment year/ }).click();
  const row = batch.getByTestId('other-tax-line').last().locator('.other-tax-year-allocation__fields');
  const rects = await row.locator(':scope > *').evaluateAll(nodes => nodes.map(node => {
    const { x, y, width, height } = node.getBoundingClientRect();
    return { x, y, width, height };
  }));
  expect(rects).toHaveLength(3);
  expect(rects[0].y).toBeLessThan(rects[1].y);
  expect(rects[1].x).toBeLessThan(rects[2].x);
  // The action aligns with the bottom of the amount input, not its field label.
  expect(Math.abs((rects[1].y + rects[1].height) - (rects[2].y + rects[2].height))).toBeLessThan(2);
  expect(await row.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
});


test('Step 2 primary action stays disabled until a valid head and amount are present', async ({ page }) => {
  const dialog = await openPurposeAndAmount(page);
  const next = dialog.getByRole('button', { name: 'Continue to payment channel' });
  const batch = dialog.getByTestId('other-tax-batch');
  await expect(next).toBeDisabled();
  const summary = dialog.locator('.taxpay-modal__body .payment-form-summary');
  await expect(summary).not.toContainText('Complete every selected amount to see the final total.');
  await batch.locator('[data-head-group="Advance Tax"] > summary').click();
  await batch.getByRole('checkbox', { name: /Select 64 —/ }).check();
  await expect(next).toBeDisabled();
  await expect(batch.getByRole('button', { name: /Remove assessment year/ })).toHaveCount(0);
  const amount = batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]');
  await amount.fill('15');
  await expect(next).toBeEnabled();
  await batch.getByRole('button', { name: /Add another assessment year/ }).click();
  await expect(next).toBeDisabled();
  await expect(batch.getByRole('button', { name: /Remove assessment year/ })).toHaveCount(2);
  await batch.getByTestId('other-tax-line').last().locator('input[id^="other-tax-amount"]').fill('35');
  await expect(next).toBeEnabled();
  await batch.getByTestId('other-tax-line').last().getByRole('button', { name: /Remove assessment year/ }).click();
  await expect(next).toBeEnabled();
});
