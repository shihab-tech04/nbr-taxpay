import {expect,test,type Page} from '@playwright/test';
import {setWorkspaceLanguage} from './workspace-language';

const projectRef='nbr-taxpay-test';
const supabaseUrl=`https://${projectRef}.invalid`;
const owner={
  id:'00000000-0000-4000-8000-000000000202',
  email:'private-dashboard-owner@example.invalid',
  aud:'authenticated',role:'authenticated',
  app_metadata:{provider:'email',providers:['email']},
  user_metadata:{taxpay_display_name:'Private dashboard owner'},
  created_at:'2026-01-01T00:00:00.000Z',
  last_sign_in_at:'2026-10-30T10:00:00.000Z',
};

function sessionFor(user:typeof owner){
  const expiresAt=Math.floor(Date.now()/1000)+3600;
  const payload=btoa(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp:expiresAt}));
  return {
    access_token:`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.synthetic-signature`,
    token_type:'bearer',expires_in:3600,expires_at:expiresAt,
    refresh_token:`synthetic-refresh-${user.id}`,user,
  };
}

const privateHistory=[{
  id:'SIM-PAY-OWNER-2026',
  transactionId:'00000000-0000-4000-8000-000000000901',
  payer:'user1',state:'SIMULATED',createdAt:'2026-10-28T10:00:00Z',
  simulationOnly:true,totalMinor:16450,reviewStatus:'PENDING_OFFICER',events:[],
  allocations:[
    {id:'own-2026',lineNo:1,beneficiary:'user2',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:6550},
    {id:'other-2026',lineNo:2,beneficiary:'user3',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:6450},
    {id:'own-2025',lineNo:3,beneficiary:'user2',category:'PENALTY',assessmentYear:'2025-26',amountMinor:3450},
  ],
}];

async function mockPrivateAccount(page:Page,profile:'user1'|'user2'|null,displayName?:string){
  // Optional identity variation isolates the privacy regression from all other
  // tests; it does not change the signed-in Auth UID or source owner scopes.
  const currentOwner=displayName===undefined?owner:{
    ...owner,user_metadata:{...owner.user_metadata,taxpay_display_name:displayName}
  };
  const session=sessionFor(currentOwner);
  await page.addInitScript(({key,value})=>{
    localStorage.setItem(key,JSON.stringify(value));
  },{key:`sb-${projectRef}-auth-token`,value:session});
  await page.route(`${supabaseUrl}/**`,async route=>{
    const request=route.request();
    const url=new URL(request.url());
    const json=(body:unknown,status=200,headers:Record<string,string>={})=>route.fulfill({
      status,contentType:'application/json',
      headers:{
        'access-control-allow-origin':'*',
        'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-allow-methods':'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
        ...headers,
      },body:JSON.stringify(body),
    });
    const ownerFromToken=()=>{
      const token=request.headers().authorization?.replace(/^Bearer\s+/i,'').split('.')[1];
      if(!token)return null;
      try{return (JSON.parse(atob(token)) as {sub?:string}).sub??null;}catch{return null;}
    };
    if(request.method()==='OPTIONS')return json({});
    if(url.pathname==='/auth/v1/user'&&request.method()==='GET'){
      expect(ownerFromToken()).toBe(owner.id);
      return json(currentOwner);
    }
    if(url.pathname==='/rest/v1/rpc/sim_my_taxpayer_profile'&&request.method()==='POST'){
      expect(ownerFromToken()).toBe(owner.id);
      return profile?json(profile):json({code:'42501',message:'No approved synthetic profile binding'},403);
    }
    if(url.pathname==='/rest/v1/rpc/sim_my_payment_history'&&request.method()==='POST'){
      expect(ownerFromToken()).toBe(owner.id);
      const body=request.postDataJSON() as {p_view:'payer'|'beneficiary'};
      const beneficiaryRows=profile==='user2'?privateHistory.map(row=>({
        ...row,allocations:row.allocations.filter(allocation=>allocation.beneficiary===profile),
      })):[];
      return json(body.p_view==='beneficiary'?beneficiaryRows:(profile==='user1'?privateHistory:[]));
    }
    if(url.pathname==='/rest/v1/taxpay_account_payment_form_drafts'||
       url.pathname==='/rest/v1/taxpay_payment_requests'||
       url.pathname==='/rest/v1/taxpay_correction_inquiries'||
       url.pathname==='/rest/v1/taxpay_in_app_notifications'){
      expect(ownerFromToken()).toBe(owner.id);
      const ownerFilter=url.searchParams.get('owner_uid')??url.searchParams.get('requester_uid')??url.searchParams.get('recipient_uid');
      expect(ownerFilter).toBe(`eq.${owner.id}`);
      const count=url.pathname.endsWith('payment_form_drafts')?1:url.pathname.endsWith('payment_requests')?2:url.pathname.endsWith('correction_inquiries')?1:1;
      return route.fulfill({status:200,headers:{
        'content-range':`0-0/${count}`,
        'access-control-expose-headers':'content-range, x-total-count',
        'access-control-allow-origin':'*',
        'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-allow-methods':'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
      },body:''});
    }
    return json({message:'Blocked by the account-dashboard browser test'},403);
  });
}

