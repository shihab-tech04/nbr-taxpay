import {expect,test} from '@playwright/test';

test('public report keeps entered details and cannot claim success without a backend',async({page})=>{
 await page.goto('/?action=incident');
 await page.getByLabel('Short description').fill('Unable to identify my receipt after payment');
 await page.getByRole('button',{name:'Review details'}).click();
 await expect(page.getByRole('heading',{name:'Review your details'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Submit report'})).toBeVisible();
 await page.getByRole('button',{name:'Submit report'}).click();
 await expect(page.getByRole('alert')).toContainText('Reporting is temporarily unavailable');
 await expect(page.getByRole('heading',{name:'Report submitted'})).toHaveCount(0);
 await page.getByRole('button',{name:'Edit details'}).click();
 await expect(page.getByLabel('Short description')).toHaveValue('Unable to identify my receipt after payment');
});

test('validation prevents empty or short reports',async({page})=>{
 await page.goto('/?action=incident');
 await page.getByLabel('Short description').fill('short');
 await page.getByRole('button',{name:'Review details'}).click();
 await expect(page.getByRole('button',{name:'Submit report'})).toHaveCount(0);
});
