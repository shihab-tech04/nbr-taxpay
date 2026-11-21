import {expect,test} from '@playwright/test';
import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';

test.use({storageState:{cookies:[],origins:[]}});

const changedMessage={
  en:'Your account changed. Cancel and reopen this form before saving.',
  bn:'আপনার অ্যাকাউন্ট বদলেছে। সংরক্ষণের আগে বাতিল করে এই ফর্মটি আবার খুলুন।',
};
const beneficiarySessionId='11111111-1111-4111-8111-111111111111';
const profileStorageKey='korbritto.demo-profile-session.v1';
const profileUserKey='taxpay-taxpayer-preview-user';

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