test('payer-owned monthly chart uses selected assessment-year allocations without crediting recipients',async({page})=>{
  await mockPrivateAccount(page,'user1');
  await page.setViewportSize({width:375,height:820});
  await page.goto('/?action=taxpayer_home');
  const summary=page.getByTestId('account-workflow-summary');
  const monthly=summary.getByTestId('account-scenario-monthly');
  await expect(monthly).toBeVisible();
  await expect(monthly.getByRole('heading',{name:'Monthly payment activity'})).toBeVisible();
  await expect(monthly.locator('[data-month="2026-10"]')).toHaveAttribute('data-amount-minor','13000');
  await expect(monthly).toContainText('not Treasury-confirmed payments or tax credits');
  const correction=page.locator('#dashboard-correction-requests');
  const [activityBox,correctionBox]=await Promise.all([summary.boundingBox(),correction.boundingBox()]);
  expect(activityBox&&correctionBox).toBeTruthy();
  expect(activityBox!.y).toBeLessThan(correctionBox!.y);
  await summary.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(monthly.locator('[data-month="2026-10"]')).toHaveAttribute('data-amount-minor','3450');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await setWorkspaceLanguage(page,'bn');
  await expect(monthly.getByRole('heading',{name:'মাসভিত্তিক পেমেন্ট কার্যক্রম'})).toBeVisible();
});

test('record count follows the selected assessment year, not the all-year total',async({page})=>{
  await mockPrivateAccount(page,'user2');
  await page.route(`${supabaseUrl}/rest/v1/rpc/sim_my_payment_history`,async route=>{
    const request=route.request();
    const body=request.postDataJSON() as {p_view:'payer'|'beneficiary'};
    if(body.p_view!=='beneficiary')return route.fallback();
    const additional={
      ...privateHistory[0],id:'SIM-PAY-OWNER-2025-SECOND',
      transactionId:'00000000-0000-4000-8000-000000000902',
      totalMinor:2000,createdAt:'2026-01-10T09:00:00Z',
      allocations:[{id:'additional-2025',lineNo:1,beneficiary:'user2',category:'PENALTY',assessmentYear:'2025-26',amountMinor:2000}],
    };
    const first={...privateHistory[0],
      allocations:privateHistory[0].allocations.filter(a=>a.beneficiary==='user2')};
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},body:JSON.stringify([first,additional])});
  });
  await page.goto('/?action=taxpayer_home');
  const dashboard=page.getByTestId('account-workflow-summary');
  const countCard=dashboard.getByText('Scenario payment records').locator('..');
  await expect(countCard.locator('p').last()).toHaveText('1');
  await dashboard.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(countCard.locator('p').last()).toHaveText('2');
  await setWorkspaceLanguage(page,'bn');
  await expect(dashboard.getByText('সিনারিও পেমেন্ট রেকর্ড').locator('..').locator('p').last()).toHaveText('২');
});

