import {expect,test} from '@playwright/test';

test('server acceptance alone yields a support reference; no payment status is inferred',async({page})=>{
 let writes=0;
 await page.route('**/functions/v1/taxpay-public-report',async route=>{
   writes+=1;
   const payload=route.request().postDataJSON();
   expect(payload.category).toBe('payment');
   expect(payload.details).toBe('I need help finding my receipt reference');
   expect(payload.submissionKey).toMatch(/^[0-9a-f-]{36}$/i);
   await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({
     reference:'KRB-ABCDEF012345',trackingToken:'2339cd1d-cf9b-40ab-9f8d-899ca771ff20',status:'received'
   })});
 });
 await page.goto('/?action=incident');
 await page.getByLabel('Short description').fill('I need help finding my receipt reference');
 await page.getByRole('button',{name:'Review details'}).click();
 await page.getByRole('button',{name:'Submit report'}).click();
 await expect(page.getByRole('heading',{name:'Report submitted'})).toBeVisible();
 await expect(page.getByText('KRB-ABCDEF012345')).toBeVisible();
 await expect(page.getByText('Submitting a report does not verify or settle a payment.')).toBeVisible();
 expect(writes).toBe(1);
 await page.getByRole('button',{name:'New report'}).click();
 await expect(page.getByLabel('Short description')).toBeEmpty();
});

test('server failure retains draft and never makes up a support reference',async({page})=>{
 await page.route('**/functions/v1/taxpay-public-report',route=>
   route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'}));
 await page.goto('/?action=incident');
 await page.getByLabel('Short description').fill('A payment was debited but the record is missing');
 await page.getByRole('button',{name:'Review details'}).click();
 await page.getByRole('button',{name:'Submit report'}).click();
 await expect(page.getByRole('alert')).toContainText('Report not sent');
 await expect(page.getByRole('heading',{name:'Report submitted'})).toHaveCount(0);
 await page.getByRole('button',{name:'Edit details'}).click();
 await expect(page.getByLabel('Short description')).toHaveValue('A payment was debited but the record is missing');
});
