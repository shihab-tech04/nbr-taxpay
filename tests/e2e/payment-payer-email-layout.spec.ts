import { test, expect, type Locator } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';
import { openTravelTaxFromBanner } from './public-travel-tax-entry';

async function checkPairedFields(dialog: Locator, ids: [string, string, string, string]) {
  const rows = await Promise.all(ids.map(id => dialog.locator(id).locator('..').boundingBox()));
  for (const row of rows) expect(row).not.toBeNull();
  expect(Math.abs(rows[0]!.y - rows[1]!.y)).toBeLessThan(3);
  expect(rows[0]!.x).toBeLessThan(rows[1]!.x);
  expect(Math.abs(rows[2]!.y - rows[3]!.y)).toBeLessThan(3);
  expect(rows[2]!.x).toBeLessThan(rows[3]!.x);
  expect(rows[2]!.y).toBeGreaterThan(rows[0]!.y + 30);
}

test('Other Tax has name/mobile then optional email/reference, with no mobile overflow', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'OTHER_TAX_PAYMENT', 'OTHER');

  const name = dialog.locator('#guest-payer-name');
  const phone = dialog.locator('#guest-phone');
  const email = dialog.locator('#guest-receipt-email');
  const reference = dialog.locator('#guest-notice-ref');
  for (const field of [name, phone, email, reference]) await expect(field).toBeVisible();
  await expect(email).not.toHaveAttribute('required', '');
  await checkPairedFields(dialog, ['#guest-payer-name', '#guest-phone', '#guest-receipt-email', '#guest-notice-ref']);

  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.getByRole('button', { name: /^Search(?: TIN)?$/ }).click();
  await name.fill('Sample Payer');
  await phone.fill('01712345678');
  const next = dialog.getByRole('button', { name: 'Continue to purpose & amount' });
  await expect(next).toBeEnabled();
  await email.fill('invalid-address');
  await expect(next).toBeDisabled();
  await email.fill('  payer+receipt@example.com  ');
  await expect(next).toBeEnabled();
  await email.fill('');
  await expect(next).toBeEnabled();

  await page.setViewportSize({ width: 375, height: 812 });
  const rows = await Promise.all([name, phone, email, reference].map(field => field.locator('..').boundingBox()));
  for (let i = 1; i < rows.length; i += 1) expect(rows[i]!.y).toBeGreaterThan(rows[i - 1]!.y);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test('every guest TaxPay service shares the same contact field layout', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280');
  await page.goto('/');
  await page.getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await enterTaxPayService(dialog, 'TAX_WITH_RETURN', 'OTHER');
  await checkPairedFields(dialog, ['#guest-payer-name', '#guest-phone', '#guest-receipt-email', '#guest-notice-ref']);
});

test('Travel Tax offers optional email and aligns passenger/mobile on desktop', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280');
  await page.goto('/');
  await openTravelTaxFromBanner(page);
  const dialog = page.getByRole('dialog', { name: 'Travel tax' });
  await dialog.locator('#travel-tax-route-0').check();
  await dialog.getByRole('button', { name: 'Continue to passenger details' }).click();
  const email = dialog.locator('#travel-receipt-email');
  await expect(email).toBeVisible();
  await checkPairedFields(dialog, ['#travel-passenger-name', '#travel-mobile', '#travel-receipt-email', '#travel-departure-date']);
  await dialog.locator('#travel-passenger-name').fill('SAMPLE TRAVELLER');
  await dialog.locator('#travel-passport').fill('TRAVEL123');
  await dialog.locator('#travel-mobile').fill('01712345678');
  await dialog.locator('#travel-departure-date').fill('2026-11-10');
  await email.fill('not-an-email');
  await dialog.getByRole('button', { name: 'Continue to review' }).click();
  await expect(dialog.getByText('Enter a valid email address or leave it blank.')).toBeVisible();
  await email.fill('');
  await dialog.getByRole('button', { name: 'Continue to review' }).click();
  await expect(dialog.getByRole('button', { name: 'Pay online' })).toBeVisible();
});
