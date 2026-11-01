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

async function mockPrivateAccount(page:Page,profile:'user2'|null){
  const session=sessionFor(owner);
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
      return json(owner);
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
      return json(body.p_view==='beneficiary'?beneficiaryRows:[]);
    }
    if(url.pathname==='/rest/v1/taxpay_payment_drafts'||
       url.pathname==='/rest/v1/taxpay_payment_requests'||
       url.pathname==='/rest/v1/taxpay_correction_inquiries'||
       url.pathname==='/rest/v1/taxpay_in_app_notifications'){
      expect(ownerFromToken()).toBe(owner.id);
      const ownerFilter=url.searchParams.get('owner_uid')??url.searchParams.get('requester_uid')??url.searchParams.get('recipient_uid');
      expect(ownerFilter).toBe(`eq.${owner.id}`);
      const count=url.pathname.endsWith('payment_drafts')?1:url.pathname.endsWith('payment_requests')?2:url.pathname.endsWith('correction_inquiries')?1:1;
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

test('verified profile shows owner-scoped activity, linked scenario allocations and assessment-year filtering',async({page})=>{
  await mockPrivateAccount(page,'user2');
  await page.goto('/?action=taxpayer_home');
  const dashboard=page.getByTestId('account-workflow-summary');
  await expect(dashboard).toBeVisible();
  // Verified account uses the same approved financial KPI cards as the static
  // reference, but must never inherit user1's fabricated assessed balances.
  const financialCards=page.locator('.taxpayer-dashboard-kpi');
  await expect(financialCards).toHaveCount(4);
  await expect(financialCards.nth(0)).toContainText('Income tax liability');
  await expect(financialCards.nth(0)).toContainText('—');
  await expect(financialCards.nth(3)).toHaveClass(/taxpayer-dashboard-kpi--balance/);
  const phase=page.getByTestId('authenticated-dashboard-v11');
  await expect(phase).toBeVisible();
  for (const heading of ['Needs review','Tax coverage','Monthly activity','By assessment year','How your credits are made up','Current tax position']) {
    await expect(phase.getByRole('heading',{name:heading})).toBeVisible();
  }
  // A signed-in account must use the approved Phase A/B visual sections, but
  // private scenario allocations never become government liability or credits.
  await expect(phase.getByRole('region',{name:'Current tax position'})).toContainText('—');
  await expect(phase.getByRole('table',{name:'Posted credit components'})).not.toContainText('৳');
  await expect(phase).not.toContainText('৳ 180,000');
  const yearRow=phase.getByRole('button',{name:'2025-2026'});
  await yearRow.click();
  await expect(yearRow).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('combobox',{name:'Assessment year'}).first()).toHaveValue('2025-2026');
  await expect(dashboard.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2025-26');
  await expect(page.getByRole('button',{name:'Review payment options'})).toHaveCount(0);
  await expect(dashboard).toContainText('Private dashboard owner');
  await expect(dashboard).toContainText('linked scenario profile user2 · Meghna Trading Ltd.');
  await expect(dashboard.getByText('Payment requests')).toBeVisible();
  await expect(dashboard.getByTestId('account-payment-category-breakdown')).toBeVisible();
  await expect(dashboard).toContainText('৳ 65.50');
  await expect(dashboard).not.toContainText('৳ 164.50');
  await dashboard.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(dashboard).toContainText('৳ 34.50');
  await expect(dashboard).not.toContainText('৳ 65.50');
  await setWorkspaceLanguage(page,'bn');
  await expect(dashboard.getByRole('heading',{name:'আমার অ্যাকাউন্টের কার্যক্রম'})).toBeVisible();
  await expect(dashboard).toContainText('৳ ৩৪.৫০');
  const refreshedHistory=page.waitForRequest(request=>request.url().endsWith('/rest/v1/rpc/sim_my_payment_history')&&request.method()==='POST');
  await dashboard.getByRole('button',{name:'অ্যাকাউন্টের কার্যক্রম হালনাগাদ করুন'}).click();
  await refreshedHistory;
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
  await expect(page.getByRole('heading',{name:'How your credits are made up'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Current tax position'})).toContainText('—');
  await dashboard.getByRole('combobox',{name:'Assessment year'}).selectOption('2024-25');
  await expect(dashboard.getByTestId('account-payment-category-breakdown')).toHaveCount(0);
  await expect(dashboard.getByText(/৳/)).toHaveCount(0);
  await setWorkspaceLanguage(page,'bn');
  await expect(dashboard).toContainText('এই অ্যাপ অ্যাকাউন্টে কোনো পেমেন্ট প্রোফাইল সংযুক্ত নেই।');
  await expect(dashboard.getByText(/৳/)).toHaveCount(0);
});
