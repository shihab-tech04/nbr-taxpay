import {test,expect,type Page} from '@playwright/test';

async function submitTenTaka(page:Page){
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
  return dialog;
}

test('durable SQL simulation reconciles a delayed Office mirror without a new payment key',async({page})=>{
  const attempts: Array<{idempotencyKey:string;sessionId:string}>=[];
  const paymentId='11111111-2222-4333-8444-555555555555';
  await page.route('**/*.supabase.co/**',route=>route.abort());
  await page.route('**/functions/v1/demo-story1-taxpay/payments/*',async route=>{
    const sessionId=new URL(route.request().url()).searchParams.get('sessionId');
    if(route.request().method()!=='GET'||sessionId!==attempts[0]?.sessionId)return route.abort();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      success:true,simulationOnly:true,data:{id:paymentId,status:'SIMULATED_SUCCESS',
        data:{idempotencyKey:attempts[0].idempotencyKey,sessionId:attempts[0].sessionId,
          amountMinor:1000,service:'TAX_WITH_RETURN'}}
    })});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/payments',async route=>{
    if(route.request().method()!=='POST')return route.abort();
    const input=route.request().postDataJSON() as {idempotencyKey:string;sessionId:string};
    attempts.push({idempotencyKey:input.idempotencyKey,sessionId:input.sessionId});
    const body=attempts.length===1
      ?{success:false,error:'OFFICE_SYNC_PENDING',requestId:paymentId,retryable:true,simulationOnly:true}
      :{success:true,id:paymentId,status:'SIMULATED_SUCCESS',mirrored:true,simulationOnly:true};
    await route.fulfill({status:attempts.length===1?503:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const dialog=await submitTenTaka(page);
  await expect(dialog.getByRole('heading',{name:'Simulation saved — Office sync pending'})).toBeVisible({timeout:15000});
  await expect(dialog.getByText('Simulation saved in TaxPay SQL. Office synchronization is pending; this is not a real tax payment.')).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Payment request declined'})).toHaveCount(0);
  // The new client reconciles the verified SQL record automatically, with a
  // bounded retry of the *same* original idempotency key.
  await expect(dialog.getByRole('heading',{name:'Payment record saved'})).toBeVisible({timeout:15000});
  await expect(dialog.getByText('Office synchronization is pending; this is not a real tax payment.',{exact:false})).toHaveCount(0);
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
});

test('temporarily unreadable Office-pending SQL is never presented as a gateway decline',async({page})=>{
  const requests: Array<{idempotencyKey:string;sessionId:string}>=[];
  const paymentId='33333333-2222-4333-8444-555555555555';
  await page.route('**/*.supabase.co/**',route=>route.abort());
  await page.route('**/functions/v1/demo-story1-taxpay/payments/*',route=>
    route.fulfill({status:503,contentType:'application/json',
      body:JSON.stringify({success:false,error:'RECORD_UNAVAILABLE'})}));
  await page.route('**/functions/v1/demo-story1-taxpay/payments',async route=>{
    if(route.request().method()!=='POST')return route.abort();
    const input=route.request().postDataJSON() as {idempotencyKey:string;sessionId:string};
    requests.push({idempotencyKey:input.idempotencyKey,sessionId:input.sessionId});
    await route.fulfill({status:requests.length===1?503:200,contentType:'application/json',
      body:JSON.stringify(requests.length===1
        ?{success:false,error:'OFFICE_SYNC_PENDING',requestId:paymentId,retryable:true}
        :{success:true,id:paymentId,status:'SIMULATED_SUCCESS',mirrored:true,simulationOnly:true})});
  });
  const dialog=await submitTenTaka(page);
  await expect(dialog.getByRole('heading',{name:'Simulation confirmation pending'})).toBeVisible({timeout:15000});
  await expect(dialog.getByRole('heading',{name:'Payment request declined'})).toHaveCount(0);
  await expect(dialog.getByRole('heading',{name:'Payment record saved'})).toBeVisible({timeout:15000});
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
});

test('a rejected SQL submission requires input correction and cannot auto-resubmit',async({page})=>{
  let attempts=0;
  await page.route('**/*.supabase.co/**',route=>route.abort());
  await page.route('**/functions/v1/demo-story1-taxpay/payments',async route=>{
    attempts++;
    await route.fulfill({status:400,contentType:'application/json',
      body:JSON.stringify({success:false,error:'SUBMISSION_FAILED'})});
  });
  const dialog=await submitTenTaka(page);
  await expect(dialog.getByRole('heading',{name:'Review payment information'})).toBeVisible({timeout:15000});
  await expect(dialog.getByText('The simulation could not be saved. Review the taxpayer and payment details before retrying.')).toBeVisible();
  await page.waitForTimeout(3200);
  expect(attempts).toBe(1);
});
