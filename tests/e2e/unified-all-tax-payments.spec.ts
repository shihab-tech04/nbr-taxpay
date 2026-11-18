import { expect, test } from '@playwright/test';

async function openV5(page: import('@playwright/test').Page) {
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const modal = page.getByRole('dialog', {name:'Pay Tax'});
  await modal.getByRole('button',{name:'Walk-in Payment'}).click();
  await expect(modal.getByTestId('unified-taxpayer-workspace')).toBeVisible();
  return modal;
}

async function addTaxpayer(modal: import('@playwright/test').Locator, tin: string) {
  await modal.getByTestId('unified-tin-input').fill(tin);
  await modal.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await expect(modal.getByTestId('unified-taxpayer-search-result')).toBeVisible();
  await modal.getByRole('button',{name:'Add taxpayer'}).click();
}

test('v5 frozen Step 1: exactly twelve blocks, entity alongside name and selected rail', async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  const modal=await openV5(page);
  await expect(modal.getByTestId('unified-v5-tin-blocks').locator('span')).toHaveCount(12);
  const input=modal.getByTestId('unified-tin-input');
  await expect(input).toHaveAttribute('maxlength','12');
  const search = modal.getByRole('button',{name:'Search taxpayer TIN'});
  await input.fill('22222222222');
  await expect(search).toBeDisabled();
  await expect(search).toHaveCSS('background-color','rgb(245, 246, 248)');
  await input.fill('222222222222');
  await expect(search).toBeEnabled();
  await expect(search).toHaveCSS('background-color','rgb(255, 255, 255)');
  await search.click();
  const result=modal.getByTestId('unified-taxpayer-search-result');
  await expect(result.locator('.unified-v5-profile-name')).toContainText('User 2');
  await expect(result.locator('.unified-v5-profile-name')).toContainText('Individual');
  await expect(result.getByText('Income tax type')).toHaveCount(0);
  await expect(result.getByText('Taxpayer type')).toHaveCount(0);
  const add = modal.getByRole('button',{name:'Add taxpayer'});
  await expect(add).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(add).toHaveCSS('color','rgb(38, 71, 97)');
  await add.click();
  await expect(modal.getByRole('button',{name:'Continue to purpose & amount'})).toBeEnabled();
  await expect(modal.getByTestId('unified-taxpayer-count')).toHaveText('1');
  await expect(modal.getByTestId('unified-taxpayer-workspace')).toContainText('User 2');
});

test('v5 Return checkbox composes with other taxpayer/head and written final total', async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  const modal=await openV5(page);
  await addTaxpayer(modal,'222222222222');
  await addTaxpayer(modal,'333333333333');
  await modal.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(modal.getByText('Paying tax for').first()).toBeVisible();
  await expect(modal.getByText('Search and select').first()).toBeVisible();
  const checkbox=modal.getByTestId('unified-v5-return-checkbox');
  await expect(checkbox).toBeVisible();
  await expect(checkbox).toHaveAttribute('type','checkbox');
  await checkbox.check();
  // Both the selected service and AY/amount are inside ONE bordered component.
  const returnGroup = modal.getByTestId('unified-v5-return-group');
  await expect(returnGroup).toBeVisible();
  await expect(returnGroup.locator('.unified-v5-return-card')).toHaveCount(1);
  await expect(returnGroup.locator('.unified-v5-return-fields')).toHaveCount(1);
  const cohesive = await returnGroup.evaluate(root => {
    const card = root.querySelector<HTMLElement>('.unified-v5-return-card');
    const fields = root.querySelector<HTMLElement>('.unified-v5-return-fields');
    return {
      connected: Boolean(card && fields && card.parentElement === fields.parentElement),
      outerBorder: window.getComputedStyle(root).borderTopWidth,
      cardBorder: card ? window.getComputedStyle(card).borderTopWidth : 'missing',
      backgroundsMatch: Boolean(card && fields) &&
        window.getComputedStyle(card!).backgroundColor === window.getComputedStyle(fields!).backgroundColor,
    };
  });
  expect(cohesive).toEqual({ connected:true,outerBorder:'1px',cardBorder:'0px',backgroundsMatch:true });
  const returnAmount=modal.getByTestId('unified-v5-return-amount');
  await returnAmount.fill('1500');
  const taxpayerTabs=modal.getByTestId('other-tax-taxpayer-tabs').locator('button[data-taxpayer-id]');
  await expect(taxpayerTabs).toHaveCount(2);
  await taxpayerTabs.nth(1).click();
  const batch=modal.getByTestId('other-tax-batch');
  const group=batch.locator('[data-head-group="Advance Tax"]');
  if (await group.getAttribute('open')===null) await group.locator('summary').click();
  const catalogCheck = batch.getByRole('checkbox',{name:/Select 68A/});
  // Both Return and catalogue checkboxes belong on the LEFT of their labels.
  const leftAlignment = await Promise.all([
    checkbox.boundingBox(), catalogCheck.boundingBox(),
  ]);
  expect(leftAlignment[0]).not.toBeNull();
  expect(leftAlignment[1]).not.toBeNull();
  expect(Math.abs(leftAlignment[0]!.x - leftAlignment[1]!.x)).toBeLessThan(13);
  await catalogCheck.check();
  await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('4000');
  await modal.getByRole('button',{name:'Continue to final preview'}).click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Final Preview');
  const review=modal.getByTestId('unified-v3-payment-details');
  await expect(review).toBeVisible();
  await expect(review.locator('tbody tr.unified-v3-review__owner')).toHaveCount(2);
  await expect(review).toContainText('Tax with Return');
  await expect(review).toContainText(/advance tax/i);
  const total=modal.getByTestId('unified-v5-payment-total');
  await expect(total).toContainText('5,500');
  await expect(total).toContainText('Five Thousand Five Hundred Taka only');
  // Final preview uses one outer card, one table-header rule, and one total rule.
  await expect(review).toHaveCSS('padding-top','0px');
  await expect(review.locator('tbody tr:not(.unified-v3-review__owner) td').first()).toHaveCSS('border-bottom-width','0px');
  await expect(total).toHaveCSS('border-top-width','1px');
  await expect(modal.locator('.payment-review--unified-v5 .payment-review__aside')).toBeHidden();
  await expect(modal.getByTestId('unified-v5-total-in-words')).toBeVisible();
});

test('v5 390px mobile stacks taxpayer rail without page overflow', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const modal=await openV5(page);
  await addTaxpayer(modal,'111111111111');
  const mobile=await modal.evaluate(node=>{
    const left=node.querySelector<HTMLElement>('.unified-taxpayer-workspace__editor')?.getBoundingClientRect();
    const right=node.querySelector<HTMLElement>('.unified-taxpayer-workspace__rail')?.getBoundingClientRect();
    return {leftBottom:left?.bottom,rightTop:right?.top,overflow:document.documentElement.scrollWidth>window.innerWidth+2};
  });
  expect(mobile.overflow).toBe(false);
  expect(mobile.rightTop).toBeGreaterThanOrEqual((mobile.leftBottom??0)-2);
});
