import {test,expect} from '@playwright/test';

test('pending Office mirror retries the same simulated payment without a false decline or duplicate',async({page})=>{
  const attempts: Array<{idempotencyKey:string;sessionId:string}>=[];
  const paymentId='11111111-2222-4333-8444-555555555555';
  await page.route('**/*.supabase.co/**',route=>route.abort());
  await page.route('**/functions/v1/demo-story1-taxpay/payments',async route=>{
    if(route.request().method()!=='POST')return route.abort();
    const input=route.request().postDataJSON() as {idempotencyKey:string;sessionId:string};
    attempts.push({idempotencyKey:input.idempotencyKey,sessionId:input.sessionId});
    const body=attempts.length===1
      ?{success:false,error:'OFFICE_SYNC_PENDING',requestId:paymentId,retryable:true,simulationOnly:true}
      :{success:true,id:paymentId,status:'SIMULATED_SUCCESS',mirrored:true,simulationOnly:true};
    await route.fulfill({status:attempts.length===1?503:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await dialog.locator('[data-payer-relationship="SELF"]').click();
  await dialog.locator('[data-payment-entry="TAX_WITH_RETURN"]').click();
  await dialog.locator('[data-payment-access="GUEST"]').click();
  await dialog.getByRole('button',{name:'Continue',exact:true}).click();
  await dialog.locator('#guest-tin').fill('123456789012');
  await dialog.locator('#guest-phone').fill('01712345678');
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await dialog.getByRole('radio',{name:/Person other than company/}).check();
  await dialog.locator('#guest-tax-amount').fill('10');
  await dialog.getByRole('button',{name:'Continue to payment channel'}).click();
  await dialog.getByRole('button',{name:'Pay online'}).click();
  await dialog.getByRole('button',{name:'Mobile banking'}).click();
  await dialog.getByRole('radio',{name:'bKash'}).check();
  await dialog.getByRole('checkbox',{name:/I confirm/}).check();
  await dialog.getByRole('button',{name:/Pay ৳ 10/}).click();
  await expect(dialog.getByRole('heading',{name:'Simulation confirmation pending'})).toBeVisible({timeout:15000});
  await expect(dialog.getByRole('heading',{name:'Payment request declined'})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Retry Office synchronization'}).click();
  await expect(dialog.getByRole('heading',{name:'Payment record saved'})).toBeVisible({timeout:15000});
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
});
