import {expect,test} from '@playwright/test';
import {spawn,type ChildProcess} from 'node:child_process';
import {resolve} from 'node:path';
import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';

test.use({storageState:{cookies:[],origins:[]}});

const changedMessage={
  en:'Your account changed. Cancel and reopen this form before saving.',
  bn:'আপনার অ্যাকাউন্ট বদলেছে। সংরক্ষণের আগে বাতিল করে এই ফর্মটি আবার খুলুন।',
};
const beneficiarySessionId='11111111-1111-4111-8111-111111111111';
const profileStorageKey='korbritto.demo-profile-session.v1';
const profileUserKey='taxpay-taxpayer-preview-user';
const ownerTestBaseUrl='http://127.0.0.1:4174';
let ownerTestVite:ChildProcess|null=null;

test.beforeAll(async()=>{
  test.setTimeout(60_000);
  const supabaseUrl=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const publishableKey=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!supabaseUrl||!publishableKey)
    throw new Error('The beneficiary owner-session browser gate requires the disposable local Supabase endpoint.');
  ownerTestVite=spawn(process.execPath,[resolve(process.cwd(),'node_modules/vite/bin/vite.js'),
    '--host','127.0.0.1','--port','4174','--strictPort'],{
    env:{...process.env,VITE_SUPABASE_DISABLED:'false',VITE_SUPABASE_URL:supabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY:publishableKey},
    stdio:'ignore',
  });
  const deadline=Date.now()+30_000;
  while(Date.now()<deadline){
    if(ownerTestVite.exitCode!==null)
      throw new Error(`The isolated beneficiary Vite server exited with ${ownerTestVite.exitCode}.`);
    try{
      const response=await fetch(ownerTestBaseUrl);
      if(response.ok)return;
    }catch{/* Wait for Vite to finish binding the isolated port. */}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('The isolated beneficiary Vite server did not become ready on port 4174.');
});

test.afterAll(async()=>{
  const server=ownerTestVite;
  ownerTestVite=null;
  if(!server||server.exitCode!==null)return;
  await new Promise<void>(done=>{
    const timeout=setTimeout(done,3_000);
    timeout.unref();
    server.once('exit',()=>{clearTimeout(timeout);done();});
    server.kill('SIGTERM');
  });
});

