import {expect,test,type Page} from '@playwright/test';
import {setWorkspaceLanguage} from './workspace-language';

const projectRef='nbr-taxpay-test';
const supabaseUrl='https://'+projectRef+'.invalid';
const owner={
  id:'00000000-0000-4000-8000-000000000202',
  email:'private-dashboard-owner@example.invalid',
  aud:'authenticated',role:'authenticated',
  app_metadata:{provider:'email',providers:['email']},
  user_metadata:{taxpay_display_name:'Private dashboard owner'},
  created_at:'2026-01-01T00:00:00.000Z',
  last_sign_in_at:'2026-10-30T10:00:00.000Z',
};
const payments=[
  {
    id:'SIM-PAY-PARENT-2026',
    transactionId:'00000000-0000-4000-8000-000000000901',
    payer:'user1',state:'SIMULATED',createdAt:'2026-10-28T10:00:00Z',
    simulationOnly:true,totalMinor:35000,reviewStatus:'PENDING_OFFICER',events:[],
    allocations:[
      {id:'self-2026',lineNo:1,beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:10000},
      {id:'other-2026',lineNo:2,beneficiary:'user2',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:20000},
      {id:'self-2025',lineNo:3,beneficiary:'user1',category:'PENALTY',assessmentYear:'2025-26',amountMinor:3000},
      {id:'other-2025',lineNo:4,beneficiary:'user3',category:'SOURCE_TAX_DEPOSIT',assessmentYear:'2025-26',amountMinor:2000},
    ],
  },
  {
    id:'SIM-PAY-RECEIVED-2026',
    transactionId:'00000000-0000-4000-8000-000000000902',
    payer:'user2',state:'SIMULATED',createdAt:'2026-10-29T10:00:00Z',
    simulationOnly:true,totalMinor:8500,reviewStatus:'PENDING_OFFICER',events:[],
    allocations:[
      {id:'received-self-2026',lineNo:1,beneficiary:'user1',category:'PENALTY',assessmentYear:'2026-27',amountMinor:4500},
      {id:'received-other-2026',lineNo:2,beneficiary:'user3',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:1000},
      {id:'received-self-2025',lineNo:3,beneficiary:'user1',category:'SOURCE_TAX_DEPOSIT',assessmentYear:'2025-26',amountMinor:2500},
      {id:'received-other-2025',lineNo:4,beneficiary:'user3',category:'PENALTY',assessmentYear:'2025-26',amountMinor:500},
    ],
  },
];

function sessionFor(){
  const expiresAt=Math.floor(Date.now()/1000)+3600;
  const payload=btoa(JSON.stringify({sub:owner.id,aud:'authenticated',role:'authenticated',exp:expiresAt}));
  return {
    access_token:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+payload+'.synthetic-signature',
    token_type:'bearer',expires_in:3600,expires_at:expiresAt,
    refresh_token:'synthetic-refresh-'+owner.id,user:owner,
  };
}

async function mockDashboardAccount(page:Page,profile:'user1'|'user3'){
  await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{
    key:'sb-'+projectRef+'-auth-token',value:sessionFor(),
  });
  await page.route(supabaseUrl+'/**',async route=>{
    const request=route.request();
    const url=new URL(request.url());
    const headers={
      'access-control-allow-origin':'*',
      'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
      'access-control-allow-methods':'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
    };
    const json=(body:unknown,status=200,extra:Record<string,string>={})=>route.fulfill({
      status,contentType:'application/json',headers:{...headers,...extra},body:JSON.stringify(body),
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
      return json(profile);
    }
    if(url.pathname==='/rest/v1/rpc/sim_my_payment_history'&&request.method()==='POST'){
      expect(ownerFromToken()).toBe(owner.id);
      const body=request.postDataJSON() as {p_view:'payer'|'beneficiary'};
      const visible=payments.flatMap(payment=>{
        const allocations=payment.allocations.filter(allocation=>allocation.beneficiary===profile);
        return allocations.length?[{...payment,allocations}]:[];
      });
      const payerRows=payments.filter(payment=>payment.payer===profile);
      return json(body.p_view==='beneficiary'?visible:payerRows);
    }
    if(url.pathname==='/rest/v1/taxpay_beneficiary_lists'||url.pathname==='/rest/v1/taxpay_beneficiaries'){
      expect(ownerFromToken()).toBe(owner.id);
      return json([],200,{'content-range':'*/0'});
    }
    if([
      '/rest/v1/taxpay_account_payment_form_drafts',
      '/rest/v1/taxpay_payment_requests',
      '/rest/v1/taxpay_correction_inquiries',
      '/rest/v1/taxpay_in_app_notifications',
    ].includes(url.pathname)){
      expect(ownerFromToken()).toBe(owner.id);
      const ownerFilter=url.searchParams.get('owner_uid')??url.searchParams.get('requester_uid')??url.searchParams.get('recipient_uid');
      expect(ownerFilter).toBe('eq.'+owner.id);
      return route.fulfill({status:200,headers:{
        ...headers,'content-range':'0-0/0','access-control-expose-headers':'content-range, x-total-count',
      },body:''});
    }
    return json({message:'Blocked by the isolated dashboard test fixture'},403);
  });
}

test('dashboard shows payer parent once, self/other allocations, and received lines in the selected year',async({page})=>{
  await mockDashboardAccount(page,'user1');
  await page.setViewportSize({width:375,height:820});
  await page.goto('/?action=taxpayer_home');
  const summary=page.getByTestId('account-workflow-summary');
  const totals=summary.getByTestId('dashboard-payment-role-totals');
  await expect(totals.getByTestId('dashboard-payer-total')).toHaveText('৳ 300.00');
  await expect(totals.getByTestId('dashboard-self-paid-total')).toHaveText('৳ 100.00');
  await expect(totals.getByTestId('dashboard-paid-for-others-total')).toHaveText('৳ 200.00');
  await expect(totals.getByTestId('dashboard-received-total')).toHaveText('৳ 45.00');
  await summary.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(totals.getByTestId('dashboard-payer-total')).toHaveText('৳ 50.00');
  await expect(totals.getByTestId('dashboard-self-paid-total')).toHaveText('৳ 30.00');
  await expect(totals.getByTestId('dashboard-paid-for-others-total')).toHaveText('৳ 20.00');
  await expect(totals.getByTestId('dashboard-received-total')).toHaveText('৳ 25.00');
  await setWorkspaceLanguage(page,'bn');
  await expect(totals).toContainText('পরিশোধকারীর মোট');
  await expect(totals).toContainText('অন্য পরিশোধকারীর কাছ থেকে প্রাপ্ত');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('recipient-only account shows received allocations without a zero payer or spending breakdown',async({page})=>{
  await mockDashboardAccount(page,'user3');
  await page.setViewportSize({width:320,height:820});
  await page.goto('/?action=taxpayer_home');
  const summary=page.getByTestId('account-workflow-summary');
  const totals=summary.getByTestId('dashboard-payment-role-totals');
  await expect(totals.getByTestId('dashboard-payer-total')).toHaveText('—');
  await expect(totals.getByTestId('dashboard-self-paid-total')).toHaveText('—');
  await expect(totals.getByTestId('dashboard-paid-for-others-total')).toHaveText('—');
  await expect(totals.getByTestId('dashboard-received-total')).toHaveText('৳ 10.00');
  await expect(summary.getByTestId('account-beneficiary-spending')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
