import { expect, test } from '@playwright/test';

test('all ten demo URLs show a synthetic taxpayer scenario, not authenticated government access',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Run one validated ten-user navigation matrix');
 const backendCalls:string[]=[];
 page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.supabase.co')) backendCalls.push(request.url());});
 for(let n=1;n<=10;n++){
   await page.goto('/?action=taxpayer_home&demoUser=user'+n);
   await expect(page.getByRole('heading',{name:'My Tax Payments'})).toBeVisible();
   await expect(page.getByText('Demo scenario · user'+n)).toBeVisible();
   await expect(page.getByText('Example records; no taxpayer account is connected.')).toBeVisible();
   await expect(page.locator('#citizen-sample-role')).toHaveCount(0);
 }
 expect(backendCalls).toEqual([]);
});
test('demo user exit clears the non-authenticated account parameter',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','One mobile exit journey');
 await page.goto('/?action=taxpayer_home&demoUser=user3');
 await expect(page.getByText('Demo scenario · user3')).toBeVisible();
 await page.getByRole('button',{name:'Open menu'}).click();
 await page.getByRole('button',{name:'Exit demonstration account'}).click();
 await expect(page).not.toHaveURL(/demoUser=/);
 await expect(page.locator('.public-home-header__tools .public-home-login-link--desktop')).toHaveAttribute('href','https://shihab-tech04.github.io/NBR-Officemanagment-UI-V2/payments/transactions');
 await expect(page.locator('.citizen-pay')).toHaveCount(0);
});
