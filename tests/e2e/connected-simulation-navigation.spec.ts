import {test,expect} from '@playwright/test';

test('Anonymous fictional payment entry requires authenticated profile before any SQL operation',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Representative responsive payment access control');
 let paymentRpcCalls=0;
 await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/rest/v1/rpc/sim_*',async route=>{
   paymentRpcCalls++;
   await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Protected endpoint'})});
 });
 await page.goto('/?action=taxpayer_home&demoUser=user1');
 await expect(page.getByRole('heading',{name:'My Tax Payments'})).toBeVisible();
 await page.locator('.citizen-taxpayer-hero__actions').getByRole('button',{name:'Payments & activity'}).click();
 await expect(page.getByRole('heading',{name:'Sign in to simulate a payment'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Simulate and save payment'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Open secure sign-in'})).toBeVisible();
 expect(paymentRpcCalls).toBe(0);
 await page.getByRole('button',{name:'Open secure sign-in'}).click();
 await expect(page).toHaveURL(/action=secure_workspace/);
 await expect(page.getByRole('button',{name:'Simulate and save payment'})).toHaveCount(0);
 await expect(page.getByText('Simulated receipt reference:',{exact:false})).toHaveCount(0);
});

test('Anonymous notifications never call protected SQL and offer secure sign-in',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Representative notification authorization');
 let requests=0;
 await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/rest/v1/rpc/sim_*',async route=>{
  requests++;
  await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Forbidden'})});
 });
 await page.goto('/?action=notifications&demoUser=user1');
 await expect(page.getByRole('heading',{name:'Sign in to view payment notifications'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open secure sign-in'})).toBeVisible();
 expect(requests).toBe(0);
 await page.getByRole('button',{name:'Open secure sign-in'}).click();
 await expect(page).toHaveURL(/action=secure_workspace/);
});
