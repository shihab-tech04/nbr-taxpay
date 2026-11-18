import { expect, test } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

async function openOtherTax(page: import('@playwright/test').Page) {
  await page.goto('/?action=landing&lang=en');
  await openLegacyTaxServiceChoice(page);
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog,'OTHER_TAX_PAYMENT','OTHER');
  await dialog.locator('#guest-tin').fill('111111111111');
  await dialog.getByRole('button',{name:/^Search(?: TIN)?$/}).click();
  await dialog.getByTestId('other-tax-primary-taxpayer').getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.locator('#guest-payer-name').fill('Synthetic Payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button',{name:'Add another taxpayer'}).click();
  const second=dialog.getByTestId('other-tax-taxpayer');
  await second.locator('input[id^="other-tax-tin-"]').fill('222222222222');
  await second.getByRole('button',{name:'Search',exact:true}).click();
  await second.getByRole('button',{name:'Add taxpayer'}).click();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
  return dialog;
}

test('locked legacy Other Tax uses original functionality and refined two-column visual design',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  const dialog=await openOtherTax(page);
  const batch=dialog.getByTestId('other-tax-batch');
  const summary=batch.locator(':scope > .payment-form-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveCSS('border-top-width','0px');
  await expect(summary).toHaveCSS('border-radius','0px');
  await expect(summary.locator('.payment-form-summary__heading')).toContainText('Payment calculation');
  await expect(batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button')).toHaveCount(2);
  await expect(dialog.locator('.language-btn')).toHaveCount(0); // Site-level EN/BN, no modal-local switch.
  const group=batch.locator('[data-head-group="Advance Tax"]');
  await group.locator('summary').click();
  await expect(group).toHaveAttribute('open','');
  const expanded=await group.evaluate(el=>({
    border:window.getComputedStyle(el).boxShadow,
    background:window.getComputedStyle(el.querySelector('summary')!).backgroundColor,
  }));
  expect(expanded.border).not.toBe('none');
  expect(expanded.background).toBe('rgb(243, 246, 248)');
  await batch.getByRole('checkbox',{name:/Select 64 —/}).check();
  await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('23');
  await expect(summary.locator('.payment-form-summary__total')).toContainText('23');
  const grouped=summary.getByTestId('grouped-taxpayer-calculation');
  await expect(grouped.locator('details')).toHaveCount(2);
  const first=grouped.locator('details').first();
  await expect(first).toHaveAttribute('open','');
  await expect(first).toHaveCSS('border-top-color','rgb(180, 198, 214)');
  await expect(first.locator('.payment-form-summary__taxpayer-item').first()).toContainText('64');
  const second=grouped.locator('details').nth(1);
  await second.locator('summary').click();
  await expect(second).toHaveAttribute('open','');
  await expect(first).toHaveAttribute('open',''); // Cards expand independently.
  await batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button').nth(1).click();
  await batch.getByRole('checkbox',{name:/Select 68A/}).check();
  await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('45');
  await expect(summary.locator('.payment-form-summary__total')).toContainText('68');
  await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').focus();
  await expect(summary.locator('.payment-form-summary__entry--link[data-active="true"]')).toHaveCount(1);
  await expect(summary.locator('.payment-form-summary__entry--link[data-active="true"]')).toContainText('68A');
  await expect(second).toHaveAttribute('open','');
  // Focusing an editor never forces a closed card to open; its header still signals the matching line.
  await second.locator('summary').click();
  await expect(second).not.toHaveAttribute('open','');
  await expect(second).toHaveCSS('border-top-color','rgb(180, 198, 214)');
  await second.locator('summary').click();
  await expect(grouped.locator('details').first().locator('summary')).toContainText('23');
  await expect(grouped.locator('details').nth(1).locator('summary')).toContainText('45');
  await first.locator('.payment-form-summary__taxpayer-item').first().click();
  await expect(batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button').first()).toHaveAttribute('aria-pressed','true');
  // Head code "64" differs from the internal row ID.
  await expect(batch.getByRole('checkbox',{name:/Select 64 —/}).locator('xpath=ancestor::li[@data-head-row]').locator('input[id^="other-tax-amount"]')).toBeFocused();
  await expect(summary.locator('.payment-form-summary__entry--link[data-active="true"]')).toContainText('64');
  const geometry=await batch.evaluate(el=>{
    const rail=el.querySelector<HTMLElement>(':scope > .payment-form-summary');
    const editor=el.querySelector<HTMLElement>(':scope > .payment-form-layout__sections');
    const modal=el.closest<HTMLElement>('.taxpay-modal');
    return {split:!!rail&&!!editor&&rail.getBoundingClientRect().left>=editor.getBoundingClientRect().right-3,
      overflow:(modal?.scrollWidth||0)>(modal?.clientWidth||0)+2};
  });
  expect(geometry.split).toBe(true);
  expect(geometry.overflow).toBe(false);
  const clear = batch.getByRole('button',{name:'Clear selected'});
  await expect(clear).toBeEnabled();
  await clear.click();
  await expect(summary.locator('.payment-form-summary__total')).toContainText('45');
  await expect(batch.getByRole('checkbox',{name:/Select 64 —/})).not.toBeChecked();
});

for(const width of [390,320]){
  test(`legacy Other Tax ${width}px preserves reachable summary, no overflow or second language switch`,async({page})=>{
    await page.setViewportSize({width,height:844});
    const dialog=await openOtherTax(page);
    const batch=dialog.getByTestId('other-tax-batch');
    await expect(batch).toBeVisible();
    await expect(dialog.locator('.language-btn')).toHaveCount(0);
    const group=batch.locator('[data-head-group="Advance Tax"]');
    await group.locator('summary').click();
    await batch.getByRole('checkbox',{name:/Select 64 —/}).check();
    await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('120');
    const footer=dialog.locator('.taxpay-modal__footer');
    await expect(footer).toBeVisible();
    const mobile=dialog.getByTestId('mobile-payment-calculation');
    if(await mobile.count()){
      await mobile.getByTestId('mobile-payment-calculation-toggle').click();
      await expect(mobile).toHaveAttribute('open','');
      await expect(mobile).toContainText('120');
    }
    const excess=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(excess).toBeLessThanOrEqual(2);
  });
}
