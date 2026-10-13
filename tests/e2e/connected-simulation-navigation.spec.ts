import {test,expect} from '@playwright/test';

test('Payments and activity fails closed until verified taxpayer sign-in and profile assignment',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Representative responsive protected checkout route');
 await page.goto('/?action=taxpayer_home&demoUser=user1');
 await expect(page.getByRole('heading',{name:'My Tax Payments'})).toBeVisible();
 await expect(page.getByText('Demo scenario',{exact:false})).toHaveCount(0);
 await page.locator('.citizen-taxpayer-hero__actions').getByRole('button',{name:'Payments & activity'}).click();
 await expect(page.getByRole('heading',{name:'Payments and transaction history'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Create a combined payment'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Simulate and save payment'})).toHaveCount(0);
 await expect(page.getByText('Sign in to view your account.')).toBeVisible();
 await expect(page.getByText('Simulated receipt reference:',{exact:false})).toHaveCount(0);
});
