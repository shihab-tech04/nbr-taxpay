import {expect,test,type Page} from '@playwright/test';

const backend='https://nbr-taxpay-test.invalid';
const owner={id:'00000000-0000-4000-8000-000000000202',email:'journey-owner@example.invalid',
  aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},
  user_metadata:{taxpay_display_name:'Journey owner'},
  created_at:'2026-01-01T00:00:00Z',last_sign_in_at:'2026-10-01T00:00:00Z'};
const request={id:'00000000-0000-4000-8000-000000000901',owner_uid:owner.id,category:'ADVANCE_TAX',
  assessment_year:'2026-27',amount_minor:'12345',request_status:'INFO_REQUESTED',submitted_at:'2026-10-01T10:00:00Z'};
function session(){
  const exp=Math.floor(Date.now()/1000)+3600;
  const encoded=btoa(JSON.stringify({sub:owner.id,aud:'authenticated',role:'authenticated',exp}));
  return {access_token:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+encoded+'.synthetic',token_type:'bearer',
    expires_in:3600,expires_at:exp,refresh_token:'journey-refresh',user:owner};
}
async function mockAccount(page:Page,hasData:boolean,storedPayments:unknown[]=[]){
  await page.addInitScript(({key,value})=>{localStorage.setItem(key,JSON.stringify(value));},
    {key:'sb-nbr-taxpay-test-auth-token',value:session()});
  await page.route(backend+'/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    const response=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',
      headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-allow-methods':'GET,POST,OPTIONS'},
      body:JSON.stringify(data)});
    if(req.method()==='OPTIONS')return response({});
    const claim=req.headers().authorization?.replace(/^Bearer\s+/i,'').split('.')[1];
    if(claim){const actual=JSON.parse(atob(claim));expect(actual.sub).toBe(owner.id);}
    if(url.pathname==='/auth/v1/user')return response(owner);
    if(url.pathname==='/rest/v1/taxpay_payment_requests'){
      expect(url.searchParams.get('owner_uid')).toBe('eq.'+owner.id);
      return response(hasData?[request]:[]);
    }
    if(url.pathname==='/rest/v1/taxpay_request_events'){
      expect(url.searchParams.get('request_id')).toContain(request.id);
      return response(hasData?[{
        id:2,request_id:request.id,event_type:'OFFICER_INFO_REQUESTED',
        status_after:'INFO_REQUESTED',occurred_at:'2026-10-03T10:00:00Z'
      }]:[]);
    }
    if(url.pathname==='/rest/v1/rpc/taxpay_claim_story1_session')return response(0);
    if(url.pathname==='/rest/v1/rpc/taxpay_my_story1_payments')return response({
      items:storedPayments,total:storedPayments.length,page:1,perPage:100
    });
    return response({message:'Not part of account journey acceptance'},403);
  });
}

test('verified account sees only real owner review events and correct chronological details',async({page})=>{
  await mockAccount(page,true);
  await page.goto('/?action=journey');
  const timeline=page.getByTestId('account-tax-journey');
  await expect(timeline).toBeVisible();
  const items=timeline.getByRole('list',{name:'Chronological account review events'}).locator('li');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('Review request submitted');
  await expect(items.nth(1)).toContainText('Review status event');
  await expect(timeline).toContainText(request.id);
  await expect(timeline).toContainText('Requested amount (not paid): ৳ 123.45');
  await expect(timeline).not.toContainText('Treasury confirmed');
  await expect(timeline).not.toContainText('Tax credit recognized');
  await items.nth(1).getByText('View event details').click();
  await expect(items.nth(1)).toContainText('OFFICER INFO REQUESTED');
  await page.getByRole('combobox',{name:'Journey assessment year'}).selectOption('all');
  await page.reload();
  await expect(page.getByTestId('account-tax-journey').getByRole('listitem')).toHaveCount(2);
});

test('signed-in account with no records never invents financial events',async({page})=>{
  await mockAccount(page,false);
  await page.goto('/?action=journey&lang=bn');
  const timeline=page.getByTestId('account-tax-journey');
  await expect(timeline).toBeVisible();
  await expect(timeline.getByRole('list',{name:'অ্যাকাউন্টের পর্যালোচনা ঘটনাক্রম'})).toHaveCount(0);
  await expect(timeline.getByRole('status')).toContainText('কোনো নথিভুক্ত');
  await expect(page.getByRole('navigation',{name:'করসেবা'})).toBeVisible();
});

const sharedPayment={
  id:'00000000-0000-4000-8000-000000000911',service:'TAX_WITH_RETURN',
  amountMinor:5000,status:'SIMULATED_SUCCESS',createdAt:'2026-10-25T12:00:00Z',
  details:{payerName:'Journey owner',taxpayerTin:'MULTIPLE_BENEFICIARIES',
    assessmentYear:'2026-27',lines:[
      {headId:68,headNameEn:'Tax head 68A',economicCode:'68A'},
      {headId:69,headNameEn:'Tax head 68B',economicCode:'68B'},
    ],allocations:[
      {taxpayerTin:'012345678901',taxpayerName:'Beneficiary A',headId:68,amountMinor:1500,assessmentYear:'2026-27'},
      {taxpayerTin:'012345678902',taxpayerName:'Beneficiary B',headId:69,amountMinor:3500,assessmentYear:'2025-26'},
    ],
  }
};

test('owner SQL payment events show beneficiary allocations with the same reference used by Office',async({page})=>{
  await mockAccount(page,true,[sharedPayment]);
  await page.goto('/?action=journey');
  const saved=page.getByTestId('account-sql-tax-journey');
  await expect(saved).toBeVisible();
  await expect(saved.getByRole('listitem')).toHaveCount(2);
  await expect(saved).toContainText('Beneficiary A');
  await expect(saved).toContainText('Beneficiary B');
  await expect(saved).toContainText('৳ 15.00');
  await expect(saved).toContainText('৳ 35.00');
  await expect(saved).toContainText(sharedPayment.id);
  await saved.getByRole('combobox',{name:'Payment journey assessment year'}).selectOption('2025-26');
  await expect(saved.getByRole('listitem')).toHaveCount(1);
  await expect(saved).toContainText('Beneficiary B');
  await expect(saved).not.toContainText('Beneficiary A');
  await saved.getByRole('combobox',{name:'Payment journey assessment year'}).selectOption('all');
  await saved.getByRole('button',{name:'View payment details'}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('account-tax-journey')).toContainText(request.id);
});

test('unbound signed-in history retains review activity and SQL-owned beneficiary receipts',async({page})=>{
  await mockAccount(page,true,[sharedPayment]);
  await page.goto('/?action=history');
  const history=page.getByTestId('beneficiary-payment-history');
  await expect(history).toBeVisible();
  await expect(history.getByRole('row')).toHaveCount(3);
  await expect(history).toContainText('Beneficiary A');
  await expect(history).toContainText('Beneficiary B');
  await expect(history).toContainText(sharedPayment.id);
  await expect(history).toContainText('Tax head 68A');
  await expect(history).toContainText('Tax head 68B');
  await history.getByRole('searchbox',{name:'Search beneficiary, TIN or payment reference'}).fill('012345678902');
  await expect(history.getByRole('row')).toHaveCount(2);
  await expect(history).not.toContainText('Beneficiary A');
  await expect(history).toContainText('Beneficiary B');
});
