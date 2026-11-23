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
  // The matched screenshot has no extra Clear (×) beside the label. Users
  // still edit or erase the controlled TIN with their keyboard.
  await expect(modal.getByRole('button',{name:'Clear TIN search'})).toHaveCount(0);
  await input.fill('');
  await expect(input).toHaveValue('');
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
  await expect(modal.getByRole('button',{name:'Continue to Payment Head'})).toBeEnabled();
  await expect(modal.getByTestId('unified-taxpayer-count')).toHaveText('1');
  await expect(modal.getByTestId('unified-taxpayer-workspace')).toContainText('User 2');
});

test('v5 Return checkbox composes with other taxpayer/head and written final total', async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  const modal=await openV5(page);
  await addTaxpayer(modal,'222222222222');
  await addTaxpayer(modal,'333333333333');
  await modal.getByRole('button',{name:'Continue to Payment Head'}).click();
  await expect(modal.getByText('Paying tax for').first()).toBeVisible();
  await expect(modal.getByText('Search and select').first()).toBeVisible();
  const catalogue = modal.getByTestId('other-tax-head-catalogue');
  const returnGroup = catalogue.getByTestId('unified-v5-return-group');
  await expect(returnGroup).toHaveAttribute('data-head-group', 'Tax with Return');
  await expect(returnGroup.locator('summary')).toContainText('Tax with Return');
  await expect(returnGroup.locator('.other-tax-category-trigger__count')).toHaveText('1 head');
  await expect(returnGroup.locator('[data-head-row="125"]')).toHaveCount(1);
  await returnGroup.locator('summary').click();
  const checkbox = returnGroup.getByTestId('unified-v5-return-checkbox');
  await expect(checkbox).toBeVisible();
  await checkbox.check();
  // Return is inside the SAME catalogue and uses exactly the same line editor,
  // not a separate custom card above the Tax head section.
  await expect(modal.locator('.unified-v5-return-card')).toHaveCount(0);
  await expect(returnGroup.getByTestId('other-tax-line')).toHaveCount(1);
  await expect(returnGroup.getByTestId('other-tax-line').locator('select[id^="other-tax-year-"]')).toHaveValue('2026-27');
  await expect(returnGroup.getByRole('button',{name:'Add another assessment year'})).toHaveCount(0);
  await expect(modal.getByText(/168 available payment heads/)).toBeVisible();
  const returnAmount=modal.getByTestId('unified-v5-return-amount');
  await returnAmount.fill('1500');
  const returnCheckboxBox = await checkbox.boundingBox();
  expect(returnCheckboxBox).not.toBeNull();
  const taxpayerTabs=modal.getByTestId('other-tax-taxpayer-tabs').locator('button[data-taxpayer-id]');
  await expect(taxpayerTabs).toHaveCount(2);
  await taxpayerTabs.nth(1).click();
  // Each taxpayer retains independent Return and ordinary head selections.
  await expect(returnGroup.getByTestId('unified-v5-return-checkbox')).not.toBeChecked();
  const batch=modal.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] > summary').click();
  const group=batch.locator('[data-head-group="Advance Tax"]');
  await expect(group).toHaveAttribute('open','');
  const catalogCheck = batch.getByRole('checkbox',{name:/Select 68A/});
  // Both Return and catalogue checkboxes belong on the LEFT of their labels.
  const leftAlignment = [
    returnCheckboxBox, await catalogCheck.boundingBox(),
  ];
  expect(leftAlignment[0]).not.toBeNull();
  expect(leftAlignment[1]).not.toBeNull();
  expect(Math.abs(leftAlignment[0]!.x - leftAlignment[1]!.x)).toBeLessThan(13);
  await catalogCheck.check();
  await batch.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('4000');
  await modal.getByRole('button',{name:'Continue to Final Preview'}).click();
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
