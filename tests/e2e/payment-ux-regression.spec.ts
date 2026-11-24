import { expect, test, type Page } from '@playwright/test';
import {mockSubmittedPaymentSqlReadback} from './mock-submitted-payment-readback';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

async function beginGuestPayment(page: Page, service: string) {
  await page.goto('/');
  await openLegacyTaxServiceChoice(page);
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  if (service === 'Tax with Return') {
    await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  } else {
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await expect(dialog.locator('#tax-service-other-type')).toHaveCount(0);
  }
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  return dialog;
}

test('payer is required before choosing a payment service and is not asked twice', async ({ page }) => {
  const dialog = await beginGuestPayment(page, 'Tax with Return');
  await expect(dialog.getByRole('radio', { name: 'My tax liability' })).toHaveCount(0);
  await expect(dialog.locator('.payment-form-payer-confirmation')).toHaveCount(0);
  await expect(dialog.locator('.taxpay-modal__subtitle')).toContainText('My Tax Liability');
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
  const next = dialog.getByRole('button', { name: 'Continue to payment channel' });
  await expect(next).toBeDisabled();
  await amounts.nth(1).fill('12214124442.75');
  const expectedTotal = new Intl.NumberFormat('en-IN').format(123336365654.75);
  await expect(dialog.locator('.payment-form-summary__total')).toContainText(expectedTotal);
  // The large number must display precisely but cannot bypass the maximum supported payment.
  await expect(next).toBeDisabled();
  await amounts.first().fill('1000');
  await amounts.nth(1).fill('250.75');
  await expect(next).toBeEnabled();
  await expect(batch.getByTestId('other-tax-validation-summary')).toHaveCount(0);
  await next.click();
  await expect(dialog.getByTestId('payment-review')).toBeVisible();
  await expect(dialog.getByText('Payment summary', { exact: true })).toHaveCount(0);
});

test('online method categories reveal only relevant providers and reset the previous selection', async ({ page }) => {
  // This is a payment-method UI regression: do not depend on a live backend
  // or create a hosted simulated payment during the disconnected CI run.
  // Preserve the full success gate by requiring a mirror acknowledgment.
  await mockSubmittedPaymentSqlReadback(page);
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
  // On mobile, expand the sticky footer to inspect the exact return-law context.
  const disclosure = dialog.getByTestId('mobile-payment-calculation');
  if (await disclosure.count()) {
    await expect(disclosure).not.toHaveAttribute('open', '');
    await disclosure.getByTestId('mobile-payment-calculation-toggle').click();
    await expect(disclosure).toHaveAttribute('open', '');
  }
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
  await dialog.getByRole('button', { name: /Pay ৳ 25,000/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 12000 });
  await expect(dialog.locator('.payment-form-summary')).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Receipt details' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('heading', { name: 'Challan details' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Back to confirmation' }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Receipt details' }).click();
  await expect(dialog.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Print receipt' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close payment services' }).click();
  await expect(dialog).toHaveCount(0);
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
  // On mobile, expand the sticky footer to inspect the exact return-law context.
  const disclosure = dialog.getByTestId('mobile-payment-calculation');
  if (await disclosure.count()) {
    await expect(disclosure).not.toHaveAttribute('open', '');
    await disclosure.getByTestId('mobile-payment-calculation-toggle').click();
    await expect(disclosure).toHaveAttribute('open', '');
  }
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
  // Measure actual payment Step 1 after it mounts, not the taller preceding chooser.
  // Retain the same strict height, overflow, and field-alignment checks.
  await expect(dialog.locator('#guest-tin')).toBeVisible();
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

test('desktop Other Tax taxpayer details stay scrollable above the fixed footer', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Desktop scrolling regression');
  // Same 1225 x 777 desktop height as the reported clipped taxpayer modal.
  await page.setViewportSize({ width: 1225, height: 777 });
  await page.goto('/');
  await openLegacyTaxServiceChoice(page);
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');

  const body = dialog.locator('.taxpay-modal__body');
  const footer = dialog.locator('.taxpay-modal__footer');
  await expect(body).toHaveCSS('overflow-y', 'auto');
  await expect(dialog.locator('#guest-payer-name')).toBeVisible();
  await expect(dialog.getByTestId('other-tax-primary-taxpayer')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Continue to purpose & amount' })).toBeVisible();
  expect(await body.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(50);

  const viewport = await body.boundingBox();
  const footerBefore = await footer.boundingBox();
  expect(viewport).not.toBeNull();
  expect(footerBefore).not.toBeNull();
  await page.mouse.move(viewport!.x + 90, viewport!.y + Math.min(180, viewport!.height / 2));
  await page.mouse.wheel(0, 500);
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(40);

  // The whole form moves, but action footer stays pinned and never overlays
  // the remaining taxpayer controls.
  const footerAfter = await footer.boundingBox();
  expect(footerAfter).not.toBeNull();
  expect(Math.abs(footerAfter!.y - footerBefore!.y)).toBeLessThanOrEqual(2);
  expect(await body.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(2);
  await expect(dialog.getByTestId('other-tax-primary-taxpayer').getByRole('button', { name: /^Search(?: TIN)?$/ })).toBeVisible();
});

test('desktop My Tax Liability calculation rail fills the taxpayer column without trapping scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Desktop calculation-rail regression');
  await page.setViewportSize({ width: 1225, height: 777 });
  await page.goto('/');
  await openLegacyTaxServiceChoice(page);
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'SELF');

  const body = dialog.locator('.taxpay-modal__body');
  const grid = dialog.locator('.payment-flow-embedded__content');
  const summary = dialog.locator('.payment-flow-embedded__identity > .payment-form-summary');
  await expect(summary).toBeVisible();
  await expect(body).toHaveCSS('overflow-y', 'auto');
  await expect(summary).toHaveCSS('position', 'sticky');
  await expect(summary).toHaveCSS('overflow-y', 'visible');

  // The two columns have one continuous background surface even though the
  // calculation card is shorter than the taxpayer form and stays pinned.
  const rail = await grid.evaluate(element => {
    const fill = getComputedStyle(element, '::before');
    const summary = element.querySelector('.payment-flow-embedded__identity > .payment-form-summary');
    return {
      content: fill.content,
      column: fill.gridColumnStart,
      background: fill.backgroundColor,
      rowHeight: element.getBoundingClientRect().height,
      cardHeight: summary?.getBoundingClientRect().height ?? 0,
    };
  });
  expect(rail.content).not.toBe('none');
  expect(rail.column).toBe('2');
  expect(rail.background).toBe('rgb(248, 251, 255)');
  expect(rail.rowHeight).toBeGreaterThan(rail.cardHeight + 40);

  // Wheel events over the short sticky card continue to scroll the modal body,
  // without moving the fixed action footer or creating horizontal overflow.
  // Keep the 777px screenshot rail assertion above, then deliberately shorten
  // the viewport so scrolling is required even for the compact SELF form.
  await page.setViewportSize({ width: 1225, height: 560 });
  await expect.poll(() => body.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(20);
  const footer = await dialog.locator('.taxpay-modal__footer').boundingBox();
  const card = await summary.boundingBox();
  expect(footer).not.toBeNull();
  expect(card).not.toBeNull();
  await page.mouse.move(card!.x + 40, card!.y + 60);
  await page.mouse.wheel(0, 420);
  await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(10);
  const after = await dialog.locator('.taxpay-modal__footer').boundingBox();
  expect(Math.abs(after!.y - footer!.y)).toBeLessThanOrEqual(2);
  expect(await body.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2);
});
