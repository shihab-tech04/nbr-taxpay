import { expect, test } from '@playwright/test';

test('Step 2 guest form groups inputs and recalculates the right-hand summary', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Two-column geometry on desktop');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const originalUrl = page.url();
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await chooser.getByRole('button', { name: /Advance Tax/ }).click();
  await chooser.getByRole('button', { name: /Continue/ }).click();

  const sections = chooser.locator('.payment-form-section');
  const summary = chooser.locator('.payment-form-summary');
  await expect(sections).toHaveCount(4);
  await expect(summary).toHaveCount(1);
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Advance');
  const columns = await chooser.locator('.payment-flow-embedded__content').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);

  const relationship = sections.first();
  await relationship.locator('summary').click();
  await expect(relationship).not.toHaveAttribute('open');
  await relationship.locator('summary').click();
  await expect(relationship).toHaveAttribute('open');

  await page.locator('#guest-tin').fill('123456789012');
  await page.locator('#guest-phone').fill('01712345678');
  await page.locator('#guest-tax-amount').fill('21875');
  await expect(page.locator('.payment-form-summary__total')).toContainText('21,875');
  await page.locator('#guest-tax-amount').fill('12000');
  await page.locator('#guest-penalty-amount').fill('450');
  await expect(page.locator('.payment-form-summary__total')).toContainText('12,450');
  await chooser.getByRole('button', { name: /Continue to Review & Pay/ }).click();
  await expect(chooser.getByText('Step 3 of 4')).toBeVisible();
  await expect(chooser.getByText('Payment summary', { exact: true })).toBeVisible();
  await expect(chooser.getByText('BDT 12,450', { exact: true })).toBeVisible();
  await chooser.getByRole('button', { name: 'Online method preview' }).click();
  await chooser.getByRole('radio', { name: 'bKash' }).check();
  await chooser.getByRole('checkbox', { name: /I checked the TIN/ }).check();
  await chooser.getByRole('button', { name: 'Prepare payment preview' }).click();
  await expect(chooser.getByText('Step 4 of 4')).toBeVisible();
  await expect(chooser.getByTestId('payment-lifecycle').getByText('SIMULATION_NOT_SENT')).toBeVisible({ timeout: 12000 });
  await expect(chooser.getByRole('heading', { name: 'Payment preview prepared' })).toBeVisible();
  await expect(chooser.getByRole('heading', { name: 'TaxPay — Receipt details' })).toBeVisible();
  await expect(chooser.getByText('No payment request sent')).toBeVisible();
  await expect(chooser.getByText(/PREVIEW-\d{4}-PAY-/)).toBeVisible();
  await expect(chooser.getByTestId('payment-lifecycle').getByText(/^(CREDITED|TREASURY_SETTLED|ACS_REFERENCE_CREATED)$/)).toHaveCount(0);
  expect(page.url()).toBe(originalUrl);
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
  await travel.getByLabel('Passenger name (as in passport)').fill('SAMPLE TRAVELLER');
  await travel.getByLabel('Passport reference').fill('FAKE002');
  await travel.getByLabel('Mobile number for receipt').fill('01712345678');
  await travel.getByRole('button', { name: 'Continue to review' }).click();
  await expect(travel.getByRole('heading', { name: 'Review travel details' })).toBeVisible();
});
