import {expect,test} from '@playwright/test';

const capability='A'.repeat(43);
const sessionId='00000000-0000-4000-8000-000000004444';
type PreviewUser = 'user2'|'user30';
async function mockAccount(page:import('@playwright/test').Page, userId:PreviewUser, populated=false, failHistory=false, historyRecords?:unknown[], language:'en'|'bn'='en') {
  await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
    const request=route.request().postDataJSON() as Record<string,unknown>;
    let data:unknown;
    if(request.action==='demo-login'){
      if(request.userId!==userId||request.password!==userId)
        return route.fulfill({status:401,contentType:'application/json',body:'{"success":false}'});
      data={profileId:userId,capability,paymentSessionId:sessionId,language,selectedListId:null};
    }else if(request.action==='lists'||request.action==='people'||request.action==='payment-draft-list'){data=[];}
    else if(request.action==='demo-settings'){data={language,selectedListId:null,paymentSessionId:sessionId};}
    else if(request.action==='open'){data={active:true};}
    else return route.fulfill({status:404,contentType:'application/json',body:'{"success":false}'});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/profile-history*',route=>{
    if(failHistory)return route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'});
    if(route.request().headers()['x-taxpay-guest-capability']!==capability)
      return route.fulfill({status:403,contentType:'application/json',body:'{}'});
    const items=historyRecords??(populated?[{
      id:'account-owned-01',transactionId:'account-owned-01',payer:userId,
      state:'SIMULATED',createdAt:'2026-11-15T10:00:00Z',simulationOnly:true,
      totalMinor:2500000,reviewStatus:'PENDING_OFFICER',
      allocations:[{id:'own-01',lineNo:1,beneficiary:userId,category:'ADVANCE_TAX',
        assessmentYear:'2026-27',amountMinor:2500000}],events:[]
    }]:[]);
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,simulationOnly:true,data:items})});
  });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill(userId);
  await page.getByLabel('Password',{exact:true}).fill(userId);
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  const otp=page.getByTestId('demo-otp-input');
  if(await otp.isVisible()){
    await otp.fill('111111');
    await page.getByTestId('taxpayer-login-submit').click();
  }
  await expect(page).toHaveURL(/action=taxpayer_home/);
}

for(const user of ['user2','user30'] as const){
  test('recipient-first dashboard keeps the approved structure with an empty '+user,async({page},info)=>{
    test.skip(!['desktop-1280','mobile-375'].includes(info.project.name),'Targeted responsive coverage');
    await mockAccount(page,user);
    const dashboard=page.getByTestId('dashboard-unified-preview');
    await expect(dashboard).toBeVisible();
    await expect(dashboard.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
    await expect(dashboard.getByRole('heading',{name:'Payments at a glance'})).toBeVisible();
    await expect(dashboard.getByRole('heading',{name:'Payment recipients'})).toBeVisible();
    await expect(dashboard.getByRole('heading',{name:'Payment relationships'})).toBeVisible();
    await expect(dashboard.getByRole('heading',{name:'Top beneficiaries'})).toBeVisible();
    await expect(dashboard.getByRole('heading',{name:'My Tax Journey'})).toBeVisible();
    await expect(dashboard.getByRole('heading',{name:'Follow-ups'})).toBeVisible();
    await expect(dashboard.getByText('No payment relationships yet')).toBeVisible();
    await expect(dashboard.getByText('No beneficiaries to show')).toBeVisible();
    await expect(dashboard.getByText('Your tax journey is empty')).toBeVisible();
    await expect(dashboard.getByTestId('dashboard-overview-total')).toHaveText('৳0');
    await expect(dashboard.getByTestId('demo-sql-service-panel')).toHaveAttribute('data-scenario-user',user);
    await expect(dashboard.getByRole('heading',{name:'Payment composition'})).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
      .toBeLessThanOrEqual(2);
  });
}

test('new-account completed activity changes data inside the same layout',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Targeted populated record gate');
  await mockAccount(page,'user2',true);
  const dashboard=page.getByTestId('dashboard-unified-preview');
  await expect(dashboard.getByTestId('dashboard-overview-total')).toContainText('25,000');
  await expect(dashboard.getByRole('heading',{name:'Payments at a glance'})).toBeVisible();
  await expect(dashboard.getByRole('heading',{name:'Top beneficiaries'})).toBeVisible();
  await expect(dashboard.getByText('Your tax journey is empty')).toHaveCount(0);
  await expect(dashboard.getByText('Recorded payment')).toBeVisible();
  await expect(dashboard.getByText('No beneficiaries to show')).toBeVisible();
  await dashboard.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  await expect(dashboard.getByTestId('dashboard-overview-total')).toHaveText('৳0');
});

