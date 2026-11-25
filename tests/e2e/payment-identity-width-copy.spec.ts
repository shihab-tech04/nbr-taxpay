import { expect, test, type Locator } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

async function expectFillsParent(input: Locator, container: Locator) {
  const [fieldBox, parentBox] = await Promise.all([input.boundingBox(), container.boundingBox()]);
  expect(fieldBox, 'editable field has a visible box').not.toBeNull();
  expect(parentBox, 'field wrapper has a visible box').not.toBeNull();
  // Allow subpixel rounding and the control's border while still requiring full cell coverage.
  expect(fieldBox!.width).toBeGreaterThanOrEqual(parentBox!.width - 4);
}

test('self payment uses full-width name, receipt fields and accurate singular heading', async ({ page }) => {
  await page.goto('/?action=landing');
  await openLegacyTaxServiceChoice(page);
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'OTHER_TAX', 'SELF');

  // The shared header supplies the service and payer context once.
  // Keep the single progress indicator accessible without repeated visual copy.
  await expect(payment.locator('.tax-service-choice__selected-service')).toHaveCount(0);
  await expect(payment.locator('.tax-service-choice__eyebrow')).toHaveCount(0);
  await expect(payment.locator('.taxpay-modal__subtitle')).toContainText('My Tax Liability');
  await expect(payment.locator('.taxpay-modal__progress')).toHaveAttribute('aria-valuenow', '1');
  await expect(payment.getByRole('heading', { name: 'Taxpayer information' })).toBeVisible();
  await expect(payment.getByText('Taxpayers in this payment')).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  const card = payment.getByTestId('other-tax-primary-taxpayer');
  const lookup = card.getByTestId('shared-taxpayer-tin-lookup');
  await expectFillsParent(lookup.locator('#other-tax-primary-name'), lookup.locator('.taxpayer-tin-lookup__field').last());
  const row = lookup.locator('.taxpayer-tin-lookup__search-row');
  const [tin, rowBox] = await Promise.all([lookup.locator('#guest-tin').boundingBox(), row.boundingBox()]);
  expect(tin).not.toBeNull();
  expect(rowBox).not.toBeNull();
  expect(tin!.width).toBeGreaterThan(rowBox!.width * (page.viewportSize()!.width <= 420 ? 0.9 : 0.65));
  for (const id of ['guest-phone', 'guest-notice-ref', 'guest-receipt-email']) {
    const input = payment.locator('#' + id);
    await expectFillsParent(input, input.locator('xpath=..'));
  }
  await lookup.locator('#guest-tin').fill('111111111111');
  await lookup.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(lookup.locator('#other-tax-primary-name')).toHaveValue('User 1');
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
});

test('facilitator payer and taxpayer rows fill their grid cell without changing add-taxpayer rules', async ({ page }) => {
  await page.goto('/?action=landing');
  await openLegacyTaxServiceChoice(page);
  const payment = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(payment, 'OTHER_TAX', 'OTHER');

  await expect(payment.getByRole('heading', { name: 'Payer details', exact: true })).toBeVisible();
  await expect(payment.getByRole('heading', { name: 'Taxpayers', exact: true })).toBeVisible();
  const fields = payment.locator('.payment-flow-embedded__identity .payment-identity__receipt-row');
  await expect(fields).toHaveCount(1);
  for (const id of ['guest-payer-name', 'guest-phone', 'guest-notice-ref', 'guest-receipt-email']) {
    const input = payment.locator('#' + id);
    await expectFillsParent(input, input.locator('xpath=..'));
  }
  const lookup = payment.getByTestId('other-tax-primary-taxpayer').getByTestId('shared-taxpayer-tin-lookup');
  await expectFillsParent(lookup.locator('#other-tax-primary-name'), lookup.locator('.taxpayer-tin-lookup__field').last());
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await lookup.locator('#guest-tin').fill('111111111111');
  await lookup.getByRole('button', { name: 'Search', exact: true }).click();
  await payment.getByTestId('other-tax-primary-taxpayer').getByRole('button', { name: 'Add taxpayer' }).click();
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
});