async function mockBeneficiaryApi(page:import('@playwright/test').Page,actions:string[]){
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
    const body=route.request().postDataJSON() as {action?:string};
    const action=body.action??'';
    actions.push(action);
    let data:unknown=null;
    if(action==='lists'||action==='people')data=[];
    if(action==='demo-settings')data={language:'en',selectedListId:null,paymentSessionId:beneficiarySessionId};
    if(action==='create-list')data={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Stale write',created_at:'2026-11-21T00:00:00Z'};
    if(action==='add')data=1;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
}

async function switchLocalPreview(page:import('@playwright/test').Page,user:'user1'|'user2'){
  await page.evaluate(nextUser=>{
    const url=new URL(window.location.href);
    url.searchParams.set('demoUser',nextUser);
    const state={taxpayRoute:'beneficiaries',taxpaySampleRole:'TAXPAYER_INDIVIDUAL'};
    window.history.pushState(state,'',url);
    window.dispatchEvent(new PopStateEvent('popstate',{state}));
  },user);
}

test('create-list and add-beneficiary forms reject a User1 to User2 switch and can be reopened',async({page})=>{
  test.setTimeout(90_000);
  const actions:string[]=[];
  await mockBeneficiaryApi(page,actions);

  for(const language of ['en','bn'] as const){
    const lang=language==='bn'?'&lang=bn':'';
    await page.goto('/?action=beneficiaries&demoUser=user1'+lang);
    const screen=page.getByTestId('beneficiaries-page');
    await expect(screen).toBeVisible();
    actions.length=0;

    await screen.getByRole('button',{name:/^(?:Create list|তালিকা তৈরি)$/}).first().click();
    const listDialog=page.getByRole('dialog',{name:/^(?:Create list|তালিকা তৈরি)$/});
    await listDialog.locator('#beneficiary-create-list-name').fill('Fictional owner isolation');
    await switchLocalPreview(page,'user2');
    await listDialog.getByRole('button',{name:/^(?:Create list|তালিকা তৈরি)$/}).click();
    await expect(listDialog.getByRole('alert')).toHaveText(changedMessage[language]);
    expect(actions).not.toContain('create-list');
    await listDialog.getByRole('button',{name:/^(?:Cancel|বাতিল)$/}).click();
    await expect(listDialog).toHaveCount(0);

    await switchLocalPreview(page,'user1');
    await screen.getByRole('button',{name:/^(?:Add beneficiary|উপকারভোগী যোগ)$/}).first().click();
    const addDialog=page.getByRole('dialog',{name:/^(?:Beneficiary entry|উপকারভোগী যোগ)$/});
    await expect(addDialog).toBeVisible();
    await addDialog.locator('#beneficiary-tin').fill('012345678901');
    await addDialog.locator('#beneficiary-name').fill('Fictional beneficiary');
    await chooseBeneficiaryOption(addDialog,'beneficiary-tag','clients');
    await switchLocalPreview(page,'user2');
    await addDialog.getByRole('button',{name:/^(?:Add beneficiary|উপকারভোগী যোগ)$/}).click();
    await expect(addDialog.getByRole('alert')).toHaveText(changedMessage[language]);
    expect(actions.filter(action=>action==='create-list'||action==='add')).toEqual([]);
    await addDialog.getByRole('button',{name:/^(?:Cancel|বাতিল)$/}).click();
    await screen.getByRole('button',{name:/^(?:Add beneficiary|উপকারভোগী যোগ)$/}).first().click();
    await expect(page.getByRole('dialog',{name:/^(?:Beneficiary entry|উপকারভোগী যোগ)$/})).toBeVisible();
    await page.getByRole('dialog',{name:/^(?:Beneficiary entry|উপকারভোগী যোগ)$/})
      .getByRole('button',{name:/^(?:Cancel|বাতিল)$/}).click();
  }
});

test('same-profile capability rotation invalidates an open write form before any request',async({page})=>{
  test.setTimeout(45_000);
  const actions:string[]=[];
  await page.addInitScript(({userKey,sessionKey,profile,session})=>{
    window.sessionStorage.setItem(userKey,profile);
    window.sessionStorage.setItem(sessionKey,JSON.stringify(session));
  },{
    userKey:profileUserKey,
    sessionKey:profileStorageKey,
    profile:'user1',
    session:{profileId:'user1',capability:'A'.repeat(43),paymentSessionId:beneficiarySessionId,language:'en',selectedListId:null},
  });
  await mockBeneficiaryApi(page,actions);
  await page.goto('/?action=beneficiaries');
  const screen=page.getByTestId('beneficiaries-page');
  await expect(screen).toBeVisible();
  actions.length=0;
  await screen.getByRole('button',{name:/^(?:Create list|তালিকা তৈরি)$/}).first().click();
  const dialog=page.getByRole('dialog',{name:/^(?:Create list|তালিকা তৈরি)$/});
  await dialog.locator('#beneficiary-create-list-name').fill('Capability rotation');
  await page.evaluate(({userKey,sessionKey,profile,session})=>{
    window.sessionStorage.setItem(userKey,profile);
    window.sessionStorage.setItem(sessionKey,JSON.stringify(session));
  },{
    userKey:profileUserKey,
    sessionKey:profileStorageKey,
    profile:'user1',
    session:{profileId:'user1',capability:'B'.repeat(43),paymentSessionId:beneficiarySessionId,language:'en',selectedListId:null},
  });
  await dialog.getByRole('button',{name:/^(?:Create list|তালিকা তৈরি)$/}).click();
  await expect(dialog.getByRole('alert')).toHaveText(changedMessage.en);
  expect(actions).not.toContain('create-list');
  await dialog.getByRole('button',{name:/^(?:Cancel|বাতিল)$/}).click();
  await screen.getByRole('button',{name:/^(?:Create list|তালিকা তৈরি)$/}).first().click();
  await expect(page.getByRole('dialog',{name:/^(?:Create list|তালিকা তৈরি)$/})).toBeVisible();
});

async function assertBulkRemovalStopsAfterAccountSwitch(
  page:import('@playwright/test').Page,
  language:'en'|'bn',
){
  test.setTimeout(90_000);
  const now='2026-11-21T00:00:00Z';
  const listId='00000000-0000-4000-8000-000000000301';
  let records=[
    {id:'00000000-0000-4000-8000-000000000401',list_id:listId,tin:'012345678901',display_name:'Alpha',created_at:now,updated_at:now},
    {id:'00000000-0000-4000-8000-000000000402',list_id:listId,tin:'234567890123',display_name:'Beta',created_at:now,updated_at:now},
  ];
  const removalRequests:string[]=[];
  let markFirstRequestStarted=()=>{};
  const firstRequestStarted=new Promise<void>(resolve=>{markFirstRequestStarted=resolve;});
  let releaseFirstResponse=()=>{};
  const firstResponseReleased=new Promise<void>(resolve=>{releaseFirstResponse=resolve;});
  const guestApiRequests:string[]=[];
  await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({message:'No session'})}));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
    const request=route.request();
    guestApiRequests.push(request.method()==='OPTIONS'?'OPTIONS':String((request.postDataJSON() as {action?:string}|null)?.action??'POST'));
    const origin=request.headers().origin??'http://127.0.0.1:4173';
    const corsHeaders={
      'access-control-allow-origin':origin,
      'access-control-allow-methods':'POST, OPTIONS',
      'access-control-allow-headers':request.headers()['access-control-request-headers']
        ??'apikey, content-type, x-taxpay-guest-capability',
      'vary':'Origin',
    };
    if(request.method()==='OPTIONS'){
      await route.fulfill({status:204,headers:corsHeaders});
      return;
    }
    const body=request.postDataJSON() as {action?:string;id?:string;offset?:number;limit?:number};
    let data:unknown=[];
    if(body.action==='open')data={active:true};
    if(body.action==='demo-settings')data={language,selectedListId:listId,paymentSessionId:beneficiarySessionId};
    if(body.action==='lists')data=[{id:listId,name:'Clients',created_at:now}];
    if(body.action==='people')data=records.slice(body.offset??0,(body.offset??0)+(body.limit??500));
    if(body.action==='remove'){
      const id=body.id??'';
      removalRequests.push(id);
      if(removalRequests.length===1){
        markFirstRequestStarted();
        await firstResponseReleased;
      }
      records=records.filter(person=>person.id!==id);
      data=true;
    }
    await route.fulfill({status:200,headers:{...corsHeaders,'content-type':'application/json'},body:JSON.stringify({success:true,data})});
  });

  const lang=language==='bn'?'&lang=bn':'';
  await page.goto(ownerTestBaseUrl+'/?action=beneficiaries&demoUser=user1'+lang);
  const screen=page.getByTestId('beneficiaries-page');
  const rowChecks=screen.locator('input[type="checkbox"][id^="beneficiary-select-"]:visible,input[type="checkbox"][id^="beneficiary-mobile-select-"]:visible');
  try{
    await expect(rowChecks).toHaveCount(2);
  }catch(error){
    const visibleContent=await screen.innerText().catch(()=>'(screen unavailable)');
    throw new Error(`Beneficiary fixture did not load. API requests: ${guestApiRequests.join(', ')||'(none)'}. Screen: ${visibleContent}`,{cause:error});
  }
  await rowChecks.nth(0).check();
  await rowChecks.nth(1).check();
  const menu=screen.getByTestId('beneficiary-bulk-more');
  await menu.locator('summary').click();
  const bn=language==='bn';
  await menu.getByRole('button',{name:bn?'নির্বাচিতদের সরান':'Remove selected'}).click();
  const dialog=page.getByRole('dialog',{name:bn?'একাধিক উপকারভোগী সরানো নিশ্চিত করুন':'Confirm bulk beneficiary removal'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:bn?'নির্বাচিতদের সরান':'Remove selected'}).click();
  await firstRequestStarted;

  await switchLocalPreview(page,'user2');
  await expect(dialog).toHaveCount(0);
  releaseFirstResponse();
  await page.waitForLoadState('networkidle');
  expect(removalRequests).toHaveLength(1);
  await expect(screen.getByText(bn
    ?'আপনার অ্যাকাউন্ট বদলেছে। রেকর্ডগুলো সরানোর আগে উপকারভোগীর তালিকাটি আবার খুলুন।'
    :'Your account changed. Reopen the beneficiary list before removing these records.',
  )).toBeVisible();
}

for(const language of ['en','bn'] as const){
  test(`bulk beneficiary removal stops when the owner session changes (${language})`,async({page})=>{
    await assertBulkRemovalStopsAfterAccountSwitch(page,language);
  });
}
