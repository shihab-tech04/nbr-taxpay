import {expect,test,type Page} from '@playwright/test';
import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';

const backend='https://nbr-taxpay-test.invalid';
const owner={id:'00000000-0000-4000-8000-000000000202',email:'history-owner@example.invalid',
  aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},
  user_metadata:{taxpay_display_name:'History owner'},
  created_at:'2026-01-01T00:00:00Z',last_sign_in_at:'2026-10-01T00:00:00Z'};
const otherOwner={...owner,id:'00000000-0000-4000-8000-000000000203',email:'other-owner@example.invalid',
  user_metadata:{taxpay_display_name:'Other owner'}};
const payment={
  id:'00000000-0000-4000-8000-000000000911',service:'TAX_WITH_RETURN',
  amountMinor:5000,status:'SIMULATED_SUCCESS',createdAt:'2026-10-25T12:00:00Z',
  details:{payerName:'History owner',taxpayerTin:'MULTIPLE_BENEFICIARIES',assessmentYear:'2026-27',lines:[
    {headId:68,headNameEn:'Tax head 68A',economicCode:'68A'},
    {headId:69,headNameEn:'Tax head 68B',economicCode:'68B'},
  ],allocations:[
    {taxpayerTin:'012345678901',taxpayerName:'Beneficiary A',headId:68,amountMinor:1500,assessmentYear:'2026-27'},
    {taxpayerTin:'012345678902',taxpayerName:'Beneficiary B',headId:69,amountMinor:3500,assessmentYear:'2025-26'},
  ]}
};
function session(user=owner){
  const exp=Math.floor(Date.now()/1000)+3600;
  const encoded=btoa(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp}));
  return {access_token:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+encoded+'.synthetic',token_type:'bearer',
    expires_in:3600,expires_at:exp,refresh_token:'history-refresh',user};
}

async function mockAccountHistory(page:Page){
  const savedPeople:Array<Record<string,unknown>>=[];
  let activeOwner=owner;
  let beneficiaryWriteCount=0;
  let nextId=1;
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
    if(url.pathname==='/auth/v1/user')return response(activeOwner);
    if(url.pathname==='/rest/v1/rpc/sim_my_taxpayer_profile')return response({message:'No approved simulator binding'},403);
    if(url.pathname==='/rest/v1/rpc/taxpay_claim_story1_session'||
       url.pathname==='/rest/v1/rpc/taxpay_claim_walkin_payer_payments')return response(0);
    if(url.pathname==='/rest/v1/rpc/taxpay_my_story1_payments')
      return response({items:[payment],total:1,page:1,perPage:100});
    if(url.pathname==='/rest/v1/taxpay_payment_requests')return response([]);
    if(url.pathname==='/rest/v1/taxpay_beneficiary_lists'){
      expect(url.searchParams.get('owner_uid')).toBe('eq.'+activeOwner.id);
      const lists=activeOwner.id===owner.id?[{id:'list-family',owner_uid:owner.id,name:'Family',created_at:'2026-10-01T00:00:00Z'}]:[];
      return response(lists,200,{'content-range':lists.length?'0-0/1':'*/0'});
    }
    if(url.pathname==='/rest/v1/taxpay_beneficiaries'){
      expect(url.searchParams.get('owner_uid')).toBe('eq.'+activeOwner.id);
      if(request.method()==='GET')return response(savedPeople,200,{'content-range':savedPeople.length?`0-${savedPeople.length-1}/${savedPeople.length}`:'*/0'});
      if(request.method()==='POST'){
        const encoded=request.headers().authorization?.replace(/^Bearer\s+/i,'').split('.')[1];
        if(encoded)expect(JSON.parse(atob(encoded)).sub).toBe(activeOwner.id);
        beneficiaryWriteCount++;
        const body=request.postDataJSON() as Array<Record<string,unknown>>;
        const inserted=Array.isArray(body)?body:[body];
        for(const row of inserted){
          if(savedPeople.some(person=>person.tin===row.tin&&person.list_id===row.list_id))continue;
          savedPeople.push({...row,id:`beneficiary-${nextId++}`,created_at:'2026-10-26T10:00:00Z',updated_at:'2026-10-26T10:00:00Z'});
        }
        return response(inserted.map(row=>({id:savedPeople.find(person=>person.tin===row.tin)?.id})),200,{'content-range':`0-${inserted.length-1}/${inserted.length}`});
      }
    }
    return response({message:'Outside the isolated account-history scenario'},403);
  });
  return {savedPeople,beneficiaryWriteCount:()=>beneficiaryWriteCount,switchOwner:(user:typeof owner)=>{activeOwner=user;}};
}

