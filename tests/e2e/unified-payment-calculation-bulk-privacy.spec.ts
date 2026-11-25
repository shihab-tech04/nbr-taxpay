import {expect,test} from '@playwright/test';

test('parallel v5 calculation preserves 167 selected heads, groups and Profile-only TIN copy',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Two-column 1280px calculation acceptance');
  await page.setViewportSize({width:1280,height:900});
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await dialog.getByRole('button',{name:'Walk-in Payment'}).click();
  for(const tin of ['111111111111','222222222222']){
    await dialog.getByTestId('unified-tin-input').fill(tin);
    await dialog.getByRole('button',{name:'Search taxpayer TIN'}).click();
    await expect(dialog.getByTestId('unified-taxpayer-search-result')).toBeVisible();
    await dialog.getByRole('button',{name:'Add taxpayer'}).click();
  }
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  const batch=dialog.getByTestId('other-tax-batch');
  const menu=batch.getByTestId('other-tax-selection-menu');
  await menu.locator('summary').click();
  await menu.getByRole('button',{name:'Select all',exact:true}).click();
  const grouped=dialog.getByTestId('grouped-taxpayer-calculation');
  const cards=grouped.locator('details.payment-form-summary__taxpayer');
  await expect(cards).toHaveCount(2);
  const first=cards.first(),second=cards.nth(1);
  await expect(first.locator('summary')).toContainText(/payment lines/);
  await expect(first.getByRole('button',{name:/Show next 20 selected heads/})).toBeVisible();
  await expect(first.getByTestId('selected-taxpayer-head-list').locator('.payment-form-summary__taxpayer-item')).toHaveCount(4);
  await expect(second.locator('summary')).toContainText('0 payment lines');
  await expect(dialog.getByRole('button',{name:'Copy TIN'})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Reveal TIN'})).toHaveCount(2);
  await first.getByRole('button',{name:/Show next 20 selected heads/}).click();
  await expect(first.getByTestId('selected-taxpayer-head-list').locator('.payment-form-summary__taxpayer-item')).toHaveCount(24);
  await expect(second).toBeVisible();
  const overflow=await dialog.locator('.taxpay-modal__body').evaluate(el=>el.scrollWidth-el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  // Selection and amounts are never mutated by the summary disclosure.
  await expect(batch.getByTestId('other-tax-line')).not.toHaveCount(0);
});