test('verified profile shows owner-scoped activity, linked scenario allocations and assessment-year filtering',async({page})=>{
  await mockPrivateAccount(page,'user2');
  await page.goto('/?action=taxpayer_home');
  const dashboard=page.getByTestId('account-workflow-summary');
  await expect(dashboard).toBeVisible();
  // No verified external assessment: the first row must be absent, not placeholders or sample amounts.
  await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(0);
  await expect(page.getByTestId('authenticated-overview-bento')).toHaveCount(0);
  const phase=page.getByTestId('authenticated-dashboard-v11');
  await expect(phase).toBeVisible();
  await expect(phase.getByText('Coverage details are not available yet')).toBeVisible();
  await expect(phase.getByText('A verified assessment and confirmed posted tax credits are needed to show how much is covered.')).toBeVisible();
  await expect(phase.getByRole('img',{name:'Illustrative liability coverage'})).toHaveCount(0);
  await expect(phase.getByRole('heading',{name:'What needs your attention'})).toBeVisible();
  await expect(phase).toContainText('No verified payment deadlines are available yet');
  await expect(phase.getByRole('button',{name:'Requests & drafts'})).toBeVisible();
  await expect(phase.getByRole('button',{name:'Correction inquiries'})).toBeVisible();
  await expect(phase).not.toContainText('Needs review');
  await expect(page.getByText('Verified tax totals and posted tax credits for this year are not linked to this account. Check your tax ledger below for available records.')).toBeVisible();
  await expect(phase).toContainText('A deadline appears here only when a verified assessment or tax notice is linked to this account.');
  await expect(phase.getByText('Already covered').first()).toBeVisible();
  await expect(phase.getByText('Still remaining').first()).toBeVisible();
  await expect(phase.getByRole('button',{name:'Check tax ledger'})).toBeVisible();
  for (const heading of ['Quick actions','How your tax is covered','By tax year','Already covered','Tax summary for this year']) {
    await expect(phase.getByRole('heading',{name:heading})).toBeVisible();
  }
  await expect(phase.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
  // A signed-in account must use the approved Phase A/B visual sections, but
  // private scenario allocations never become government liability or credits.
  await expect(phase.getByRole('region',{name:'Tax summary for this year'})).toContainText('—');
  await expect(phase.getByRole('table',{name:'Posted credit components'})).toHaveCount(0);
  await expect(phase.getByText('Tax credit details are not available yet')).toBeVisible();
  await expect(phase.getByText('A payment request or receipt alone does not confirm a posted tax credit. Only verified credits linked to this account appear here.')).toBeVisible();
  await expect(phase).not.toContainText('৳ 180,000');
  // Sample mode is explicit, reversible and never mutates SQL or changes the
  // meaning of owner-owned activity. It reuses the existing v11 example ledger.
  const writes:string[]=[];
  page.on('request',request=>{
    if(/\/rest\/v1\/(taxpay_payment_requests|taxpay_payment_drafts|taxpay_request_events)/.test(request.url())&&
       ['POST','PATCH','PUT','DELETE'].includes(request.method()))writes.push(request.url());
  });
  const examples=page.getByTestId('dashboard-example-controls');
  await examples.getByRole('button',{name:'View examples'}).click();
  await expect(examples).toContainText('not your tax records');
  await expect(examples.getByRole('button',{name:'Hide examples'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('combobox',{name:'Assessment year'}).first()).toHaveValue('2025-2026');
  await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(0);
  await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(0);
  await expect(phase.getByRole('table',{name:'Posted credit components'})).toContainText('৳ 155,000');
  await expect(phase.getByText('Tax credit details are not available yet')).toHaveCount(0);
  await expect(phase.getByRole('img',{name:'Illustrative liability coverage'})).toBeVisible();
  await expect(phase.getByText('Coverage details are not available yet')).toHaveCount(0);
  await expect(phase.getByRole('region',{name:'Tax summary for this year'})).toContainText('৳ 6,500');
  await expect(phase.getByRole('region',{name:'Example monthly activity chart'})).toHaveCount(0);
  await expect(phase.getByRole('heading',{name:'By tax year'})).toBeVisible();
  await phase.getByRole('button',{name:'2024-2025'}).click();
  await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(0);
  await examples.getByRole('button',{name:'Hide examples'}).click();
  await expect(examples.getByRole('button',{name:'View examples'})).toHaveAttribute('aria-pressed','false');
  await expect(page.getByRole('combobox',{name:'Assessment year'}).first()).toHaveValue('2026-2027');
  await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(0);
  await expect(phase.getByRole('table',{name:'Posted credit components'})).toHaveCount(0);
  await expect(phase.getByText('Tax credit details are not available yet')).toBeVisible();
  await expect(phase.getByText('A payment request or receipt alone does not confirm a posted tax credit. Only verified credits linked to this account appear here.')).toBeVisible();
  expect(writes).toEqual([]);

  await expect(dashboard).toContainText('৳ 65.50');
  await expect(dashboard).not.toContainText('৳ 164.50');
  const yearRow=phase.getByRole('button',{name:'2025-2026'});
  await yearRow.click();
  await expect(yearRow).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('combobox',{name:'Assessment year'}).first()).toHaveValue('2025-2026');
  await expect(dashboard.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2025-26');
  await expect(dashboard).toContainText('৳ 34.50');
  await expect(dashboard).not.toContainText('৳ 65.50');
  await expect(page.getByRole('button',{name:'Review payment options'})).toHaveCount(0);
  await expect(dashboard).toContainText('Private dashboard owner');
  await expect(dashboard).toContainText('linked scenario profile user2 · Meghna Trading Ltd.');
  await expect(dashboard.getByTestId('account-dashboard-status-summary')).toContainText('Saved Drafts');
  // A beneficiary-only account has received activity but no payer-owned
  // category chart. Showing one here would incorrectly claim spending.
  await expect(dashboard.getByTestId('account-payment-category-breakdown')).toHaveCount(0);
  await dashboard.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(dashboard).toContainText('৳ 34.50');
  await expect(dashboard).not.toContainText('৳ 65.50');
  await setWorkspaceLanguage(page,'bn');
  await expect(phase.getByText('কর সমন্বয়ের তথ্য এখনও পাওয়া যায়নি')).toBeVisible();
  await expect(phase.getByText('কর ক্রেডিটের তথ্য এখনও পাওয়া যায়নি')).toBeVisible();
  await expect(phase.getByRole('heading',{name:'ইতোমধ্যে সমন্বিত কর'})).toBeVisible();
  await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(0);
  await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(0);
  await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(0);
  await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(0);
  await expect(phase.getByRole('heading',{name:'যে বিষয়ে খেয়াল রাখা দরকার'})).toBeVisible();
  await expect(phase.getByRole('heading',{name:'দ্রুত কাজ'})).toBeVisible();
  await expect(phase.getByRole('button',{name:'অনুরোধ ও খসড়া'})).toBeVisible();
  await expect(page.getByText('এই করবর্ষের যাচাইকৃত করের পরিমাণ ও নথিভুক্ত কর ক্রেডিট এই অ্যাকাউন্টে যুক্ত নেই। পাওয়া তথ্য দেখতে নিচের কর লেজার দেখুন।')).toBeVisible();
  await expect(phase).toContainText('যাচাইকৃত পরিশোধের শেষ তারিখ এখনও পাওয়া যায়নি');
  await expect(dashboard.getByRole('heading',{name:'আমার অ্যাকাউন্টের কার্যক্রম'})).toBeVisible();
  await expect(dashboard).toContainText('৳ ৩৪.৫০');
  const refreshedHistory=page.waitForRequest(request=>request.url().endsWith('/rest/v1/rpc/sim_my_payment_history')&&request.method()==='POST');
  await dashboard.getByRole('button',{name:'অ্যাকাউন্টের কার্যক্রম হালনাগাদ করুন'}).click();
  await refreshedHistory;
  // Refresh can replace the account summary while its request resolves. Wait
  // for the visible control to return to idle before testing navigation.
  await expect(dashboard.getByRole('button',{name:'অ্যাকাউন্টের কার্যক্রম হালনাগাদ করুন'})).toBeEnabled();
  await dashboard.getByRole('button',{name:'প্রোফাইল দেখুন'}).click();
  await expect(page).toHaveURL(/action=account_profile(?:&|$)/);
  await expect(page.getByRole('heading',{name:'প্রোফাইল',exact:true,level:1})).toBeVisible();
  const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+1);
});

test('ordinary verified account without a taxpayer binding sees no financial sample data',async({page})=>{
  await mockPrivateAccount(page,null);
  await page.goto('/?action=taxpayer_home');
  const dashboard=page.getByTestId('account-workflow-summary');
  await expect(dashboard).toBeVisible();
  await expect(dashboard).toContainText('Private dashboard owner');
  await expect(dashboard).toContainText('no taxpayer profile linked');
  await expect(dashboard).toContainText('No payment profile is linked to this application account.');
  await expect(page.getByRole('heading',{name:'Already covered'})).toBeVisible();
  await expect(page.getByText('Tax credit details are not available yet')).toBeVisible();
  await expect(page.getByRole('table',{name:'Posted credit components'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Tax summary for this year'})).toContainText('—');
  await dashboard.getByRole('combobox',{name:'Assessment year'}).selectOption('2024-25');
  await expect(dashboard.getByTestId('account-payment-category-breakdown')).toHaveCount(0);
  await expect(dashboard.getByText(/৳/)).toHaveCount(0);
  await setWorkspaceLanguage(page,'bn');
  await expect(dashboard).toContainText('এই অ্যাপ অ্যাকাউন্টে কোনো পেমেন্ট প্রোফাইল সংযুক্ত নেই।');
  await expect(page.getByRole('heading',{name:'ইতোমধ্যে সমন্বিত কর'})).toBeVisible();
  await expect(page.getByText('কর ক্রেডিটের তথ্য এখনও পাওয়া যায়নি')).toBeVisible();
  await expect(dashboard.getByText(/৳/)).toHaveCount(0);
});


test('bound SQL ledger keeps historical and new mixed-year allocations independently filterable',async({page})=>{
  await mockPrivateAccount(page,'user2');
  await page.goto('/?action=ledger');
  const ledger=page.getByTestId('event-tax-ledger');
  await expect(ledger).toBeVisible();
  await ledger.getByRole('button',{name:'Filter',exact:true}).click();
  const years=ledger.getByRole('combobox',{name:'Filter ledger by year'});
  await years.selectOption('2026-27');
  await expect(ledger.locator('tbody tr')).toHaveCount(1);
  await ledger.getByRole('button',{name:/Payment record present/}).first().click();
  await expect(page.getByTestId('tax-event-details')).toContainText('৳ 65.50');
  await page.getByRole('dialog').getByRole('button',{name:'Close modal'}).click();
  await years.selectOption('2025-26');
  await expect(ledger.locator('tbody tr')).toHaveCount(1);
  await ledger.getByRole('button',{name:/Payment record present/}).first().click();
  await expect(page.getByTestId('tax-event-details')).toContainText('৳ 34.50');
  await expect(page.getByTestId('tax-event-details')).not.toContainText('৳ 65.50');
  await expect(ledger).not.toContainText('৳ 164.50');
});

test('completed summary and amounts count only successful payer records in the selected year',async({page})=>{
  await mockPrivateAccount(page,'user1');
  await page.route(`${supabaseUrl}/rest/v1/rpc/sim_my_payment_history`,async route=>{
    const body=route.request().postDataJSON() as {p_view:'payer'|'beneficiary'};
    if(body.p_view!=='payer')return route.fallback();
    const second={
      ...privateHistory[0],id:'SIM-PAY-2025-SECOND',
      transactionId:'00000000-0000-4000-8000-000000000903',
      totalMinor:2500,createdAt:'2026-01-10T09:00:00Z',
      allocations:[{id:'second-2025',lineNo:1,beneficiary:'user2',
        category:'PENALTY',assessmentYear:'2025-26',amountMinor:2500}],
    };
    const failed={
      ...second,id:'SIM-PAY-2025-FAILED',
      transactionId:'00000000-0000-4000-8000-000000000904',
      state:'FAILED',totalMinor:5000,
      allocations:[{id:'failed-2025',lineNo:1,beneficiary:'user2',
        category:'PENALTY',assessmentYear:'2025-26',amountMinor:5000}],
    };
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify([...privateHistory,second,failed])});
  });
  await page.goto('/?action=taxpayer_home');
  const dashboard=page.getByTestId('account-workflow-summary');
  const completed=dashboard.getByTestId('account-dashboard-status-summary')
    .getByText('Completed Payments',{exact:true}).locator('..');
  await expect(completed.locator('p').nth(1)).toHaveText('1');
  await dashboard.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(completed.locator('p').nth(1)).toHaveText('2');
  const totals=dashboard.getByTestId('dashboard-payment-role-totals');
  await expect(totals.getByTestId('dashboard-payer-total')).toHaveText('৳ 59.50');
  await expect(totals.getByTestId('dashboard-self-paid-total')).toHaveText('—');
  await expect(totals.getByTestId('dashboard-paid-for-others-total')).toHaveText('৳ 59.50');
  await expect(totals.getByTestId('dashboard-received-total')).toHaveText('—');
  await setWorkspaceLanguage(page,'bn');
  await expect(dashboard.getByTestId('account-dashboard-status-summary')
    .getByText('সম্পন্ন পেমেন্ট',{exact:true}).locator('..').locator('p').nth(1)).toHaveText('২');
  await expect(totals).toContainText('পরিশোধকারীর মোট');
});


test('beneficiary-only signed-in dashboard does not present payments made by someone else as my spending',async({page})=>{
  await mockPrivateAccount(page,'user2');
  await page.goto('/?action=taxpayer_home');
  const dashboard=page.getByTestId('account-workflow-summary');
  await dashboard.getByRole('combobox',{name:'Assessment year'}).selectOption('2026-27');
  const completed=dashboard.getByTestId('account-dashboard-status-summary')
    .getByText('Completed Payments',{exact:true}).locator('..');
  await expect(completed.locator('p').nth(1)).toHaveText('0');
  const totals=dashboard.getByTestId('dashboard-payment-role-totals');
  await expect(totals.getByTestId('dashboard-payer-total')).toHaveText('—');
  await expect(totals.getByTestId('dashboard-self-paid-total')).toHaveText('—');
  await expect(totals.getByTestId('dashboard-paid-for-others-total')).toHaveText('—');
  await expect(totals.getByTestId('dashboard-received-total')).toHaveText('৳ 65.50');
  await expect(dashboard.getByTestId('account-payment-category-breakdown')).toHaveCount(0);
  // Received activity is not payer spending and therefore has no tag-spend panel.
  await expect(dashboard.getByTestId('account-beneficiary-spending')).toHaveCount(0);
  await expect(dashboard.getByTestId('account-scenario-monthly'))
    .toContainText('No completed payments initiated by this account');
  // The received transaction is still visible in Activity.
  await expect(dashboard.getByRole('list',{name:'Recent scenario transactions'})).toBeVisible();
});

test('role totals count each payer parent once and follow the selected-year allocations',async({page})=>{
  await mockPrivateAccount(page,'user1');
  const payer={
    id:'SIM-PAY-DASHBOARD-PARENT',transactionId:'00000000-0000-4000-8000-000000000951',
    payer:'user1',state:'SIMULATED',createdAt:'2026-10-28T10:00:00Z',
    simulationOnly:true,totalMinor:35000,reviewStatus:'PENDING_OFFICER',events:[],
    allocations:[
      {id:'dashboard-self-2026',lineNo:1,beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:10000},
      {id:'dashboard-other-2026',lineNo:2,beneficiary:'user2',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:20000},
      {id:'dashboard-self-2025',lineNo:3,beneficiary:'user1',category:'PENALTY',assessmentYear:'2025-26',amountMinor:3000},
      {id:'dashboard-other-2025',lineNo:4,beneficiary:'user3',category:'SOURCE_TAX_DEPOSIT',assessmentYear:'2025-26',amountMinor:2000},
    ],
  };
  const received={
    id:'SIM-PAY-DASHBOARD-RECEIVED',transactionId:'00000000-0000-4000-8000-000000000952',
    payer:'user2',state:'SIMULATED',createdAt:'2026-10-29T10:00:00Z',
    simulationOnly:true,totalMinor:8500,reviewStatus:'PENDING_OFFICER',events:[],
    allocations:[
      {id:'dashboard-received-2026',lineNo:1,beneficiary:'user1',category:'PENALTY',assessmentYear:'2026-27',amountMinor:4500},
      {id:'dashboard-received-2025',lineNo:2,beneficiary:'user1',category:'SOURCE_TAX_DEPOSIT',assessmentYear:'2025-26',amountMinor:2500},
    ],
  };
  await page.route(supabaseUrl+'/rest/v1/rpc/sim_my_payment_history',async route=>{
    const body=route.request().postDataJSON() as {p_view:'payer'|'beneficiary'};
    const beneficiaryRows=[
      {...payer,allocations:payer.allocations.filter(allocation=>allocation.beneficiary==='user1')},
      received,
    ];
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify(body.p_view==='payer'?[payer]:beneficiaryRows)});
  });
  await page.goto('/?action=taxpayer_home');
  const dashboard=page.getByTestId('account-workflow-summary');
  const totals=dashboard.getByTestId('dashboard-payment-role-totals');
  await expect(totals.getByTestId('dashboard-payer-total')).toHaveText('৳ 300.00');
  await expect(totals.getByTestId('dashboard-self-paid-total')).toHaveText('৳ 100.00');
  await expect(totals.getByTestId('dashboard-paid-for-others-total')).toHaveText('৳ 200.00');
  await expect(totals.getByTestId('dashboard-received-total')).toHaveText('৳ 45.00');
  await dashboard.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(totals.getByTestId('dashboard-payer-total')).toHaveText('৳ 50.00');
  await expect(totals.getByTestId('dashboard-self-paid-total')).toHaveText('৳ 30.00');
  await expect(totals.getByTestId('dashboard-paid-for-others-total')).toHaveText('৳ 20.00');
  await expect(totals.getByTestId('dashboard-received-total')).toHaveText('৳ 25.00');
  await setWorkspaceLanguage(page,'bn');
  await expect(totals).toContainText('পরিশোধকারীর মোট');
  await expect(totals).toContainText('অন্য পরিশোধকারীর কাছ থেকে প্রাপ্ত');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('linked empty account shows verified no-data guidance without fictional amounts',async({page})=>{
  await mockPrivateAccount(page,'user1');
  await page.route(supabaseUrl+'/rest/v1/**',async route=>{
    const request=route.request();
    const url=new URL(request.url());
    if(request.method()==='OPTIONS')return route.fallback();
    const token=request.headers().authorization?.replace(/^Bearer\s+/i,'').split('.')[1];
    expect(token).toBeTruthy();
    expect((JSON.parse(atob(token!)) as {sub?:string}).sub).toBe(owner.id);
    if(url.pathname==='/rest/v1/rpc/sim_my_payment_history'){
      return route.fulfill({status:200,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},body:'[]'});
    }
    if([
      '/rest/v1/taxpay_account_payment_form_drafts',
      '/rest/v1/taxpay_payment_requests',
      '/rest/v1/taxpay_correction_inquiries',
      '/rest/v1/taxpay_in_app_notifications',
    ].includes(url.pathname)){
      const ownerFilter=url.searchParams.get('owner_uid')??url.searchParams.get('requester_uid')??url.searchParams.get('recipient_uid');
      expect(ownerFilter).toBe('eq.'+owner.id);
      return route.fulfill({status:200,headers:{
        'content-range':'*/0','access-control-expose-headers':'content-range, x-total-count',
        'access-control-allow-origin':'*',
      },body:''});
    }
    return route.fallback();
  });
  await page.goto('/?action=taxpayer_home');
  const dashboard=page.getByTestId('account-workflow-summary');
  await expect(dashboard).toContainText('No stored payment activity is linked to this scenario profile.');
  await expect(dashboard.getByTestId('account-scenario-monthly'))
    .toContainText('No completed payments initiated by this account');
  await expect(dashboard.getByTestId('dashboard-payment-role-totals')).toHaveCount(0);
  await expect(dashboard.getByTestId('account-payment-category-breakdown')).toHaveCount(0);
  await expect(dashboard.getByTestId('account-beneficiary-spending')).toHaveCount(0);
  await expect(dashboard.getByRole('list',{name:'Recent scenario transactions'})).toHaveCount(0);
  await expect(dashboard.getByTestId('account-dashboard-status-summary')).toContainText('Completed Payments');
  await expect(dashboard.getByTestId('account-dashboard-status-summary').locator('article').first())
    .toContainText('0');
  await expect(dashboard.getByText(/৳/)).toHaveCount(0);
  await setWorkspaceLanguage(page,'bn');
  await expect(dashboard).toContainText('এই সিনারিও প্রোফাইলে কোনো সংরক্ষিত পেমেন্ট কার্যক্রম নেই।');
  await expect(dashboard.getByTestId('account-scenario-monthly'))
    .toContainText('নির্বাচিত করবর্ষে এই অ্যাকাউন্ট থেকে সম্পন্ন কোনো পেমেন্ট নেই।');
  await expect(dashboard.getByText(/৳/)).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('recent-activity filter preserves yearly owner totals and supplies bilingual empty/recovery states',async({page})=>{
  await mockPrivateAccount(page,'user1');
  await page.goto('/?action=taxpayer_home&lang=en');
  const account=page.getByTestId('account-workflow-summary');
  const filter=account.getByTestId('dashboard-recent-service-filter');
  await expect(filter).toBeVisible();
  const parentCount=account.getByTestId('account-dashboard-status-summary');
  await expect(parentCount).toContainText('Completed Payments');
  const list=account.getByTestId('dashboard-recent-activity-list');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('SIM-PAY-OWNER-2026');
  const before=await parentCount.innerText();
  const totals=account.getByTestId('dashboard-payment-role-totals');
  const originalTotal=await totals.innerText();

  await filter.selectOption('SOURCE_TAX_DEPOSIT');
  const empty=account.getByTestId('dashboard-recent-activity-empty');
  await expect(empty).toContainText('No recent payment activity matches this service');
  await expect(account.getByTestId('dashboard-recent-activity-list')).toHaveCount(0);
  await expect(parentCount).toHaveText(before);
  await expect(totals).toHaveText(originalTotal);

  await filter.selectOption('ADVANCE_TAX');
  await expect(list).toContainText('SIM-PAY-OWNER-2026');
  await expect(empty).toHaveCount(0);
  await filter.selectOption('PENALTY');
  await expect(empty).toBeVisible();
  await account.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(list).toContainText('SIM-PAY-OWNER-2026');
  await expect(empty).toHaveCount(0);
  await filter.selectOption('all');

  await setWorkspaceLanguage(page,'bn');
  const banglaFilter=account.getByRole('combobox',{name:'সাম্প্রতিক কার্যক্রম সেবাভিত্তিক ফিল্টার'});
  await expect(banglaFilter).toHaveValue('all');
  await banglaFilter.selectOption('SOURCE_TAX_DEPOSIT');
  await expect(account.getByTestId('dashboard-recent-activity-empty'))
    .toContainText('নির্বাচিত করবর্ষে এই সেবার কোনো সাম্প্রতিক');
  await banglaFilter.selectOption('PENALTY');
  await expect(account.getByTestId('dashboard-recent-activity-list')).toContainText('SIM-PAY-OWNER-2026');
  expect(await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('dashboard correction shortcut focuses the existing request register and lists all authorized years',async({page})=>{
  await mockPrivateAccount(page,'user1');
  await page.goto('/?action=taxpayer_home&lang=en');
  const phase=page.getByTestId('authenticated-dashboard-v11');
  const years=await page.getByRole('combobox',{name:'Assessment year'}).first().locator('option').allTextContents();
  for(const year of years.filter(value=>/^20\d{2}-20\d{2}$/.test(value.trim()))){
    await expect(phase.getByRole('button',{name:year.trim(),exact:true})).toHaveCount(1);
  }
  await phase.getByRole('button',{name:'Correction inquiries'}).click();
  await expect(page.locator('#dashboard-correction-requests')).toBeFocused();
  await setWorkspaceLanguage(page,'bn');
  await phase.getByRole('button',{name:'সংশোধনের অনুসন্ধান'}).click();
  await expect(page.locator('#dashboard-correction-requests')).toBeFocused();
  expect(await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});


test('dashboard never exposes the full fallback email and financial breakdown remains accessible across English/Bangla',async({page})=>{
  await mockPrivateAccount(page,'user1','');
  await page.goto('/?action=taxpayer_home&lang=en');
  const dashboard=page.getByTestId('account-workflow-summary');
  await expect(dashboard.getByText('pri****@example.invalid',{exact:true})).toBeVisible();
  await expect(dashboard).not.toContainText('private-dashboard-owner@example.invalid');
  const category=dashboard.getByTestId('account-payment-category-breakdown');
  const rows=category.getByRole('list',{name:'Category amounts for private scenario records'});
  await expect(rows).toBeVisible();
  await expect(rows.getByRole('listitem')).toHaveCount(2);
  await expect(rows.getByRole('listitem').first()).toContainText('Tax with return');
  await expect(rows.getByRole('listitem').first()).toContainText('৳ 65.50');
  await expect(rows.getByRole('listitem').nth(1)).toContainText('৳ 64.50');
  await expect(category).not.toContainText('৳ 164.50');
  await expect(dashboard.getByTestId('dashboard-tag-classification-note'))
    .toContainText('current saved tags');
  await setWorkspaceLanguage(page,'bn');
  await expect(dashboard.getByText('pri****@example.invalid',{exact:true})).toBeVisible();
  await expect(dashboard).not.toContainText('private-dashboard-owner@example.invalid');
  await expect(dashboard.getByRole('list',{name:'ব্যক্তিগত সিনারিও রেকর্ডের খাতভিত্তিক পরিমাণ'})
    .getByRole('listitem')).toHaveCount(2);
  await expect(dashboard.getByTestId('dashboard-tag-classification-note'))
    .toContainText('বর্তমান সংরক্ষিত ট্যাগ');
  expect(await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('private recent activity has an owner-scoped history action with localized accessible reference',async({page})=>{
  await mockPrivateAccount(page,'user1');
  await page.goto('/?action=taxpayer_home&lang=bn');
  const dashboard=page.getByTestId('account-workflow-summary');
  const refButton=dashboard.getByTestId('dashboard-recent-history-00000000-0000-4000-8000-000000000901');
  await expect(refButton).toBeVisible();
  await expect(refButton).toHaveAccessibleName(/রেফারেন্স খুঁজতে পেমেন্ট ইতিহাস খুলুন SIM-PAY-OWNER-2026/);
  await refButton.click();
  await expect(page).toHaveURL(/action=history/);
  await expect(page.getByTestId('account-workflow-summary')).toHaveCount(0);
});

test('F-122 signed-in mobile bottom navigation survives scrolling, language switch and refresh',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await mockPrivateAccount(page,'user1');
  await page.goto('/?action=taxpayer_home&lang=en');
  await expect(page.getByTestId('account-workflow-summary')).toBeVisible();
  const nav=page.getByRole('navigation',{name:'Mobile primary navigation'});
  const pay=page.getByRole('button',{name:'Pay — select payment type'});
  await expect(nav).toBeVisible();
  for(const name of ['Overview','Activity','Tax Ledger']){
    await expect(nav.getByRole('button',{name,exact:true})).toBeVisible();
  }
  await expect(pay).toBeVisible();

  // This scroll distance used to trigger compact mode and remove the dock.
  await page.evaluate(()=>window.scrollTo(0,400));
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(145);
  await expect(nav).toBeVisible();
  await expect(pay).toBeVisible();
  await expect(page.locator('header.citizen-header--hidden')).toHaveCount(0);
  await expect(page.locator('.citizen-corner--bottom-left')).toHaveCount(0);

  await setWorkspaceLanguage(page,'bn');
  const banglaNav=page.getByRole('navigation',{name:'মোবাইল প্রধান নেভিগেশন'});
  await expect(banglaNav).toBeVisible();
  for(const name of ['সংক্ষিপ্ত বিবরণ','লেনদেন','কর লেজার']){
    await expect(banglaNav.getByRole('button',{name,exact:true})).toBeVisible();
  }
  await page.evaluate(()=>window.scrollTo(0,440));
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(145);
  await expect(banglaNav).toBeVisible();
  await expect(page.getByRole('button',{name:'কর পরিশোধের ধরন নির্বাচন'})).toBeVisible();
  await page.reload();
  await expect(banglaNav).toBeVisible();
  await expect(page.getByRole('button',{name:'কর পরিশোধের ধরন নির্বাচন'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('F-123 signed-in Pay menu has predictable EN/BN arrow, Home/End and Escape keyboard recovery',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await mockPrivateAccount(page,'user1');
  await page.goto('/?action=taxpayer_home&lang=en');
  await expect(page.getByTestId('account-workflow-summary')).toBeVisible();
  const pay=page.getByRole('button',{name:'Pay — select payment type'});
  await pay.click();
  const menu=page.getByRole('menu',{name:'Payment options'});
  const payTax=menu.getByRole('menuitem',{name:'Pay Tax'});
  const travel=menu.getByRole('menuitem',{name:'Travel Tax'});
  await expect(payTax).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(travel).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(payTax).toBeFocused();
  await page.keyboard.press('End');
  await expect(travel).toBeFocused();
  await page.keyboard.press('Home');
  await expect(payTax).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(travel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(pay).toBeFocused();

  await setWorkspaceLanguage(page,'bn');
  const banglaPay=page.getByRole('button',{name:'কর পরিশোধের ধরন নির্বাচন'});
  await banglaPay.click();
  const banglaMenu=page.getByRole('menu',{name:'পরিশোধের ধরন'});
  await expect(banglaMenu.getByRole('menuitem',{name:'কর পরিশোধ'})).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(banglaMenu.getByRole('menuitem',{name:'ভ্রমণ কর'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(banglaMenu).toHaveCount(0);
  await expect(banglaPay).toBeFocused();
  await expect(page.getByRole('navigation',{name:'মোবাইল প্রধান নেভিগেশন'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('F-099 correction shortcuts focus the embedded register and recover to the corrections page when missing',async({page})=>{
  await mockPrivateAccount(page,'user1');
  await page.goto('/?action=taxpayer_home&lang=en');
  const account=page.getByTestId('account-workflow-summary');
  const correction=page.locator('#dashboard-correction-requests');
  await expect(correction).toBeVisible();
  const correctionCard=account.getByTestId('account-dashboard-status-summary').locator('article').nth(2);
  await expect(correctionCard).toContainText('Correction Requests');
  await correctionCard.getByRole('button',{name:'Open records'}).click();
  await expect(correction).toBeFocused();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await setWorkspaceLanguage(page,'bn');
  const shortcut=account.getByRole('navigation',{name:'অ্যাকাউন্ট শর্টকাট'}).getByRole('button',{name:'সংশোধন'});
  await expect(shortcut).toBeVisible();
  await shortcut.click();
  await expect(correction).toBeFocused();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  // When the embedded register is not mounted, the existing dedicated page
  // must remain reachable; the action must not silently do nothing.
  await correction.evaluate(node=>node.remove());
  await shortcut.click();
  await expect(page).toHaveURL(/action=corrections(?:&|$)/);
});

test('F-099 correction status-card fallback works without embedded register in English',async({page})=>{
  await mockPrivateAccount(page,'user1');
  await page.goto('/?action=taxpayer_home&lang=en');
  const correction=page.locator('#dashboard-correction-requests');
  await expect(correction).toBeAttached();
  await correction.evaluate(node=>node.remove());
  const correctionCard=page.getByTestId('account-dashboard-status-summary').locator('article').nth(2);
  await correctionCard.getByRole('button',{name:'Open records'}).click();
  await expect(page).toHaveURL(/action=corrections(?:&|$)/);
});
