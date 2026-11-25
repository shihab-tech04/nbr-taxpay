import {test,expect} from '@playwright/test';

/** Exact source: Sohojkor_v5_Single_Primary_Action_Interactive.html (original 147,876 bytes).
 * Scope: parallel All Tax Payments ONLY. This is intentionally not a pixel-certification.
 * The newly approved six-size typography contract supersedes the historical
 * 12/14px ACTION TEXT ONLY; all original geometry, flow and calculation gates remain.
 */
test('unified v5 mobile footer has one primary action and preserves calculation placement',async({page},info)=>{
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
  await expect(walkIn).toHaveCSS('font-size','16px');
  await expect(walkIn).toHaveCSS('font-weight','700');
  await expect(signIn).toHaveCSS('min-height','48px');
  await expect(signIn).toHaveCSS('border-radius','9px');
  await expect(signIn).toHaveCSS('font-size','16px');
  await walkIn.click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
  await expect(dialog.locator('.tax-service-choice__eyebrow')).toHaveCount(0);
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  // On 320px screens the second TIN row must target digit 7, never digit 1.
  const tinInput=dialog.getByTestId('unified-tin-input');
  const tinCells=dialog.getByTestId('unified-v5-tin-blocks').locator(':scope > span');
  await expect(tinCells).toHaveCount(12);
  await expect(tinInput).toHaveAttribute('inputmode','numeric');
  for (const [digit,replacement,expected] of [
    [6,'3','222222322222'],
    [2,'8','228222322222'],
  ] as const) {
    const cell=await tinCells.nth(digit).boundingBox();
    expect(cell).not.toBeNull();
    await page.mouse.click(cell!.x+cell!.width/2,cell!.y+cell!.height/2);
    await expect(tinCells.nth(digit)).toHaveClass(/is-active/);
    await page.keyboard.type(replacement);
    await expect(tinInput).toHaveValue(expected);
  }
  await tinInput.fill('222222222222');
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
  const firstActionsBox=await footer.boundingBox();
  expect(firstActionsBox).not.toBeNull();
  expect(Math.abs(nextBox!.width-firstActionsBox!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(nextBox!.x-firstActionsBox!.x)).toBeLessThanOrEqual(2);
  await expect(toHeads).toHaveCSS('font-size','16px');
  await expect(toHeads).toHaveCSS('border-radius','9px');
  await expect(toHeads).toHaveCSS('background-color','rgb(45, 94, 172)');
  await toHeads.click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
  await expect(dialog.getByTestId('unified-v5-return-group')).toHaveCount(1);
  await expect(dialog.getByRole('heading',{name:'Which tax would you like to pay?'})).toHaveCount(0);
  const mobileCalculation=dialog.getByTestId('mobile-payment-calculation');
  await expect(mobileCalculation).toBeVisible();
  await expect(mobileCalculation.getByTestId('mobile-payment-calculation-toggle')).toContainText('Payment calculation');
  const batch=dialog.getByTestId('other-tax-batch');
  // PDF p.1/p.8: mobile head editor must not repeat a second calculation below the fold.
  await expect(batch.locator(':scope > .payment-form-summary')).toHaveCount(0);
  await mobileCalculation.getByTestId('mobile-payment-calculation-toggle').click();
  await expect(mobileCalculation.getByTestId('mobile-payment-calculation-details')).toContainText('Payment total');
  // Original v5 active taxpayer tab: #2d5eac, not the legacy product blue.
  const selectedTab=batch.getByTestId('other-tax-taxpayer-tabs').locator('button[aria-pressed="true"]');
  await expect(selectedTab).toHaveCount(1);
  await expect(selectedTab).toHaveCSS('background-color','rgb(45, 94, 172)');
  const selectMenu=batch.getByTestId('other-tax-selection-menu').locator('summary');
  await expect(selectMenu).toContainText('Select');
  await expect(mobileCalculation.getByTestId('v5-compact-taxpayer-summary')).toBeVisible();
  await mobileCalculation.getByTestId('mobile-payment-calculation-toggle').click();
  await dialog.screenshot({path:`test-results/sohojkor-v5-candidate-stage2-mobile-${page.viewportSize()!.width}.png`});
  await expect(dialog.getByRole('button',{name:'Copy TIN'})).toHaveCount(0);
  const continueButton=dialog.getByRole('button',{name:'Continue to Final Preview'});
  await expect(continueButton.locator('.payment-flow-embedded__action-long')).toBeVisible();
  await expect(continueButton.locator('.payment-flow-embedded__action-short')).toBeHidden();
  await expect(footer.getByRole('button',{name:'Back'})).toHaveCount(0);
  await expect(footer.getByRole('button')).toHaveCount(1);
  const step2Next=await continueButton.boundingBox();
  expect(step2Next).not.toBeNull();
  const step2FooterBox=await footer.boundingBox();
  expect(step2FooterBox).not.toBeNull();
  expect(Math.abs(step2Next!.width-step2FooterBox!.width)).toBeLessThanOrEqual(2);
  await dialog.locator('.taxpay-modal__back').click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
  await dialog.getByRole('button',{name:'Continue to Payment Head'}).click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
  await expect(continueButton).toHaveCSS('font-size','16px');
  // Review is deliberately disabled before a valid head and positive amount exist.
  await expect(continueButton).toBeDisabled();
  const hasOverflow=await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+2);
  expect(hasOverflow).toBe(false);
});

