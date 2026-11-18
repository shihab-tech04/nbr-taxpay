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
  // Reuse the fixed service-choice cards; no duplicate Pay Tax/Other Tax radios.
  await expect(modal.locator('input[name="unified-payment-mode"]')).toHaveCount(0);
  const returnChoice = modal.locator('[data-unified-tax-service="TAX_WITH_RETURN"]');
  const otherChoice = modal.locator('[data-unified-tax-service="OTHER_TAX_PAYMENT"]');
  await expect(returnChoice).toBeVisible();
  await expect(returnChoice).toBeEnabled();
  await expect(otherChoice).toHaveAttribute('aria-pressed', 'true');
  await returnChoice.click();
  await expect(modal.getByTestId('unified-return-eligibility')).toContainText('one taxpayer');
  await expect(otherChoice).toHaveAttribute('aria-pressed', 'true');
  await expect(modal.getByTestId('other-tax-batch')).toBeVisible();
});


test('a single taxpayer can select Tax with Return and switch back without altering the original Pay Tax journey', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await dialog.getByRole('button', { name: 'Walk-in Payment' }).click();
  await dialog.locator('#guest-tin').fill('222222222222');
  await dialog.locator('.taxpayer-tin-lookup__search').first().click();
  await dialog.getByRole('button', { name: 'Add taxpayer' }).first().click();
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const returnChoice = dialog.locator('[data-unified-tax-service="TAX_WITH_RETURN"]');
  await expect(returnChoice).toBeVisible();
  await returnChoice.click();
  await expect(returnChoice).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
  await expect(dialog.locator('#guest-assessment-year')).toBeVisible();
  await expect(dialog.locator('#guest-amount')).toBeVisible();
  await dialog.locator('[data-unified-tax-service="OTHER_TAX_PAYMENT"]').click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
  await expect(dialog.locator('[data-unified-tax-service="OTHER_TAX_PAYMENT"]')).toHaveAttribute('aria-pressed', 'true');
});

test('desktop Step 1 unified calculation column fills the taxpayer editor height', async ({ page }) => {
  await page.setViewportSize({width:1280,height:860});
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await dialog.getByRole('button',{name:'Walk-in Payment'}).click();
  const geometry = await dialog.evaluate(node => {
    const left=node.querySelector<HTMLElement>('.payment-flow-embedded__identity > .payment-form-layout__sections');
    const right=node.querySelector<HTMLElement>('.payment-flow-embedded__identity > .payment-form-summary');
    if (!left || !right) return null;
    const l=left.getBoundingClientRect(),r=right.getBoundingClientRect();
    return {leftBottom:l.bottom,rightBottom:r.bottom,leftX:l.x,rightX:r.x,width:r.width};
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.rightBottom).toBeGreaterThanOrEqual(geometry!.leftBottom-2);
  expect(geometry!.width).toBeGreaterThan(240);
});
