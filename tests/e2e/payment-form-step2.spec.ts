import { expect, test } from '@playwright/test';

test('Step 2 guest form groups inputs and recalculates the right-hand summary', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Two-column geometry on desktop');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Pay Tax' });
  await chooser.getByRole('button', { name: /Advance Tax/ }).click();
  await chooser.getByRole('button', { name: /Continue/ }).click();

  const sections = page.locator('.payment-form-section');
  const summary = page.locator('.payment-form-summary');
  await expect(sections).toHaveCount(2);
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Advance');
  const columns = await page.locator('.payment-form-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);

  const relationship = sections.first();
  await relationship.locator('summary').click();
  await expect(relationship).not.toHaveAttribute('open');
  await relationship.locator('summary').click();
  await expect(relationship).toHaveAttribute('open');

  await page.locator('#guest-tin').fill('123456789012');
  await page.locator('#guest-phone').fill('01712345678');
  await page.getByRole('button', { name: /Continue to Payment Head/ }).click();
  await expect(page.locator('.payment-form-section')).toHaveCount(2);
  await page.locator('#guest-tax-amount').fill('21875');
  await expect(page.locator('.payment-form-summary__total')).toContainText('21,875');
  await page.locator('#guest-tax-amount').fill('12000');
  await page.locator('#guest-penalty-amount').fill('450');
  await expect(page.locator('.payment-form-summary__total')).toContainText('12,450');
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
  await travel.getByLabel('Passport number (synthetic data only)').fill('FAKE002');
  await travel.getByLabel('Mobile number for receipt').fill('01712345678');
  await travel.getByRole('button', { name: 'Continue to review' }).click();
  await expect(travel.getByRole('heading', { name: 'Review travel details' })).toBeVisible();
});
