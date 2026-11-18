import { expect, test } from '@playwright/test';

async function enterUnifiedWalkIn(page: import('@playwright/test').Page) {
  await page.goto('/?action=landing&lang=en');
  await page.locator('.public-benefits__item[data-benefit="payments"]').click();
  const modal = page.getByRole('dialog', {name:'Pay Tax'});
  await modal.getByRole('button', {name:'Walk-in Payment'}).click();
  await expect(modal.getByTestId('unified-taxpayer-workspace')).toBeVisible();
  return modal;
}

async function addDemoTaxpayer(modal: import('@playwright/test').Locator, tin:string) {
  await modal.getByTestId('unified-tin-input').fill(tin);
  await modal.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await expect(modal.getByTestId('unified-taxpayer-search-result')).toBeVisible();
  await modal.getByRole('button',{name:'Add taxpayer'}).click();
}

test('pre-lock v3 Step 1: search > profile > Add taxpayer > selected rail, without old income type selector', async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  const modal=await enterUnifiedWalkIn(page);
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
  await expect(modal.getByText('Search a TIN to view taxpayer information.')).toBeVisible();
  await expect(modal.getByTestId('unified-taxpayer-count')).toHaveText('0');
  await addDemoTaxpayer(modal,'222222222222');
  await expect(modal.getByTestId('unified-taxpayer-count')).toHaveText('1');
  await expect(modal.getByText('User 2').first()).toBeVisible();
  await expect(modal.locator('select[id^="tax-type-"]')).toHaveCount(0);
  await addDemoTaxpayer(modal,'333333333333');
  await expect(modal.getByTestId('unified-taxpayer-count')).toHaveText('2');
  await expect(modal.getByText('User 3').first()).toBeVisible();
  await expect(modal.locator('input[name="unified-payment-mode"]')).toHaveCount(0);
  await modal.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(modal.locator('.taxpay-modal__title')).toHaveText('Payment Head');
  await expect(modal.getByTestId('other-tax-batch')).toBeVisible();
  await expect(modal.getByTestId('other-tax-selection-menu')).toContainText('Select');
  const returnChoice=modal.locator('[data-unified-tax-service="TAX_WITH_RETURN"]');
  const otherChoice=modal.locator('[data-unified-tax-service="OTHER_TAX_PAYMENT"]');
  await expect(returnChoice).toBeEnabled();
  await expect(otherChoice).toHaveAttribute('aria-pressed','true');
  await returnChoice.click();
  await expect(modal.getByTestId('unified-return-eligibility')).toContainText('one taxpayer');
  await expect(modal.getByRole('button',{name:'Edit taxpayers'})).toBeVisible();
  await expect(modal.getByTestId('other-tax-batch')).toBeVisible();
});

test('one taxpayer may select Tax with Return and preserve the alternate Other Tax path', async ({page}) => {
  await page.setViewportSize({width:1280,height:900});
  const modal=await enterUnifiedWalkIn(page);
  await addDemoTaxpayer(modal,'222222222222');
  await modal.getByRole('button',{name:'Continue to purpose & amount'}).click();
  const returnChoice=modal.locator('[data-unified-tax-service="TAX_WITH_RETURN"]');
  await returnChoice.click();
  await expect(returnChoice).toHaveAttribute('aria-pressed','true');
  await expect(modal.getByTestId('other-tax-batch')).toHaveCount(0);
  await expect(modal.locator('#guest-assessment-year')).toBeVisible();
  await expect(modal.locator('#guest-tax-amount')).toBeVisible();
  await modal.locator('[data-unified-tax-service="OTHER_TAX_PAYMENT"]').click();
  await expect(modal.getByTestId('other-tax-batch')).toBeVisible();
});

test('desktop Step 1 right taxpayer rail extends to left bottom, mobile stacks without horizontal overflow', async ({page}) => {
  await page.setViewportSize({width:1280,height:860});
  const dialog=await enterUnifiedWalkIn(page);
  await addDemoTaxpayer(dialog,'111111111111');
  const desktop=await dialog.evaluate(node=>{
    const left=node.querySelector<HTMLElement>('.unified-taxpayer-workspace__editor');
    const right=node.querySelector<HTMLElement>('.unified-taxpayer-workspace__rail');
    if(!left||!right)return null;
    const l=left.getBoundingClientRect(),r=right.getBoundingClientRect();
    return {bottom:l.bottom,railBottom:r.bottom,leftX:l.x,rightX:r.x,width:r.width};
  });
  expect(desktop).not.toBeNull();
  expect(desktop!.railBottom).toBeGreaterThanOrEqual(desktop!.bottom-2);
  expect(desktop!.rightX).toBeGreaterThan(desktop!.leftX);
  expect(desktop!.width).toBeGreaterThan(240);
  await page.setViewportSize({width:390,height:844});
  const mobile=await dialog.evaluate(node=>{
    const l=node.querySelector<HTMLElement>('.unified-taxpayer-workspace__editor')?.getBoundingClientRect();
    const r=node.querySelector<HTMLElement>('.unified-taxpayer-workspace__rail')?.getBoundingClientRect();
    return {left:l?.left,right:r?.left,leftBottom:l?.bottom,rightTop:r?.top,
      pageOverflow:document.documentElement.scrollWidth>window.innerWidth+2};
  });
  expect(mobile.pageOverflow).toBe(false);
  expect(mobile.rightTop).toBeGreaterThanOrEqual((mobile.leftBottom??0)-2);
});
