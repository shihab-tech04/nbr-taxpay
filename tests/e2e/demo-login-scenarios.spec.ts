import { expect, test } from '@playwright/test';

test('legacy scenario URLs never reveal fictitious accounts or trigger hosted services',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Run legacy ten-URL regression matrix');
 const backendCalls:string[]=[];
 page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.supabase.co')) backendCalls.push(request.url());});
 for(let n=1;n<=10;n++){
   await page.goto('/?action=taxpayer_home&demoUser=user'+n);
   await expect(page.getByRole('heading',{name:'My Tax Payments'})).toBeVisible();
   await expect(page.getByText('Demo scenario',{exact:false})).toHaveCount(0);
   await expect(page.getByText('Example records; no taxpayer account is connected.')).toHaveCount(0);
   await expect(page.getByText('DEMO-TIN-00'+n,{exact:false})).toHaveCount(0);
   await expect(page.locator('#citizen-sample-role')).toHaveCount(0);
 }
 expect(backendCalls).toEqual([]);
});
test('legacy URL offers account access without fabricated sign-out',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','One mobile account-access journey');
 await page.goto('/?action=taxpayer_home&demoUser=user3');
 await expect(page.getByText('Demo scenario',{exact:false})).toHaveCount(0);
 await page.getByRole('button',{name:'Open menu'}).click();
 const dialog=page.getByRole('dialog',{name:'Services & menu'});
 await expect(dialog.getByRole('button',{name:'Exit demonstration account'})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Sign in'}).click();
 await expect(page.locator('.taxpayer-reference-secure')).toBeVisible();
 await expect(page).not.toHaveURL(/demoUser=/);
 await page.goto('/?action=landing');
 await expect(page.locator('.public-home-header__tools .public-home-login-link--desktop'))
   .toHaveAttribute('href','https://shihab-tech04.github.io/NBR-Officemanagment-UI-V2/payments/transactions');
});
