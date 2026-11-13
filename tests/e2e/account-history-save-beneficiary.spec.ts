import {expect,test,type Page} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
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
  await history.getByRole('button',{name:'View receipt',exact:true}).first().click();
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
    await history.getByRole('button',{name:language==='bn'?'রসিদ দেখুন':'View receipt',exact:true}).first().click();
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
    await reloadedHistory.getByRole('button',{name:language==='bn'?'রসিদ দেখুন':'View receipt',exact:true}).first().click();
    const savedReceipt=page.getByRole('dialog',{name:language==='bn'?'পেমেন্ট রসিদ':'Payment receipt'});
    await expect(savedReceipt.getByTestId('account-save-beneficiary-receipt')).toHaveCount(0);
    await expect(savedReceipt).toContainText('012345678901');
    await expect(savedReceipt).toContainText('Beneficiary B');
    expect(payment.details.allocations).toHaveLength(2);
    expect(payment.amountMinor).toBe(5000);
  });
}

for(const language of ['en','bn'] as const){
  test(`real Auth payer saves one history allocation to owner-scoped SQL (${language})`,async({browser})=>{
    test.setTimeout(120_000);
    const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
    const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
    if(!raw||!key)throw new Error('Disposable local Supabase credentials are required.');
    const endpoint=new URL(raw);
    if(endpoint.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname))
      throw new Error('Refusing hosted account-history beneficiary acceptance.');
    const createOwner=async(label:string)=>{
      const email=`history-${label}-${randomUUID()}@example.invalid`;
      const password=randomBytes(32).toString('base64url');
      const response=await fetch(new URL('/auth/v1/signup',endpoint.origin),{
        method:'POST',headers:{apikey:key,'content-type':'application/json'},
        body:JSON.stringify({email,password}),
      });
      expect(response.status).toBe(200);
      const body=await response.json() as {
        user?:{id?:string};session?:{access_token?:string;refresh_token?:string;expires_at?:number};
        access_token?:string;refresh_token?:string;expires_at?:number;
      };
      const session=body.session??body;
      expect(body.user?.id).toBeTruthy();
      expect(session.access_token).toBeTruthy();
      return {id:body.user!.id!,session:session as {access_token:string;refresh_token:string;expires_at?:number}};
    };
    const owner=await createOwner('owner');
    const other=await createOwner('other');
    const appUrl=(action:string,session:{access_token:string;refresh_token:string;expires_at?:number})=>
      `/?action=${action}&lang=${language}#access_token=${encodeURIComponent(session.access_token)}`+
      `&refresh_token=${encodeURIComponent(session.refresh_token)}&token_type=bearer&expires_in=3600&expires_at=`+
      (session.expires_at??Math.floor(Date.now()/1000)+3600);
    const readBeneficiaries=async(token:string)=>{
      const url=new URL('/rest/v1/taxpay_beneficiaries',endpoint.origin);
      url.searchParams.set('select','owner_uid,tin,display_name,tag,relationship');
      const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+token}});
      expect(response.status).toBe(200);
      return await response.json() as Array<Record<string,unknown>>;
    };
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
    try{
      const page=await context.newPage();
      page.setDefaultTimeout(10_000);
      await page.goto(appUrl('beneficiaries',owner.session));
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      await page.getByRole('button',{name:language==='bn'?'তালিকা তৈরি':'Create list',exact:true}).first().click();
      const list=page.getByRole('dialog',{name:language==='bn'?'তালিকা তৈরি':'Create list'});
      await list.locator('#beneficiary-create-list-name').fill('Family');
      await list.getByRole('button',{name:language==='bn'?'তালিকা তৈরি':'Create list',exact:true}).click();
      await expect(page.getByText(language==='bn'?'তালিকা তৈরি হয়েছে।':'List created.')).toBeVisible();

      // The payment list is a controlled synthetic receipt response; claim,
      // sign-in, beneficiary CRUD, persistence and RLS use real disposable SQL.
      await page.route(endpoint.origin+'/rest/v1/rpc/taxpay_my_story1_payments',route=>route.fulfill({
        status:200,contentType:'application/json',body:JSON.stringify({items:[payment],total:1,page:1}),
      }));
      await page.goto(appUrl('history',owner.session));
      const history=page.getByTestId('beneficiary-payment-history');
      await expect(history).toBeVisible();
      await expect(history).toContainText('Beneficiary A');
      await history.getByRole('button',{name:language==='bn'?'রসিদ দেখুন':'View receipt',exact:true}).first().click();
      const receipt=page.getByRole('dialog',{name:language==='bn'?'পেমেন্ট রসিদ':'Payment receipt'});
      await expect(receipt).toBeVisible();
      await receipt.getByRole('button',{name:language==='bn'?'উপকারভোগী সংরক্ষণ করুন':'Save Beneficiary',exact:true}).click();
      const entry=page.getByRole('dialog',{name:language==='bn'?'উপকারভোগী যোগ':'Beneficiary entry'});
      await expect(entry.locator('#beneficiary-tin')).toHaveValue('012345678901');
      await expect(entry.locator('#beneficiary-name')).toHaveValue('Beneficiary A');
      await chooseBeneficiaryOption(entry,'beneficiary-target-list',{label:'Family'});
      await chooseBeneficiaryOption(entry,'beneficiary-tag','clients');
      await entry.getByRole('button',{name:language==='bn'?'উপকারভোগী যোগ':'Add beneficiary',exact:true}).click();
      await expect(page.getByText(language==='bn'?'উপকারভোগী সংরক্ষিত হয়েছে।':'Beneficiary saved.')).toBeVisible();

      const saved=await readBeneficiaries(owner.session.access_token);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        owner_uid:owner.id,tin:'012345678901',display_name:'Beneficiary A',tag:'clients',relationship:null,
      });
      expect(await readBeneficiaries(other.session.access_token)).toEqual([]);

      const otherContext=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
      try{
        const otherPage=await otherContext.newPage();
        await otherPage.goto(appUrl('beneficiaries',other.session));
        await expect(otherPage.getByTestId('beneficiaries-page')).toBeVisible();
        await expect(otherPage.getByText('Beneficiary A',{exact:true})).toHaveCount(0);
      }finally{await otherContext.close();}

      await page.goto(appUrl('history',owner.session));
      const reloaded=page.getByTestId('beneficiary-payment-history');
      await expect(reloaded).toContainText(payment.id);
      await reloaded.getByRole('button',{name:language==='bn'?'রসিদ দেখুন':'View receipt',exact:true}).first().click();
      const savedReceipt=page.getByRole('dialog',{name:language==='bn'?'পেমেন্ট রসিদ':'Payment receipt'});
      await expect(savedReceipt.getByTestId('account-save-beneficiary-receipt')).toHaveCount(0);
      await expect(savedReceipt).toContainText('012345678901');
    }finally{await context.close();}
  });
}


