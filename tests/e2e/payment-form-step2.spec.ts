import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

// The current Other Tax v11 UX is the five-group composer for both payer
// relationships. These assertions replace outdated selectors for the retired
// flat head list without dropping responsive, amount, or safety coverage.
async function openOtherTax(page: import('@playwright/test').Page, payer: 'SELF' | 'OTHER' = 'SELF') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', payer);
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-payer-name').fill('Example payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  return dialog;
}
async function openHeads(dialog: import('@playwright/test').Locator, name: string) {
  const group = dialog.locator('[data-head-group="' + name + '"]');
  await group.locator('summary').click();
  return group.locator('input[type="checkbox"]:not(:disabled)');
}

test('mobile service gate and four payment steps remain compact and usable', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-1280', 'Mobile regression at 320px and 375px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const dialog = await openOtherTax(page);
  const footer = dialog.locator('.taxpay-modal__footer');
  const progress = dialog.locator('.tax-service-choice__progress');
  await expect(progress.locator('li')).toHaveCount(4);
  await expect(progress.locator('[aria-current="step"]')).toHaveAttribute('aria-label', '2. Purpose & amount');
  await expect(dialog.getByTestId('other-tax-batch').locator('[data-head-group]')).toHaveCount(5);
  await expect(dialog.getByTestId('other-tax-batch').locator('[data-head-group="Tax with Return"]')).toHaveCount(0);
  await expect(footer.getByRole('button')).toHaveCount(2);
  const before = await footer.getByRole('button', { name: 'Back', exact: true }).boundingBox();
  const next = await footer.getByRole('button', { name: 'Continue to payment channel' }).boundingBox();
  expect(before).not.toBeNull();
  expect(next).not.toBeNull();
  expect(Math.abs(before!.y - next!.y)).toBeLessThan(2);
  expect(before!.x + before!.width).toBeLessThan(next!.x);
  expect(next!.x + next!.width).toBeLessThanOrEqual((page.viewportSize()?.width || 0) + 1);
  expect(await dialog.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  const group = await openHeads(dialog, 'Advance Tax');
  await group.first().check();
  const amount = dialog.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]');
  await amount.fill('2100');
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('2,100');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(progress.locator('[aria-current="step"]')).toHaveAttribute('aria-label', '3. Payment channel');
  await footer.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(amount).toHaveValue('2100');
  await footer.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(progress.locator('[aria-current="step"]')).toHaveAttribute('aria-label', '1. Taxpayer details');
});

test('Step 2 guest form groups inputs and recalculates the right-hand summary', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Two-column geometry on desktop');
  const originalUrl = page.url();
  const dialog = await openOtherTax(page);
  const sections = dialog.locator('.payment-form-section');
  const summary = dialog.locator('.payment-form-summary');
  await expect(sections).toHaveCount(1);
  await expect(summary).toHaveCount(1);
  await expect(summary).toContainText('Payment calculation');
  await expect(dialog.getByTestId('other-tax-head-catalogue')).toBeVisible();
  await expect(dialog.getByText('Income tax type', { exact: true })).toHaveCount(0);
  const columns = await dialog.locator('.payment-flow-embedded__content').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
  const choices = await openHeads(dialog, 'Advance Tax');
  await choices.first().check();
  const amount = dialog.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]');
  await amount.fill('21875');
  await expect(summary.locator('.payment-form-summary__total')).toContainText('21,875');
  await amount.fill('12000');
  await expect(summary.locator('.payment-form-summary__total')).toContainText('12,000');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  await expect(summary.locator('.payment-form-summary__total')).toHaveText('BDT 12,000');
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm each taxpayer TIN/ }).check();
  await expect(dialog.getByRole('button', { name: /Pay BDT 12,000/ })).toBeDisabled();
  await expect(dialog.getByRole('heading', { name: 'Payment process complete' })).toHaveCount(0);
  expect(page.url()).not.toContain('action=taxpayer_home');
  void originalUrl;
});

test('single-head return service and grouped Other Tax both preserve amount precision', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Desktop amount allocation layout');
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN', 'OTHER');
  await dialog.getByRole('button', { name: 'Continue without signing in' }).click();
  await dialog.locator('#guest-tin').fill('444444444444');
  await dialog.locator('#guest-payer-name').fill('Test Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(dialog.locator('#guest-tax-amount')).toBeVisible();
  await expect(dialog.locator('.payment-form-summary__rows')).toContainText('Section 173 (on-time) / 174 (late filing)');
  await dialog.locator('#guest-tax-amount').fill('1000');
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('1,000');
  await dialog.getByRole('button', { name: 'Close payment services' }).click();
  const own = await openOtherTax(page);
  const group = await openHeads(own, 'Advance Tax');
  await group.nth(0).check();
  await group.nth(1).check();
  const lines = own.getByTestId('other-tax-line');
  await expect(lines).toHaveCount(2);
  await lines.nth(0).locator('input[id^="other-tax-amount"]').fill('1000');
  await lines.nth(1).locator('input[id^="other-tax-amount"]').fill('300');
  await expect(own.locator('.payment-form-summary__total')).toContainText('1,300');
  const widths = await lines.evaluateAll(elements => elements.map(el => el.getBoundingClientRect().width));
  expect(widths).toHaveLength(2);
  expect(Math.abs(widths[0] - widths[1])).toBeLessThan(2);
});

