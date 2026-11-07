import {expect,test} from '@playwright/test';

test('Dashboard omits redundant explore action and retains Pay Tax navigation',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop reference rail regression');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByTestId('taxpayer-overview-bento')).toBeVisible();
  await expect(page.locator('.taxpay-bento-position')).toContainText('৳ 25,000');
  await expect(page.getByRole('button',{name:'Explore payment flow'})).toHaveCount(0);
  await page.locator('.taxpay-bento-hero').getByRole('button',{name:'Pay tax'}).click();
  await expect(page.getByRole('dialog',{name:'Pay Tax'})).toBeVisible();
});
