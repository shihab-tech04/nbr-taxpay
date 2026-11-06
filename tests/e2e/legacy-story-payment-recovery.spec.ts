import {test,expect} from '@playwright/test';

/** Browser journey uses intercepted fictional transport; SQL ownership is tested
 * separately against disposable PostgreSQL. No hosted payment rows are created. */
test('prior-browser Story1 receipts survive profile recovery and refresh without changing Transactions',async({page})=>{
  test.setTimeout(90_000);
  const primary='00000000-0000-4000-8000-000000010001';
  const legacy='00000000-0000-4000-8000-000000020002';
  const payment='00000000-0000-4000-8000-000000030003';
  const cap='A'.repeat(43);
  const date='2026-11-05T12:00:00Z';
  let recovered=false;
  await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
    const body=route.request().postDataJSON() as Record<string,unknown>;
    const action=body.action;
    let data:unknown;
    if(action==='demo-login')data={profileId:'user1',capability:cap,paymentSessionId:primary,language:'en',selectedListId:null};
    else if(action==='demo-settings')data={language:'en',selectedListId:null,paymentSessionId:primary};
    else if(action==='demo-recover-payments'){
      expect(route.request().headers()['x-taxpay-guest-capability']).toBe(cap);
      expect(body.legacySessionId).toBe(legacy);
      recovered=true;data={recovered:1};
    }else if(action==='lists'||action==='people')data=[];
    else if(action==='open')data={active:true};
    else throw new Error('Unexpected action '+action);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  await page.route('**/rest/v1/rpc/demo_story1_demo_history*',route=>
    route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?*',route=>
    route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"data":[],"simulationOnly":true}'}));
  await page.route('**/functions/v1/demo-story1-taxpay/payments*',async route=>{
    const url=new URL(route.request().url());
    const detail=url.pathname.includes('/payments/'+payment);
    const record={id:payment,service:'OTHER_TAX_PAYMENT',amountMinor:10000,status:'SIMULATED_SUCCESS',createdAt:date};
    if(detail){
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        success:true,simulationOnly:true,data:{id:payment,status:record.status,createdAt:date,
          data:{service:record.service,amountMinor:10000,details:{payerName:'Earlier payer',assessmentYear:'2026-27',paymentMethod:'SIMULATED'}}}
      })});return;
    }
    const items=recovered?[record]:[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      success:true,simulationOnly:true,data:{items,total:items.length,page:1,perPage:100}
    })});
  });
  await page.goto('http://127.0.0.1:4173/?action=taxpayer_login');
  await page.evaluate(key=>sessionStorage.setItem('taxpay-guest-simulation-session',key),legacy);
  await page.getByRole('textbox',{name:'User ID'}).fill('user1');
  await page.getByLabel('Password',{exact:true}).fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await page.goto('http://127.0.0.1:4173/?action=history');
  await expect(page.getByRole('button',{name:'Restore earlier payments'})).toBeVisible();
  await page.getByRole('button',{name:'Restore earlier payments'}).click();
  await expect.poll(()=>recovered).toBe(true);
  await expect(page.getByTestId('recovered-story-payments')).toContainText(payment);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-guest-simulation-session'))).toBeNull();
  await expect(page.getByRole('button',{name:'Restore earlier payments'})).toHaveCount(0);
});
