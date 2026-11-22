import {test,expect} from '@playwright/test';

/** Exact source: Sohojkor_v5_Single_Primary_Action_Interactive.html (original 147,876 bytes).
 * Scope: parallel All Tax Payments ONLY. This is intentionally not a pixel-certification.
 */
test('approved v5 mobile footer keeps full button labels and original calculation placement',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375' && info.project.name!=='mobile-320','Mobile original-v5 reference');
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  const walkIn=dialog.getByRole('button',{name:'Walk-in Payment'});
  const signIn=dialog.getByRole('button',{name:'Sign In to Pay Tax'});
  const entryFooter=dialog.locator('.taxpay-unified-entry__actions');
  await expect(entryFooter.locator('.taxpay-unified-entry__divider')).toContainText('OR');
  await expect(walkIn).toHaveCSS('min-height','48px');
  await expect(walkIn).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(walkIn).toHaveCSS('color','rgb(38, 92, 166)');
  await expect(walkIn).toHaveCSS('border-color','rgb(199, 216, 238)');
  await expect(walkIn).toHaveCSS('border-radius','9px');
  await expect(walkIn).toHaveCSS('font-size','14px');
  await expect(walkIn).toHaveCSS('font-weight','700');
  await expect(signIn).toHaveCSS('min-height','48px');
  await expect(signIn).toHaveCSS('border-radius','9px');
  await walkIn.click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
  await expect(dialog.locator('.tax-service-choice__eyebrow')).toHaveCount(0);
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  await dialog.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await dialog.getByRole('button',{name:'Add taxpayer'}).click();
  const toHeads=dialog.getByRole('button',{name:'Continue to Payment Head'});
  await expect(toHeads.locator('.payment-flow-embedded__action-long')).toBeVisible();
  await expect(toHeads.locator('.payment-flow-embedded__action-long')).toHaveText('Continue to Payment Head');
  await expect(toHeads.locator('.payment-flow-embedded__action-short')).toBeHidden();
  // The newly approved Walk-in Step 1 has ONE footer CTA, without a
  // redundant Back action. Header back/close and later-stage recovery remain.
  const footer=dialog.locator('.taxpay-modal__footer .payment-flow-embedded__footer-actions');
  await expect(footer.getByRole('button',{name:'Back'})).toHaveCount(0);
  await expect(footer.getByRole('button')).toHaveCount(1);
  const nextBox=await toHeads.boundingBox();
  expect(nextBox).not.toBeNull();
  expect(nextBox!.width).toBeGreaterThan(0);
  await expect(toHeads).toHaveCSS('font-size','12px');
  await expect(toHeads).toHaveCSS('border-radius','9px');
  await expect(toHeads).toHaveCSS('background-color','rgb(45, 94, 172)');
  await toHeads.click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
  await expect(dialog.getByTestId('mobile-payment-calculation')).toHaveCount(0);
  const batch=dialog.getByTestId('other-tax-batch');
  await expect(batch.locator(':scope > .payment-form-summary')).toBeVisible();
  // Original v5 active taxpayer tab: #2d5eac, not the legacy product blue.
  const selectedTab=batch.getByTestId('other-tax-taxpayer-tabs').locator('button[aria-pressed="true"]');
  await expect(selectedTab).toHaveCount(1);
  await expect(selectedTab).toHaveCSS('background-color','rgb(45, 94, 172)');
  const selectMenu=batch.getByTestId('other-tax-selection-menu').locator('summary');
  await expect(selectMenu).toContainText('Select');
  await expect(batch.getByTestId('v5-compact-taxpayer-summary')).toBeVisible();
  await dialog.screenshot({path:`test-results/sohojkor-v5-candidate-stage2-mobile-${page.viewportSize()!.width}.png`});
  await expect(dialog.getByRole('button',{name:'Copy TIN'})).toHaveCount(0);
  const continueButton=dialog.getByRole('button',{name:'Continue to Final Preview'});
  await expect(continueButton.locator('.payment-flow-embedded__action-long')).toBeVisible();
  await expect(continueButton.locator('.payment-flow-embedded__action-short')).toBeHidden();
  const [step2Back,step2Next]=await Promise.all([
    footer.getByRole('button',{name:'Back'}).boundingBox(),continueButton.boundingBox()
  ]);
  expect(step2Back).not.toBeNull();expect(step2Next).not.toBeNull();
  expect(Math.abs(step2Back!.width-step2Next!.width)).toBeLessThanOrEqual(3);
  await expect(continueButton).toHaveCSS('font-size','12px');
  // Review is deliberately disabled before a valid head and positive amount exist.
  await expect(continueButton).toBeDisabled();
  const hasOverflow=await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+2);
  expect(hasOverflow).toBe(false);
});

