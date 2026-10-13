import {test,expect} from '@playwright/test';

test('Make Payment opens guided SQL simulation inside the taxpayer workspace',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Representative responsive simulated checkout route');
 await page.route('https://eyqhoavnitkrajvyqvxn.supabase.co/rest/v1/rpc/sim_payment_history',async route=>{
   await route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 await page.goto('/?action=taxpayer_home&demoUser=user1');
 await expect(page.getByRole('heading',{name:'My Tax Payments'})).toBeVisible();
 await expect(page.getByText('Demo scenario',{exact:false})).toHaveCount(0);
 await page.locator('.citizen-taxpayer-hero__actions').getByRole('button',{name:'Make Payment'}).click();
 await expect(page.getByRole('heading',{name:'Make Payment'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Payment category'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Continue'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Run payment simulation'})).toHaveCount(0);
 await expect(page.getByText(/Simulation only: no real payment, government challan or tax credit\.|Simulation only; no payment or credit\./i)).toBeVisible();
 await expect(page.getByText('Simulated receipt reference:',{exact:false})).toHaveCount(0);
});
