import { expect, test } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

// Preserve both existing entry routes: SELF always one taxpayer, OTHER may
// include additional recipients after the required TIN lookup/confirmation.
test('walk-in self is single taxpayer while facilitator can add another', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  const payment = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment, 'OTHER_TAX', 'SELF');
  const self = payment.getByTestId('other-tax-primary-taxpayer');
  await expect(self).toBeVisible();
  await self.locator('#guest-tin').fill('111111111111');
  await self.locator('.taxpayer-tin-lookup__search').click();
  await expect(self.getByRole('heading', { name: 'Taxpayer Information' })).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
  await expect(payment.getByTestId('other-tax-taxpayer')).toHaveCount(0);
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  const other = payment.getByTestId('other-tax-primary-taxpayer');
  await other.locator('#guest-tin').fill('111111111111');
  await other.locator('.taxpayer-tin-lookup__search').click();
  await other.getByRole('button', { name: 'Add taxpayer' }).click();
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toBeVisible();
});

test('signed-in self has no saved beneficiary or additional taxpayer controls', async ({ page }) => {
  await page.goto('/?action=taxpayer_login');
  const login = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
  await login.getByRole('textbox', { name: 'User ID' }).fill('user1');
  await login.getByLabel('Password', { exact: true }).fill('user1');
  await login.getByRole('button', { name: 'Sign In' }).click();
  await page.goto('/?action=landing&lang=en');
  const payment = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment, 'OTHER_TAX', 'SELF');
  await expect(payment.locator('#signed-in-account-taxpayer-card')).toBeVisible();
  await expect(payment.getByTestId('self-payment-add-beneficiaries')).toHaveCount(0);
  await expect(payment.getByTestId('saved-beneficiary-picker')).toHaveCount(0);
  await expect(payment.getByRole('button', { name: 'Add another taxpayer' })).toHaveCount(0);
});


test('taxpayer TIN and name fields use the full card width in SELF and OTHER paths', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  const payment = await openLegacyTaxServiceChoice(page);
  await enterTaxPayService(payment, 'OTHER_TAX', 'SELF');
  const assertFullWidth = async (card: ReturnType<typeof payment.getByTestId>) => {
    const sizes = await card.evaluate(node => {
      const row = node.querySelector<HTMLElement>('.taxpay-taxpayer-row__fields');
      const lookup = node.querySelector<HTMLElement>('.taxpayer-tin-lookup');
      const search = node.querySelector<HTMLElement>('.taxpayer-tin-lookup__search-row');
      const name = node.querySelector<HTMLElement>('.taxpayer-tin-lookup__field input[id*="name"]');
      if (!row || !lookup || !search || !name) return null;
      return { row: row.getBoundingClientRect().width, lookup: lookup.getBoundingClientRect().width,
        search: search.getBoundingClientRect().width, name: name.getBoundingClientRect().width };
    });
    expect(sizes).not.toBeNull();
    expect(sizes!.lookup).toBeGreaterThan(sizes!.row * .94);
    expect(sizes!.search).toBeGreaterThan(sizes!.lookup * .94);
    expect(sizes!.name).toBeGreaterThan(sizes!.lookup * .94);
  };
  await assertFullWidth(payment.getByTestId('other-tax-primary-taxpayer'));
  const emailWidths = await payment.locator('.payment-identity__receipt-row').first().evaluate(node => {
    const email = node.querySelector<HTMLElement>('#guest-receipt-email');
    return email ? { row: node.getBoundingClientRect().width, email: email.getBoundingClientRect().width } : null;
  });
  expect(emailWidths).not.toBeNull();
  expect(emailWidths!.email).toBeGreaterThan(emailWidths!.row * .94);
  await payment.locator('.taxpay-modal__back').click();
  await payment.locator('[data-payer-relationship="OTHER"]').click();
  await payment.locator('.tax-service-choice__actions').getByRole('button', { name: 'Continue', exact: true }).click();
  const primary = payment.getByTestId('other-tax-primary-taxpayer');
  await assertFullWidth(primary);
  await primary.locator('#guest-tin').fill('111111111111');
  await primary.locator('.taxpayer-tin-lookup__search').click();
  await primary.getByRole('button', { name: 'Add taxpayer' }).click();
  await payment.getByRole('button', { name: 'Add another taxpayer' }).click();
  const additional = payment.getByTestId('other-tax-taxpayer');
  await assertFullWidth(additional);
});