for(const language of ['en','bn'] as const){
  test('real Auth payer saves one history allocation from original saved Taxpayer SQL payment without mocking ('+language+')',async({browser})=>{
    test.setTimeout(150_000);
    const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
    const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
    const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
    if(!raw||!key||!dsn)throw new Error('Disposable Auth, PostgREST and SQL are required.');
    const endpoint=new URL(raw),database=new URL(dsn);
    if(endpoint.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)||
      !['localhost','127.0.0.1','[::1]'].includes(database.hostname))
      throw new Error('Refusing a hosted or non-loopback payment-history test.');
    const psql=(query:string)=>{
      const run=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',query],{
        encoding:'utf8',timeout:10_000,
        env:{...process.env,PGHOST:database.hostname,PGPORT:database.port||'5432',
          PGUSER:decodeURIComponent(database.username),PGPASSWORD:decodeURIComponent(database.password),
          PGDATABASE:database.pathname.slice(1)}
      });
      if(run.status!==0)throw new Error((run.stderr||'SQL fixture failed').slice(0,500));
      return run.stdout.trim();
    };
    const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
    const createAccount=async()=>{
      const response=await fetch(new URL('/auth/v1/signup',endpoint.origin),{
        method:'POST',headers:{apikey:key,'content-type':'application/json'},
        body:JSON.stringify({email:'source-history-'+randomUUID()+'@example.invalid',
          password:randomBytes(32).toString('base64url')})
      });
      expect(response.status).toBe(200);
      const body=await response.json() as {user:{id:string};session?:{access_token:string;refresh_token:string;expires_at?:number};
        access_token?:string;refresh_token?:string;expires_at?:number};
      const session=body.session??body;
      expect(body.user.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(session.access_token).toBeTruthy();
      return {id:body.user.id,session:session as {access_token:string;refresh_token:string;expires_at?:number}};
    };
    const owner=await createAccount(),other=await createAccount();
    const payerId=language==='en'?'user27':'user29';
    const recipientId=language==='en'?'user28':'user30';
    const recipientTin=language==='en'?'909000000028':'909000000030';
    const selfTin=language==='en'?'909000000027':'909000000029';
    const paymentId=randomUUID(),idempotencyKey=randomUUID(),authorizationId=randomUUID();
    const payerSessionId=psql(
      "SELECT payment_session_id FROM taxpay_guest_private.demo_profiles WHERE demo_id="+quote(payerId)
    );
    expect(payerSessionId).toMatch(/^[0-9a-f-]{36}$/i);
    const lines=[
      {beneficiary:recipientId,taxpayerTin:recipientTin,category:'ADVANCE_TAX',
        assessmentYear:'2026-27',amountMinor:1500,authorizationId},
      {beneficiary:payerId,taxpayerTin:selfTin,category:'PENALTY',
        assessmentYear:'2025-26',amountMinor:3500}
    ];
    const sourceData={origin:'TAXPAY_UI',idempotencyKey,sessionId:payerSessionId,
      service:'OTHER_TAX_PAYMENT',amountMinor:5000,
      details:{payerId,payerMode:'OTHER',payerName:'Original payment owner',lines}};
    // Authoritative original payment and existing approver-assigned account
    // binding are inserted in disposable PostgreSQL only.
    psql(
      "UPDATE auth.users SET email_confirmed_at=coalesce(email_confirmed_at,now()) WHERE id="+quote(owner.id)+"::uuid;"+
      "INSERT INTO public.sim_payment_account_bindings(user_id,owner_uid,assigned_by) VALUES("+
        quote(payerId)+","+quote(owner.id)+"::uuid,"+quote(owner.id)+"::uuid);"+
      "INSERT INTO public.demo_authorization_requests(id,payer_id,taxpayer_id,status,confirmed_at) VALUES("+
        quote(authorizationId)+"::uuid,"+quote(payerId)+","+quote(recipientId)+",'ACTIVE',now());"+
      "INSERT INTO demo_payment.story_payments"+
      "(id,idempotency_key,session_id,service_code,amount_minor,data,status) VALUES("+
        quote(paymentId)+"::uuid,"+quote(idempotencyKey)+"::uuid,"+
        quote(payerSessionId)+"::uuid,'OTHER_TAX_PAYMENT',5000,"+
        quote(JSON.stringify(sourceData))+"::jsonb,'SIMULATED_SUCCESS');"
    );
    const rpc=async(name:string,session:typeof owner.session,payload:Record<string,unknown>)=>{
      const response=await fetch(new URL('/rest/v1/rpc/'+name,endpoint.origin),{
        method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token,
          'content-type':'application/json'},body:JSON.stringify(payload)});
      expect(response.status,name).toBe(200);
      return await response.json() as unknown;
    };
    const claim=await rpc('taxpay_claim_story1_session',owner.session,{p_session_id:payerSessionId});
    expect(typeof claim).toBe('number');
    expect(claim as number).toBeGreaterThanOrEqual(1);
    const payerHistory=await rpc('taxpay_my_story1_payments',owner.session,{p_page:1,p_per_page:100}) as
      {items:Array<{id:string;amountMinor:number;details:Record<string,unknown>}>;total:number};
    const original=payerHistory.items.find(record=>record.id===paymentId);
    expect(original).toMatchObject({id:paymentId,amountMinor:5000,details:sourceData.details});
    expect(await rpc('taxpay_claim_story1_session',owner.session,{p_session_id:payerSessionId})).toBe(0);
    const otherHistory=await rpc('taxpay_my_story1_payments',other.session,{p_page:1,p_per_page:100}) as
      {items:Array<{id:string}>};
    expect(otherHistory.items.some(record=>record.id===paymentId)).toBe(false);
    const appUrl=(action:string,session:typeof owner.session)=>
      '/?action='+action+'&lang='+language+'#access_token='+encodeURIComponent(session.access_token)+
      '&refresh_token='+encodeURIComponent(session.refresh_token)+
      '&token_type=bearer&expires_in=3600&expires_at='+
      (session.expires_at??Math.floor(Date.now()/1000)+3600);
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
    try{
      const page=await context.newPage();
      await page.goto(appUrl('beneficiaries',owner.session));
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      await page.getByRole('button',{name:language==='bn'?'তালিকা তৈরি':'Create list',exact:true}).first().click();
      const createList=page.getByRole('dialog',{name:language==='bn'?'তালিকা তৈরি':'Create list'});
      await createList.locator('#beneficiary-create-list-name').fill('Family');
      await createList.getByRole('button',{name:language==='bn'?'তালিকা তৈরি':'Create list',exact:true}).click();
      await expect(createList).toBeHidden();
      await page.goto(appUrl('history',owner.session));
      const history=page.getByTestId('beneficiary-payment-history');
      await expect(history).toContainText(paymentId,{timeout:15_000});
      await history.getByRole('button',{name:language==='bn'?'রসিদ দেখুন':'View receipt',exact:true}).first().click();
      const receipt=page.getByRole('dialog',{name:language==='bn'?'পেমেন্ট রসিদ':'Payment receipt'});
      await expect(receipt).toContainText(recipientTin);
      await expect(receipt).toContainText(selfTin);
      await receipt.getByRole('button',{name:language==='bn'?'উপকারভোগী সংরক্ষণ করুন':'Save Beneficiary',exact:true}).click();
      const entry=page.getByRole('dialog',{name:language==='bn'?'উপকারভোগী যোগ':'Beneficiary entry'});
      await expect(entry.locator('#beneficiary-tin')).toHaveValue(recipientTin);
      await expect(entry.locator('#beneficiary-name')).toHaveValue(recipientId);
      await chooseBeneficiaryOption(entry,'beneficiary-target-list',{label:'Family'});
      await chooseBeneficiaryOption(entry,'beneficiary-tag','clients');
      await entry.getByRole('button',{name:language==='bn'?'উপকারভোগী যোগ':'Add beneficiary',exact:true}).click();
      await expect(page.getByText(language==='bn'?'উপকারভোগী সংরক্ষিত হয়েছে।':'Beneficiary saved.')).toBeVisible();
      const readSaved=async(token:string)=>{
        const url=new URL('/rest/v1/taxpay_beneficiaries',endpoint.origin);
        url.searchParams.set('select','owner_uid,tin,display_name,tag');
        const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+token}});
        expect(response.status).toBe(200);
        return await response.json() as Array<{owner_uid:string;tin:string;display_name:string;tag:string}>;
      };
      expect(await readSaved(owner.session.access_token)).toEqual([
        {owner_uid:owner.id,tin:recipientTin,display_name:recipientId,tag:'clients'}
      ]);
      expect(await readSaved(other.session.access_token)).toEqual([]);

      // Open the saved contact's profile from the existing list and verify that
      // the timeline reads the exact recipient allocation from original SQL.
      await page.goto(appUrl('beneficiaries',owner.session));
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      const openRecipientProfile=page.getByRole('link',{name:
        (language==='bn'?'প্রোফাইল দেখুন: ':'Open profile for ')+recipientId});
      await expect(openRecipientProfile).toBeVisible();
      await openRecipientProfile.click();
      const profile=page.getByTestId('beneficiary-profile');
      await expect(profile).toBeVisible();
      const timeline=profile.getByTestId('beneficiary-chronological-timeline');
      await expect(timeline.locator(':scope > li')).toHaveCount(1);
      const recipientEntry=timeline.locator(':scope > li').first();
      await expect(recipientEntry).toContainText(paymentId);
      await expect(recipientEntry).toContainText(/advance tax/i);
      await expect(recipientEntry).toContainText('2026-27');
      await expect(recipientEntry).not.toContainText('2025-26');
      await expect(recipientEntry.getByText(language==='bn'?'৳ ১৫':'৳ 15',{exact:true})).toBeVisible();
      await expect(recipientEntry).not.toContainText(selfTin);

      // The profile opens the original combined receipt, retaining both
      // recipients and both assessment years without turning the allocation
      // into a second payment.
      await recipientEntry.getByRole('button',{name:
        language==='bn'?'মূল রেকর্ড দেখুন':'View original record',exact:true}).click();
      const profileReceipt=page.getByRole('dialog',{name:
        language==='bn'?'পেমেন্টের বিবরণ':'Payment details'});
      await expect(profileReceipt).toContainText(paymentId);
      await expect(profileReceipt).toContainText(recipientTin);
      await expect(profileReceipt).toContainText(selfTin);
      await expect(profileReceipt).toContainText('2026-27');
      await expect(profileReceipt).toContainText('2025-26');

      // Full navigation resets the transient profile view; reopening the saved
      // contact must recover the same SQL-backed recipient timeline.
      await page.goto(appUrl('beneficiaries',owner.session));
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      await page.reload();
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      const recoveredProfileLink=page.getByRole('link',{name:
        (language==='bn'?'প্রোফাইল দেখুন: ':'Open profile for ')+recipientId});
      await expect(recoveredProfileLink).toBeVisible();
      await recoveredProfileLink.click();
      const recoveredTimeline=page.getByTestId('beneficiary-profile')
        .getByTestId('beneficiary-chronological-timeline');
      await expect(recoveredTimeline.locator(':scope > li')).toHaveCount(1);
      await expect(recoveredTimeline.locator(':scope > li').first())
        .toContainText(paymentId);

      await page.goto(appUrl('history',owner.session));
      await expect(page.getByTestId('beneficiary-payment-history')).toContainText(paymentId);
      await page.getByTestId('beneficiary-payment-history')
        .getByRole('button',{name:language==='bn'?'রসিদ দেখুন':'View receipt',exact:true}).first().click();
      await expect(page.getByRole('dialog',{name:language==='bn'?'পেমেন্ট রসিদ':'Payment receipt'})
        .getByTestId('account-save-beneficiary-receipt')).toHaveCount(0);
      const persisted=psql("SELECT data::text FROM demo_payment.story_payments WHERE id="+quote(paymentId)+"::uuid");
      const persistedData=JSON.parse(persisted) as typeof sourceData;
      expect(persistedData).toEqual(sourceData);
      expect(persistedData.details.lines).toEqual(lines);
    }finally{await context.close();}
  });
}