test('four and five selected Other Tax heads stay readable on desktop and mobile', async ({ page }) => {
  const dialog = await openOtherTax(page);
  const checkbox = await openHeads(dialog, 'Penalty');
  const eligible = await checkbox.count();
  expect(eligible).toBeGreaterThanOrEqual(5);
  for (let index = 0; index < 5; index++) await checkbox.nth(index).check();
  const lines = dialog.getByTestId('other-tax-line');
  await expect(lines).toHaveCount(5);
  const geometries = await lines.evaluateAll(elements => elements.map(el => {
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width };
  }));
  expect(geometries.every(rect => rect.width > 0)).toBe(true);
  expect(geometries.every((rect, index) => index === 0 || rect.y > geometries[index - 1].y)).toBe(true);
  expect(await dialog.locator('.taxpay-modal__body').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  for (let index = 0; index < 5; index++) {
    await lines.nth(index).locator('input[id^="other-tax-amount"]').fill(String((index + 1) * 100));
  }
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('1,500');
});

test('multiple searchable heads keep separate amounts but never create a fabricated combined challan', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Financial allocation and safety regression');
  const dialog = await openOtherTax(page);
  const head = await openHeads(dialog, 'Advance Tax');
  await head.nth(0).check();
  await head.nth(1).check();
  const lines = dialog.getByTestId('other-tax-line');
  await lines.nth(0).locator('input[id^="other-tax-amount"]').fill('1200');
  await lines.nth(1).locator('input[id^="other-tax-amount"]').fill('300');
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('1,500');
  await dialog.locator('#other-tax-head-filter').fill('nonexistent-economic-code');
  await expect(dialog.getByTestId('other-tax-head-catalogue')).toContainText('No matching payment head');
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('1,500');
  await dialog.locator('#other-tax-head-filter').fill('');
  await expect(lines).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(dialog.locator('.payment-form-summary__total')).toContainText('1,500');
  await expect(dialog.getByText(/Batch settlement is reserved for the future A-Challan integration/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm each taxpayer TIN/ }).check();
  await expect(dialog.getByRole('button', { name: /Pay BDT 1,500/ })).toBeDisabled();
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
});

test('mobile return payment uses one fixed head and focuses inline validation errors', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-375', 'Focused mobile payment validation');
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'TAX_WITH_RETURN');
  await payment.getByRole('button', { name: 'Continue without signing in' }).click();

  await expect(payment.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__selected-service')).toContainText('My own tax');
  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.locator('#guest-tin')).toBeFocused();
  await expect(payment.getByRole('alert')).toContainText('12-digit');
  await payment.locator('#guest-tin').fill('123456789012');
  await payment.locator('#guest-phone').fill('01712345678');
  await payment.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  await expect(payment.locator('.payment-head-single')).toHaveCount(0);
  await expect(payment.locator('.payment-form-section').last()).toContainText('Enter the amount from your return');
  await expect(payment.locator('.payment-form-section').last()).toContainText('See the payment summary for the applicable sections');
  await expect(payment.locator('.payment-form-summary__rows')).toContainText('Section 173 (on-time) / 174 (late filing)');
  await expect(payment.locator('.payment-form-summary__rows')).not.toContainText('74 —');
  await expect(payment.locator('#guest-head-search')).toHaveCount(0);

  await payment.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(payment.getByRole('alert')).toContainText('Choose the income tax type');
  await expect(payment.getByRole('radio', { name: /Person other than company/ })).toBeFocused();
  await payment.getByRole('radio', { name: /Person other than company/ }).check();
  await expect(payment.locator('.payment-head-single input[type="checkbox"]')).toHaveCount(0);
  await expect(payment.locator('#guest-tax-amount')).toBeVisible();
  await payment.locator('#guest-tax-amount').fill('-5');
  await payment.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(payment.getByRole('alert')).toContainText('greater than zero');
  await expect(payment.locator('#guest-tax-amount')).toBeFocused();
  await payment.locator('#guest-tax-amount').fill('1250.75');
  await payment.getByRole('button', { name: 'Continue to payment channel' }).click();
  await expect(payment.locator('.tax-service-choice__progress [aria-current="step"]')).toHaveAttribute('aria-label', '3. Payment channel');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(376);
});

test('Travel tax form applies exact v11 journey rates and age bands', async ({ page }) => {
  await page.goto('/?action=travel');
  const travel = page.locator('.travel-flow');
  const summary = travel.locator('.travel-flow__total');
  await expect(travel.locator('#travel-tax-route-results input[type="radio"]')).toHaveCount(6);
  await travel.locator('#travel-tax-route-1').check();
  await expect(summary).toContainText('2,000');
  await travel.getByRole('button', { name: 'Continue to passenger details' }).click();
  await travel.getByLabel('Passenger age').selectOption('CHILD');
  await expect(summary).toContainText('1,000');
  await travel.getByLabel('Passenger age').selectOption('UNDER5');
  await expect(summary).toContainText('0');
  await travel.getByLabel('Passenger age').selectOption('ADULT');
  await expect(summary).toContainText('2,000');
  await travel.getByLabel('Passenger name').fill('SAMPLE TRAVELLER');
  await travel.getByLabel('Passport number').fill('FAKE002');
  await travel.getByLabel('Mobile number for receipt').fill('01712345678');
  await travel.getByLabel('Travel date').fill('2026-10-25');
  await travel.getByRole('button', { name: 'Continue to review' }).click();
  await expect(travel.getByRole('heading', { name: 'Review travel details' })).toBeVisible();
});