test('history recipient prefill is cleared if the signed-in payer changes before save',async({page})=>{
  const state=await mockAccountHistory(page);
  await page.goto('/?action=history');
  const history=page.getByTestId('beneficiary-payment-history');
  await expect(history).toBeVisible();
  await history.getByRole('button',{name:'View',exact:true}).first().click();
  const receipt=page.getByRole('dialog',{name:'Payment receipt'});
  await receipt.getByRole('button',{name:'Save Beneficiary',exact:true}).click();
  const entry=page.getByRole('dialog',{name:'Beneficiary entry'});
  await expect(entry.locator('#beneficiary-tin')).toHaveValue('012345678901');

  const storageKey='sb-nbr-taxpay-test-auth-token';
  const nextSession=session(otherOwner);
  state.switchOwner(otherOwner);
  await page.evaluate(({key,value})=>{
    const oldValue=localStorage.getItem(key);
    const newValue=JSON.stringify(value);
    localStorage.setItem(key,newValue);
    window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue,storageArea:localStorage,url:location.href}));
  },{key:storageKey,value:nextSession});

  await expect(entry).toBeHidden();
  await expect(page.locator('#beneficiary-tin')).toHaveCount(0);
  await expect(page.getByText('012345678901',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Your account changed. Reopen this payment from the account that made it.')).toBeVisible();
  expect(state.beneficiaryWriteCount()).toBe(0);
  expect(state.savedPeople).toHaveLength(0);
});

for(const language of ['en','bn'] as const){
  test(`payer can save one exact history allocation as a tagged beneficiary (${language})`,async({page})=>{
    const state=await mockAccountHistory(page);
    await page.goto('/?action=history&lang='+language);
    const history=page.getByTestId('beneficiary-payment-history');
    await expect(history).toBeVisible();
    await expect(history).toContainText('Beneficiary A');
    await expect(history).toContainText('Beneficiary B');
    await history.getByRole('button',{name:language==='bn'?'দেখুন':'View',exact:true}).first().click();
    const receipt=page.getByRole('dialog',{name:language==='bn'?'পেমেন্ট রসিদ':'Payment receipt'});
    await expect(receipt).toBeVisible();
    const saveLabel=language==='bn'?'উপকারভোগী সংরক্ষণ করুন':'Save Beneficiary';
    await receipt.getByRole('button',{name:saveLabel,exact:true}).click();

    expect(new URL(page.url()).searchParams.has('012345678901')).toBe(false);
    const entry=page.getByRole('dialog',{name:language==='bn'?'উপকারভোগী যোগ':'Beneficiary entry'});
    await expect(entry).toBeVisible();
    await expect(entry.locator('#beneficiary-tin')).toHaveValue('012345678901');
    await expect(entry.locator('#beneficiary-name')).toHaveValue('Beneficiary A');
    await chooseBeneficiaryOption(entry,'beneficiary-target-list',{label:'Family'});
    await entry.getByRole('button',{name:language==='bn'?'উপকারভোগী যোগ':'Add beneficiary',exact:true}).click();
    await expect(entry.getByRole('alert')).toContainText(language==='bn'?'ট্যাগ বাছুন':'Select a tag');
    expect(state.savedPeople).toHaveLength(0);
    await chooseBeneficiaryOption(entry,'beneficiary-tag','clients');
    await entry.getByRole('button',{name:language==='bn'?'উপকারভোগী যোগ':'Add beneficiary',exact:true}).click();
    await expect(page.getByText(language==='bn'?'উপকারভোগী সংরক্ষিত হয়েছে।':'Beneficiary saved.')).toBeVisible();
    expect(state.savedPeople).toHaveLength(1);
    expect(state.savedPeople[0]).toMatchObject({owner_uid:owner.id,list_id:'list-family',tin:'012345678901',display_name:'Beneficiary A',tag:'clients'});

    const profileLink=page.locator('#beneficiary-profile-link-beneficiary-1');
    await expect(profileLink).toBeVisible();
    await profileLink.click();
    const profile=page.getByTestId('beneficiary-profile');
    await expect(profile).toBeVisible();
    await expect(profile).toContainText('Beneficiary A');
    await expect(profile).toContainText('012345678901');
    await expect(profile).not.toContainText('Beneficiary B');
    await expect(profile).toContainText('Tax head 68A');
    await expect(profile).not.toContainText('Tax head 68B');

    await page.goto('/?action=history&lang='+language);
    const reloadedHistory=page.getByTestId('beneficiary-payment-history');
    await expect(reloadedHistory).toContainText('Beneficiary A');
    await expect(reloadedHistory).toContainText(payment.id);
    await reloadedHistory.getByRole('button',{name:language==='bn'?'দেখুন':'View',exact:true}).first().click();
    const savedReceipt=page.getByRole('dialog',{name:language==='bn'?'পেমেন্ট রসিদ':'Payment receipt'});
    await expect(savedReceipt.getByTestId('account-save-beneficiary-receipt')).toHaveCount(0);
    await expect(savedReceipt).toContainText('012345678901');
    await expect(savedReceipt).toContainText('Beneficiary B');
    expect(payment.details.allocations).toHaveLength(2);
    expect(payment.amountMinor).toBe(5000);
  });
}
