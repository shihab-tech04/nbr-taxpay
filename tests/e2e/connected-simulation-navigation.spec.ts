import {test,expect} from '@playwright/test';

test('fictional Start Payment enters connected SQL simulation without issuing an official receipt',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Representative responsive simulated checkout route');
 await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/rest/v1/rpc/sim_payment_history',async route=>{
   await route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 await page.goto('/?action=taxpayer_home&demoUser=user1');
 await expect(page.getByRole('heading',{name:'My Tax Payments'})).toBeVisible();
 await expect(page.getByText('Demo scenario',{exact:false})).toHaveCount(0);
 await page.locator('.citizen-taxpayer-hero__actions .citizen-taxpayer-primary').click();
 await expect(page.getByRole('heading',{name:'Payments and transaction history'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Create a combined payment'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add beneficiary / category'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Simulate and save payment'})).toBeVisible();
 await expect(page.getByText('Simulation only: no real payment, government challan or tax credit.',{exact:false})).toBeVisible();
 await expect(page.getByText('Simulated receipt reference:',{exact:false})).toHaveCount(0);
});
