import {expect,test} from '@playwright/test';
import {enterTaxPayService} from './pay-tax-entry-helper';

/** M04 UI acceptance: inspect real existing form, no mock settlement or hosted write. */
test('M04 guest third-party Return preserves the one-head/year selection through Back and recovery',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog,'TAX_WITH_RETURN','OTHER');
  await dialog.locator('#guest-tin').fill('444444444444');
  await dialog.getByRole('button',{name:/^Search(?: TIN)?$/}).click();
  await dialog.locator('#guest-payer-name').fill('Independent payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();

  await expect(dialog.locator('#guest-assessment-year')).toHaveCount(1);
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
  await expect(dialog.locator('#guest-head-search')).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:/Add another taxpayer/})).toHaveCount(0);
  await dialog.locator('#guest-assessment-year').selectOption('2025-26');
  await dialog.getByRole('radio',{name:/Person other than company/}).check();
  await dialog.locator('#guest-tax-amount').fill('1250.75');
  await dialog.getByRole('button',{name:'Continue to payment channel'}).click();
  await expect(dialog.locator('.tax-service-choice__progress [aria-current="step"]'))
    .toHaveAttribute('aria-label','3. Payment channel');
  await expect(dialog).toContainText('2025-26');

  // Back edits the same approved form. Never convert Return to a batch.
  await dialog.locator('.taxpay-modal__back').click();
  await expect(dialog.locator('#guest-assessment-year')).toHaveValue('2025-26');
  await expect(dialog.locator('#guest-tax-amount')).toHaveValue('1250.75');
  await dialog.locator('#guest-assessment-year').selectOption('2026-27');
  await dialog.getByRole('button',{name:'Continue to payment channel'}).click();
  await expect(dialog).toContainText('2026-27');
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
});

test('M04 self-paid Return entry never exposes a multi-beneficiary or combined tax composer',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog,'TAX_WITH_RETURN','SELF');
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.locator('#guest-assessment-year')).toHaveCount(1);
  await expect(dialog.locator('#guest-head-search')).toHaveCount(0);
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:/Add another taxpayer/})).toHaveCount(0);
  await expect(dialog.locator('#guest-tax-amount')).toBeVisible();
  await expect(dialog.locator('#guest-assessment-year')).toHaveValue('2026-27');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-
    document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