test('unavailable history must not masquerade as an empty account',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Owner-read outage regression');
  await mockAccount(page,'user2',false,true);
  const dashboard=page.getByTestId('dashboard-unified-preview');
  await expect(dashboard.getByTestId('dashboard-overview-total')).toHaveText('—');
  await expect(dashboard.getByText('Payment relationships unavailable')).toBeVisible();
  await expect(dashboard.getByText('Payment recipients unavailable')).toBeVisible();
  await expect(dashboard.getByText('Payment activity unavailable')).toBeVisible();
  await expect(dashboard.getByText('No payment relationships yet')).toHaveCount(0);
  await expect(dashboard.getByText('Your tax journey is empty')).toHaveCount(0);
  await expect(dashboard.locator('.taxpay-unified-donut')).toHaveCount(0);
});

test('User2 real preview History renderer preserves recorded dedicated-service categories',async({page},info)=>{
  const language=info.project.name==='mobile-320'?'bn':'en';
  const mobile=info.project.name.startsWith('mobile-');
  const records=['GIFT_TAX','TRAVEL_TAX','ADVANCE_TAX'].map((category,i)=>({
    id:'QA-HISTORY-0'+(i+1),transactionId:'00000000-0000-4000-8000-00000000090'+(i+1),
    payer:'user2',state:'SIMULATED',createdAt:'2026-11-15T10:00:00Z',simulationOnly:true,
    totalMinor:12345,reviewStatus:'PENDING_OFFICER',
    allocations:[{id:'allocation-'+i,lineNo:1,beneficiary:'user2',category,
      assessmentYear:'2026-27',amountMinor:12345}],events:[]
  }));
  // Test-only response, scoped to the fictional profile capability. No hosted writes.
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?*',route=>{
    if(route.request().headers()['x-taxpay-guest-capability']!==capability)
      return route.fulfill({status:403,contentType:'application/json',body:'{}'});
    return route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"data":[]}'});
  });
  await mockAccount(page,'user2',true,false,records,language);
  await expect(page.getByTestId('dashboard-unified-preview')).toHaveAttribute('data-account-id','user2');
  await page.goto('/?action=history&lang='+language);
  const panel=page.getByTestId('signed-in-payment-activity');
  const register=panel.getByTestId(mobile?'signed-in-payment-activity-cards':'signed-in-payment-activity-table');
  const rows=register.locator(mobile?':scope > li':'tbody tr');
  await expect(register).toBeVisible();
  await expect(rows).toHaveCount(3);
  const labels=language==='bn'?['দানকর','ভ্রমণ কর','অগ্রিম কর']:['Gift Tax','Travel Tax','Advance tax'];
  for(const [i,payment] of records.entries()){
    const row=rows.filter({hasText:payment.id});
    await expect(row).toBeVisible();
    await row.getByText(language==='bn'?'বরাদ্দ দেখুন':'View allocations',{exact:true}).click();
    await expect(row).toContainText(labels[i]);
    await row.getByRole('button',{name:language==='bn'?'বিস্তারিত দেখুন':'View details',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:language==='bn'?'পেমেন্টের বিবরণ':'Payment details'});
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(labels[i]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
  await page.reload();
  await expect(rows).toHaveCount(3);
});
