import { expect, test } from '@playwright/test';

test('All Tax Payments walk-in uses typed demo taxpayer profiles and one shared head composer', async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const modal=page.getByRole('dialog',{name:'Pay Tax'});
  await modal.getByRole('button',{name:'Walk-in Payment'}).click();

  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
  await expect(modal.locator('#guest-phone')).toHaveCount(0);
  await expect(modal.locator('#guest-payment-remarks')).toHaveCount(0);
  await modal.locator('#guest-tin').fill('222222222222');
  await modal.locator('.taxpayer-tin-lookup__search').first().click();
  await modal.getByRole('button',{name:'Add taxpayer'}).first().click();
  await expect(modal.locator('#tax-type-primary')).toHaveValue('NON_COMPANY');

  await modal.getByRole('button',{name:'Add another taxpayer'}).click();
  const another=modal.getByTestId('other-tax-taxpayer').first();
  await another.locator('input[id^="other-tax-tin-"]').fill('333333333333');
  await another.locator('.taxpayer-tin-lookup__search').click();
  await another.getByRole('button',{name:'Add taxpayer'}).click();
  const secondType=modal.locator('select[id^="tax-type-"]').last();
  await expect(secondType).toHaveValue('COMPANY');

  await modal.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Payment Head');
  await expect(modal.getByRole('progressbar',{name:'Payment progress'})).toHaveAttribute('aria-valuemax','3');
  await expect(modal.getByTestId('other-tax-batch')).toBeVisible();
  const modes=modal.locator('input[name="unified-payment-mode"]');
  await expect(modes).toHaveCount(2);
  await expect(modes.first()).toBeChecked();
  await modes.last().check();
  await expect(modal.getByTestId('other-tax-batch')).toBeVisible();
  await modes.first().check();
  await expect(modal.getByTestId('other-tax-batch')).toBeVisible();
});
