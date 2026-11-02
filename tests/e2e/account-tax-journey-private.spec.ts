import {expect,test,type Page} from '@playwright/test';

const backend='https://nbr-taxpay-test.invalid';
const owner={id:'00000000-0000-4000-8000-000000000202',email:'journey-owner@example.invalid',
  aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},
  user_metadata:{taxpay_display_name:'Journey owner'},
  created_at:'2026-01-01T00:00:00Z',last_sign_in_at:'2026-10-01T00:00:00Z'};
const request={id:'00000000-0000-4000-8000-000000000901',owner_uid:owner.id,category:'ADVANCE_TAX',
  assessment_year:'2026-27',request_status:'INFO_REQUESTED',submitted_at:'2026-10-01T10:00:00Z'};
function session(){
  const exp=Math.floor(Date.now()/1000)+3600;
  const encoded=btoa(JSON.stringify({sub:owner.id,aud:'authenticated',role:'authenticated',exp}));
  return {access_token:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+encoded+'.synthetic',token_type:'bearer',
    expires_in:3600,expires_at:exp,refresh_token:'journey-refresh',user:owner};
}
async function mockAccount(page:Page,hasData:boolean){
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
