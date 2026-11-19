import {test,expect} from '@playwright/test';

/** Exact source: Sohojkor_v5_Single_Primary_Action_Interactive.html (original 147,876 bytes).
 * Scope: parallel All Tax Payments ONLY. This is intentionally not a pixel-certification.
 */
test('approved v5 mobile footer keeps full button labels and original calculation placement',async({page},info)=>{
  test.skip(info.project.name!=='mobile-390' && info.project.name!=='mobile-320','Mobile original-v5 reference');
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await dialog.getByRole('button',{name:'Walk-in Payment'}).click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
  await expect(dialog.locator('.tax-service-choice__eyebrow')).toHaveCount(0);
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  await dialog.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await dialog.getByRole('button',{name:'Add taxpayer'}).click();
  const toHeads=dialog.getByRole('button',{name:'Continue to Payment Head'});
  await expect(toHeads.locator('.payment-flow-embedded__action-long')).toBeVisible();
  await expect(toHeads.locator('.payment-flow-embedded__action-long')).toHaveText('Continue to Payment Head');
  await toHeads.click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
  await expect(dialog.getByTestId('mobile-payment-calculation')).toHaveCount(0);
  const batch=dialog.getByTestId('other-tax-batch');
  await expect(batch.locator(':scope > .payment-form-summary')).toBeVisible();
  await expect(batch.getByTestId('v5-compact-taxpayer-summary')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Copy TIN'})).toHaveCount(0);
  const continueButton=dialog.getByRole('button',{name:'Continue to Final Preview'});
  await expect(continueButton.locator('.payment-flow-embedded__action-long')).toBeVisible();
  await expect(continueButton.locator('.payment-flow-embedded__action-short')).toBeHidden();
  // Review is deliberately disabled before a valid head and positive amount exist.
  await expect(continueButton).toBeDisabled();
  const hasOverflow=await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+2);
  expect(hasOverflow).toBe(false);
});
