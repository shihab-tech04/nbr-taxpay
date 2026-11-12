import {expect,test,type Page} from '@playwright/test';

const backend='https://nbr-taxpay-test.invalid';
const owner={id:'00000000-0000-4000-8000-000000000202',email:'history-owner@example.invalid',
  aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},
  user_metadata:{taxpay_display_name:'History owner'},created_at:'2026-01-01T00:00:00Z',
  last_sign_in_at:'2026-10-01T00:00:00Z'};
const payments=[
  {id:'00000000-0000-4000-8000-000000000911',service:'TAX_WITH_RETURN',amountMinor:5000,
    status:'SIMULATED_SUCCESS',createdAt:'2026-10-25T12:00:00Z',
    details:{payerName:'History owner',taxpayerTin:'MULTIPLE_BENEFICIARIES',assessmentYear:'2026-27',
      lines:[{headId:68,headNameEn:'Tax head 68A',economicCode:'68A'},
        {headId:69,headNameEn:'Tax head 68B',economicCode:'68B'}],
      allocations:[
        {taxpayerTin:'012345678901',taxpayerName:'Beneficiary A',headId:68,amountMinor:1500,assessmentYear:'2026-27'},
        {taxpayerTin:'012345678902',taxpayerName:'Beneficiary B',headId:69,amountMinor:3500,assessmentYear:'2025-26'}
      ]}},
  {id:'00000000-0000-4000-8000-000000000912',service:'TAX_WITH_RETURN',amountMinor:9000,
    status:'SIMULATED_SUCCESS',createdAt:'2026-10-26T12:00:00Z',
    details:{payerName:'History owner',taxpayerTin:'012345678903',assessmentYear:'2024-25',
      lines:[{headId:70,headNameEn:'Tax head 70',economicCode:'70A'}],
      allocations:[{taxpayerTin:'012345678903',taxpayerName:'Beneficiary C',headId:70,
        amountMinor:9000,assessmentYear:'2024-25'}]}}
];

function session(){
  const exp=Math.floor(Date.now()/1000)+3600;
  const encoded=btoa(JSON.stringify({sub:owner.id,aud:'authenticated',role:'authenticated',exp}));
  return {access_token:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+encoded+'.synthetic',token_type:'bearer',
    expires_in:3600,expires_at:exp,refresh_token:'history-refresh',user:owner};
}

async function mockAccountHistory(page:Page){
  await page.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),
    {key:'sb-nbr-taxpay-test-auth-token',value:session()});
  await page.route(backend+'/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    const response=(body:unknown,status=200,headers:Record<string,string>={})=>route.fulfill({
      status,contentType:'application/json',
      headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-expose-headers':'content-range','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS',...headers},
      body:JSON.stringify(body),
    });
    if(request.method()==='OPTIONS')return response({});
    const encoded=request.headers().authorization?.replace(/^Bearer\s+/i,'').split('.')[1];
    if(encoded)expect(JSON.parse(atob(encoded)).sub).toBe(owner.id);
    if(url.pathname==='/auth/v1/user')return response(owner);
    if(url.pathname==='/rest/v1/rpc/sim_my_taxpayer_profile')return response({message:'No approved simulator binding'},403);
    if(url.pathname==='/rest/v1/rpc/taxpay_claim_story1_session'||
       url.pathname==='/rest/v1/rpc/taxpay_claim_walkin_payer_payments')return response(0);
    if(url.pathname==='/rest/v1/rpc/taxpay_my_story1_payments')
      return response({items:payments,total:payments.length,page:1,perPage:100});
    if(url.pathname==='/rest/v1/taxpay_payment_requests')return response([]);
    if(url.pathname==='/rest/v1/taxpay_beneficiary_lists')
      return response([{id:'list-family',owner_uid:owner.id,name:'Family',created_at:'2026-10-01T00:00:00Z'}],200,{'content-range':'0-0/1'});
    if(url.pathname==='/rest/v1/taxpay_beneficiaries'){
      expect(url.searchParams.get('owner_uid')).toBe('eq.'+owner.id);
      return response([],200,{'content-range':'*/0'});
    }
    return response({message:'Outside the isolated account-history scenario'},403);
  });
}

for(const language of ['en','bn'] as const){
  test(`payer history date filter keeps each allocation with its source payment (${language})`,async({page})=>{
    await mockAccountHistory(page);
    await page.goto('/?action=history&lang='+language);
    const history=page.getByTestId('beneficiary-payment-history');
    await expect(history).toContainText('Beneficiary A');
    await expect(history).toContainText('Beneficiary B');
    await expect(history).toContainText('Beneficiary C');
    await history.getByRole('button',{name:language==='bn'?'ফিল্টার':'Filter',exact:true}).click();
    const from=history.getByLabel(language==='bn'?'শুরুর তারিখ থেকে পেমেন্ট ফিল্টার করুন':'Filter payments from date');
    const to=history.getByLabel(language==='bn'?'শেষ তারিখ পর্যন্ত পেমেন্ট ফিল্টার করুন':'Filter payments to date');
    await from.fill('2026-10-26');
    await to.fill('2026-10-26');
    await expect(history).toContainText('Beneficiary C');
    await expect(history).not.toContainText('Beneficiary A');
    await expect(history).not.toContainText('Beneficiary B');
    await to.fill('2026-10-27');
    await from.fill('2026-10-27');
    await expect(history).not.toContainText('Beneficiary C');
    await history.getByRole('button',{name:language==='bn'?'সব ফিল্টার মুছুন':'Clear all',exact:true}).click();
    await expect(history).toContainText('Beneficiary A');
    await expect(history).toContainText('Beneficiary B');
    await expect(history).toContainText('Beneficiary C');
  });
}
