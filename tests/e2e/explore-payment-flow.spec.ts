import {expect,test} from '@playwright/test';

test('Explore payment flow opens public stepper without protected payment RPCs',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop reference rail regression');
  let protectedCalls=0;
  await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/rest/v1/rpc/sim_*',async route=>{
    protectedCalls++;
    await route.fulfill({status:403,contentType:'application/json',body:'{}'});
  });
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  const explore=page.getByRole('button',{name:'Explore payment flow'});
  await expect(explore).toBeVisible();
  await explore.click();
  await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toBeVisible();
  await expect(page.getByText('Payment steps',{exact:false})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sign in to simulate a payment'})).toHaveCount(0);
  expect(protectedCalls).toBe(0);
});
