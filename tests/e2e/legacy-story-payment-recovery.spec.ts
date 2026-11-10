import {test,expect} from '@playwright/test';

/** Browser journey uses intercepted fictional transport; SQL ownership is tested
 * separately against disposable PostgreSQL. No hosted payment rows are created. */
test('prior-browser Story1 recovery preserves original data without duplicating Activity panels',async({page})=>{
  test.setTimeout(90_000);
  const primary='00000000-0000-4000-8000-000000010001';
  const legacy='00000000-0000-4000-8000-000000020002';
  const payment='00000000-0000-4000-8000-000000030003';
  const cap='A'.repeat(43);
  const date='2026-11-05T12:00:00Z';
  const snapshot={
    id:payment,challanNo:'SIM-RECOVER-1',tokenNumber:'SIM-TOKEN',
    paymentCategory:'OTHER_TAX_PAYMENT',assessmentYear:'2025-26',
    payerName:'Preview user1',payerTin:'1111111111111',taxpayerTin:'1111111111111',
    receiptMobile:'01712345678',isRepresentativePayment:false,
    taxZone:'—',taxCircle:'—',isWithholding:false,
    items:[{headId:1,economicCode:'16A',headNameEn:'Surcharge',
      taxAmount:100,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:100}],
    allocationItems:[{taxpayerTin:'1111111111111',taxpayerName:'Preview user1',
      paymentServiceEn:'Surcharge',paymentServiceBn:'সারচার্জ',
      assessmentYear:'2025-26',amountMinor:10000}],
    totalAmount:100,paymentMethod:'SIMULATED',gatewayTransactionId:'SIMULATED',
    treasuryStatus:'GATEWAY_SUCCESS',taxCreditStatus:'PENDING_RECONCILIATION',
    createdAt:date,isSimulatedDemo:true
  };
  let recovered=false;
  let recoveryAttempts=0;
  const paymentRequests:string[]=[];
  const failedRequests:string[]=[];
  page.on('requestfailed',request=>failedRequests.push(request.url()+':'+request.failure()?.errorText));
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
      recoveryAttempts++;
      if(recoveryAttempts===1){
        await route.fulfill({status:503,contentType:'application/json',body:'{"success":false,"code":"SERVICE_UNAVAILABLE"}'});
        return;
      }
      recovered=true;data={recovered:1};
    }else if(action==='lists'||action==='people'||action==='payment-draft-list')data=[];
    else if(action==='open')data={active:true};
    else throw new Error('Unexpected action '+action);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/profile-history?**',route=>{
    const view=new URL(route.request().url()).searchParams.get('view');
    const rows=recovered&&view==='payer'?[{
      id:'SIM-'+payment.replaceAll('-','').slice(0,16).toUpperCase(),transactionId:payment,
      payer:'user1',state:'SIMULATED',reviewStatus:'MIRRORED_TO_OFFICE',
      createdAt:date,totalMinor:10000,simulationOnly:true,
      allocations:[{beneficiary:'user1',category:'OTHER_TAX_PAYMENT',assessmentYear:'2026-27',amountMinor:10000}],events:[]
    }]:[];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      success:true,simulationOnly:true,data:rows
    })});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?*',route=>
    route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"data":[],"simulationOnly":true}'}));
  await page.route('**/functions/v1/demo-story1-taxpay/payments**',async route=>{
    const url=new URL(route.request().url());
    paymentRequests.push(url.pathname+url.search);
    const detail=url.pathname.includes('/payments/'+payment);
    const record={id:payment,service:'OTHER_TAX_PAYMENT',amountMinor:10000,status:'SIMULATED_SUCCESS',createdAt:date};
    if(detail){
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        success:true,simulationOnly:true,data:{id:payment,status:record.status,createdAt:date,
          data:{service:record.service,amountMinor:10000,details:{payerName:'Earlier payer',assessmentYear:'2025-26',paymentMethod:'SIMULATED',receiptSnapshot:snapshot}}}
      })});return;
    }
    const items=recovered?[record]:[];
    console.log('Mock Story1 list:',JSON.stringify({recovered,items:items.length,pathname:url.pathname,session:url.searchParams.get('sessionId')}));
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
  await page.getByRole('navigation',{name:'Taxpayer services'}).getByRole('button',{name:'Activity'}).click();
  await expect(page).toHaveURL(/action=history/);
  const saved=await page.evaluate(()=>({
    legacy:sessionStorage.getItem('taxpay-guest-simulation-session'),
    profileKey:sessionStorage.getItem('taxpay-taxpayer-preview-user'),
    preview:JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')??'null')
  }));
  expect(saved.legacy).toBe(legacy);
  expect(saved.profileKey).toBe('user1');
  expect(saved.preview?.profileId).toBe('user1');
  await expect(page.getByRole('heading',{name:/Payment|পেমেন্ট/}).first()).toBeVisible();
  // user1 has its own approved Transactions view; recovery must be mounted there,
  // not on the generic payment screen that this profile never visits.
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Restore earlier payments'})).toBeVisible();
  const recovery=page.locator('section[aria-label="Recover earlier saved payments"]');
  await page.getByRole('button',{name:'Restore earlier payments'}).click();
  await expect(recovery.getByRole('alert')).toContainText('Unable to confirm restored payment records');
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-guest-simulation-session'))).toBe(legacy);
  // A transient transport failure leaves the source session available for retry.
  await page.getByRole('button',{name:'Restore earlier payments'}).click();
  await expect.poll(()=>recovered).toBe(true);
  expect(recoveryAttempts).toBe(2);
  // The recovered SQL rows update in place; a deliberate reload must also
  // restore them from the confirmed server-side session link.
  // Probe the browser's actual JSON parse of the intercepted payment list to
  // distinguish transport/CORS failures from the recovered-history renderer.
  const listProbe=await page.evaluate(async()=>{
    const raw=sessionStorage.getItem('korbritto.demo-profile-session.v1');
    const sessionId=raw?JSON.parse(raw).paymentSessionId:null;
    if(!sessionId)return {error:'no preview session'};
    try {
      const response=await fetch('https://eyqhoavnitkrajvyqvxn.supabase.co/functions/v1/demo-story1-taxpay/payments?sessionId='+encodeURIComponent(sessionId)+'&page=1&perPage=100',{cache:'no-store'});
      return {status:response.status,body:await response.json()};
    }catch(e){return {error:String(e)};}
  });
  console.log('Direct browser payment list probe:',JSON.stringify(listProbe));
  // The legacy link remains functional, but the two unrequested panels must
  // not be appended beneath the approved Transactions register.
  expect(listProbe.status).toBe(200);
  expect(listProbe.body?.data?.items?.some((row:{id:string})=>row.id===payment)).toBe(true);
  await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Earlier saved payment records'})).toHaveCount(0);
  await expect(page.getByTestId('recovered-story-payments')).toHaveCount(0);
  await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/action=history/);
  await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Earlier saved payment records'})).toHaveCount(0);
  await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
  // The recovery response is still queryable from the same authorized session.
  const reread=await page.evaluate(async()=>{
    const saved=sessionStorage.getItem('korbritto.demo-profile-session.v1');
    const id=saved?JSON.parse(saved).paymentSessionId:null;
    if(!id)return {error:'no owner session'};
    const response=await fetch('https://eyqhoavnitkrajvyqvxn.supabase.co/functions/v1/demo-story1-taxpay/payments?sessionId='+encodeURIComponent(id)+'&page=1&perPage=100',{cache:'no-store'});
    return {status:response.status,body:await response.json()};
  });
  expect(reread.status).toBe(200);
  expect(reread.body?.data?.items?.some((row:{id:string})=>row.id===payment)).toBe(true);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-guest-simulation-session'))).toBeNull();
  await expect(page.getByRole('button',{name:'Restore earlier payments'})).toHaveCount(0);
  // Pay Again is attached only to each SQL-recorded transaction, not to the
  // search/filter/export toolbar and never to synthetic DEMO-* example rows.
  await expect(page.getByTestId('user1-pay-again-entry')).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Pay Again'})).toHaveCount(0);
  const register=page.getByTestId('taxpayer-transaction-table');
  const paid=register.getByRole('row').filter({hasText:payment});
  await expect(paid).toBeVisible({timeout:15000});
  await expect(paid.getByTestId('recorded-pay-again')).toBeEnabled();
  const illustrative=register.getByRole('row').filter({hasText:'DEMO-PAY-PEND-01'});
  await expect(illustrative.getByTestId('recorded-pay-again')).toHaveCount(0);
  // Each payment also exposes the repeat action within its own Details modal.
  await paid.getByRole('button',{name:'Details for Other Tax Payment'}).click();
  const detail=page.getByRole('dialog',{name:'Other Tax Payment'});
  await expect(detail).toBeVisible();
  await expect(detail.getByTestId('recorded-pay-again-detail')).toBeEnabled();
  await detail.getByTestId('recorded-pay-again-detail').click();
  const cloned=page.getByRole('dialog',{name:'Pay Tax'});
  await expect(cloned).toBeVisible();
  await expect(cloned.getByTestId('pay-again-reuse-notice')).toContainText(payment);
  await expect(cloned.getByTestId('pay-again-reuse-notice')).toContainText('Original payment unchanged.');
});
