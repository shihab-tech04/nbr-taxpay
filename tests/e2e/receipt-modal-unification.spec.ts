import { expect, test } from '@playwright/test';

test('public payment status opens in the existing light-shell modal, not the legacy blue page', async ({ page }) => {
  await page.goto('/?action=verify');
  const modal = page.getByRole('dialog', { name: 'Payment status & receipt' });
  await expect(modal).toBeVisible();
  await expect(page.locator('.public-home-header')).toBeVisible();
  await expect(page.locator('.citizen-header')).toHaveCount(0);
  await expect(page.locator('.receipt-lookup--page')).toHaveCount(0);
  await expect(modal.getByRole('textbox', { name: 'Challan, token or transaction reference' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Close modal' })).toBeVisible();
  await expect(modal.locator('.taxpay-modal__footer-close')).toHaveCount(0);
  await modal.getByRole('button', { name: /Use reference:/ }).first().click();
  await expect(modal.locator('.receipt-view--embedded')).toBeVisible();
  await expect(modal.locator('.receipt-view__summary')).toBeVisible();
  await expect(modal.locator('.receipt-view__amount strong')).not.toBeEmpty();
  await expect(modal.locator('.receipt-view__reference-strip')).toBeVisible();
  await expect(modal.locator('.receipt-view__parties')).toBeVisible();
  await expect(modal.locator('.receipt-view__status')).toHaveCount(0);
  await expect(modal.locator('.receipt-view__paper')).not.toContainText('Tax credit recognition');
  await expect(modal.locator('.taxpay-modal__footer .receipt-view__actions')).toBeVisible();
  await expect(modal.locator('.taxpay-modal__body .receipt-view__actions')).toHaveCount(0);
  await expect(modal.locator('.receipt-lookup__form')).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Print receipt' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(modal.locator('.receipt-view__notice')).toHaveCount(0);
  await expect(modal.locator('.receipt-view__paper')).toContainText('Payment record');
  await expect(modal.locator('.receipt-view__paper')).not.toContainText('Demo receipt only');
  await expect(modal.locator('.receipt-view__paper')).not.toContainText('Simulation record');
  await expect(modal.locator('.receipt-view__paper')).not.toContainText('Simulated payment');
  await expect(modal.getByRole('button', { name: 'Back to search' })).toHaveCount(0);
  await expect(modal.locator('.receipt-view__action-group button')).toHaveCount(2);
  await modal.getByRole('button', { name: 'Close modal' }).click();
  await expect(page).toHaveURL(/action=landing/);
});

test('receipt modal uses a readable desktop table, mobile cards, and isolated printing', async ({ page }, testInfo) => {
  await page.goto('/?action=verify');
  const modal = page.getByRole('dialog', { name: 'Payment status & receipt' });
  await modal.getByRole('button', { name: /Use reference:/ }).first().click();
  const receipt = modal.locator('.receipt-view--embedded');
  await expect(receipt).toBeVisible();
  if (testInfo.project.name === 'desktop-1280') {
    await expect(receipt.locator('.receipt-view__table')).toBeVisible();
    await expect(receipt.locator('.receipt-view__cards')).toBeHidden();
  } else {
    await expect(receipt.locator('.receipt-view__cards')).toBeVisible();
    await expect(receipt.locator('.receipt-view__table')).toBeHidden();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.public-home-header')).toBeHidden();
  await expect(receipt.locator('.receipt-view__paper')).toBeVisible();
  await expect(modal.locator('.receipt-view__actions')).toBeHidden();
  await expect(modal.locator('.taxpay-modal__footer')).toBeHidden();
});

test('Bangla receipt lookup stays inside the same modal and keeps the standard close interaction', async ({ page }) => {
  await page.goto('/?action=verify&lang=bn');
  const modal = page.getByRole('dialog', { name: 'পেমেন্টের অবস্থা ও রসিদ' });
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel('চালান, টোকেন বা লেনদেনের রেফারেন্স')).toBeVisible();
  await modal.getByRole('button', { name: 'বন্ধ করুন' }).click();
  await expect(page).toHaveURL(/action=landing/);
});

test('receipt modal has exactly one action footer and a readable reference on each viewport', async ({ page }) => {
  await page.goto('/?action=verify');
  const modal = page.getByRole('dialog', { name: 'Payment status & receipt' });
  await modal.getByRole('button', { name: /Use reference:/ }).first().click();
  await expect(modal.locator('.receipt-view__summary')).toBeVisible();
  await expect(modal.locator('.receipt-view__amount strong')).not.toBeEmpty();
  await expect(modal.locator('.receipt-view__reference-strip')).toBeVisible();
  const footer = modal.locator('.taxpay-modal__footer');
  await expect(footer.getByRole('button', { name: 'Back to search' })).toHaveCount(0);
  await expect(footer.getByRole('button', { name: 'Print receipt' })).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Download' })).toBeVisible();
  await expect(modal.locator('.receipt-view__actions')).toHaveCount(1);
  await expect(modal.locator('.receipt-lookup__back')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await expect(footer.locator('.receipt-view__action-group button')).toHaveCount(2);
  await modal.getByRole('button', { name: 'Close modal' }).click();
  await expect(page).toHaveURL(/action=landing/);
});
