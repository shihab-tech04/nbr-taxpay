import {expect,test} from '@playwright/test';

test('Dashboard omits redundant explore action and retains Pay Tax navigation',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop reference rail regression');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Financial summary'}).locator('article')).toHaveCount(4);
  await expect(page.getByRole('button',{name:'Explore payment flow'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
});