test('unified v5 Final Preview stacks rows and retains only the payment CTA',async({page},info)=>{
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
  await expect(walkIn).toHaveCSS('font-size','16px');
  await expect(walkIn).toHaveCSS('font-weight','700');
  await expect(signIn).toHaveCSS('min-height','48px');
  await expect(signIn).toHaveCSS('border-radius','9px');
  await expect(signIn).toHaveCSS('font-size','16px');
  await walkIn.click();
  await dialog.getByTestId('unified-tin-input').fill('222222222222');
  await dialog.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await dialog.getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.getByRole('button',{name:'Continue to Payment Head'}).click();
  const batch=dialog.getByTestId('other-tax-batch');
  const returnGroup=batch.getByTestId('unified-v5-return-group');
  await expect(returnGroup).toHaveAttribute('data-head-group','Tax with Return');
  await returnGroup.locator('summary').click();
  await batch.getByTestId('unified-v5-return-checkbox').check();
  await expect(returnGroup.getByTestId('other-tax-line')).toHaveCount(1);
  await batch.getByTestId('unified-v5-return-amount').fill('3500');
  // PDF p.1: fixed mobile footer shows a live total and expandable allocation details.
  const footerCalculation=dialog.getByTestId('mobile-payment-calculation');
  await expect(footerCalculation).toBeVisible();
  await expect(footerCalculation.getByTestId('mobile-payment-calculation-toggle')).toContainText('3,500');
  await footerCalculation.getByTestId('mobile-payment-calculation-toggle').click();
  await expect(footerCalculation.getByTestId('mobile-payment-calculation-details')).toContainText('3,500');
  await footerCalculation.getByTestId('mobile-payment-calculation-toggle').click();
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
  const pay=footer.getByRole('button',{name:'Make Payment'});
  await expect(footer.getByRole('button',{name:'Back'})).toHaveCount(0);
  await expect(footer.getByRole('button')).toHaveCount(1);
  await expect(pay).toBeVisible();
  const payBox=await pay.boundingBox();
  expect(payBox).not.toBeNull();
  const previewFooterBox=await footer.boundingBox();
  expect(previewFooterBox).not.toBeNull();
  expect(Math.abs(payBox!.width-previewFooterBox!.width)).toBeLessThanOrEqual(2);
  await dialog.locator('.taxpay-modal__back').click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
  await dialog.getByRole('button',{name:'Continue to Final Preview'}).click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Final Preview');
  await expect(pay).toHaveCSS('font-size','16px');
  await dialog.screenshot({path:`test-results/sohojkor-v5-candidate-stage3-mobile-${page.viewportSize()!.width}.png`});
  const excess=await dialog.locator('.taxpay-modal__body').evaluate(el=>el.scrollWidth-el.clientWidth);
  expect(excess).toBeLessThanOrEqual(2);
});