test('approved v5 Final Preview stacks payment rows on mobile; AY, amount and dual footer remain visible',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375' && info.project.name!=='mobile-320','Original v5 mobile preview reference');
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  const walkIn=dialog.getByRole('button',{name:'Walk-in Payment'});
  const signIn=dialog.getByRole('button',{name:'Sign In to Pay Tax'});
  const entryFooter=dialog.locator('.taxpay-unified-entry__actions');
  await expect(entryFooter.locator('.taxpay-unified-entry__divider')).toContainText('OR');
  await expect(walkIn).toHaveCSS('min-height','48px');
  await expect(walkIn).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(walkIn).toHaveCSS('color','rgb(38, 92, 166)');
  await expect(walkIn).toHaveCSS('border-color','rgb(199, 216, 238)');
  await expect(walkIn).toHaveCSS('border-radius','9px');
  await expect(walkIn).toHaveCSS('font-size','14px');
  await expect(walkIn).toHaveCSS('font-weight','700');
  await expect(signIn).toHaveCSS('min-height','48px');
  await expect(signIn).toHaveCSS('border-radius','9px');
  await walkIn.click();
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  await dialog.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await dialog.getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.getByRole('button',{name:'Continue to Payment Head'}).click();
  const batch=dialog.getByTestId('other-tax-batch');
  await batch.getByTestId('unified-v5-return-checkbox').check();
  await batch.getByTestId('unified-v5-return-amount').fill('3500');
  const next=dialog.getByRole('button',{name:'Continue to Final Preview'});
  await expect(next).toBeEnabled();
  await next.click();

  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Final Preview');
  const table=dialog.locator('.unified-v3-review__table');
  const row=table.locator('tbody tr:not(.unified-v3-review__owner)').first();
  await expect(table.locator('thead')).toBeHidden();
  await expect(table).toHaveCSS('display','block');
  await expect(row).toHaveCSS('display','grid');
  await expect(row.locator('td').nth(1)).toHaveAttribute('data-year-prefix','AY ');
  await expect(row.locator('td').nth(1)).toHaveText('2026-27');
  await expect(row.locator('td').last()).toContainText('3,500');
  const owner=table.locator('tbody tr.unified-v3-review__owner').first();
  await expect(owner.locator('strong')).toContainText('User 2');
  await expect(owner.locator('span')).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Payer and receipt details'})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Copy TIN'})).toHaveCount(0);

  const footer=dialog.locator('.taxpay-modal__footer .payment-flow-embedded__footer-actions');
  const back=footer.getByRole('button',{name:'Back'});
  const pay=footer.getByRole('button',{name:'Make Payment'});
  await expect(back).toBeVisible();
  await expect(pay).toBeVisible();
  const [backBox,payBox]=await Promise.all([back.boundingBox(),pay.boundingBox()]);
  expect(backBox).not.toBeNull();expect(payBox).not.toBeNull();
  expect(Math.abs(backBox!.width-payBox!.width)).toBeLessThanOrEqual(3);
  await expect(pay).toHaveCSS('font-size','12px');
  await dialog.screenshot({path:`test-results/sohojkor-v5-candidate-stage3-mobile-${page.viewportSize()!.width}.png`});
  const excess=await dialog.locator('.taxpay-modal__body').evaluate(el=>el.scrollWidth-el.clientWidth);
  expect(excess).toBeLessThanOrEqual(2);
});
