import {maskTinForDisplay} from '../../src/services/tinDisplay';
import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';
import {expect,test,type BrowserContext,type Page} from '@playwright/test';
import {demoLoginOtpCompletedState} from './demo-login-test-state';
import {randomUUID} from 'node:crypto';
import {DEMO_USERS,type DemoUserId} from '../../src/data/demoUsers';
import {sampleTinForUserNumber} from '../../src/data/sampleTinSuggestions';

/** Real browser + local Edge Function/Postgres only. Never use hosted credentials. */
test('demo User ID retains nonempty lists, tagged beneficiary and language across sign-out, refresh and browsers',async({browser},info)=>{
  test.setTimeout(180_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('Disposable local Supabase credentials required.');
  const api=new URL(raw);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing a hosted demo-profile persistence test.');
  const viewport=info.project.name.startsWith('mobile')?{width:375,height:812}:{width:1280,height:800};
  // Keep the same fictional account pair for both viewport projects. The CI
  // command runs projects sequentially so the persisted selected-list setting
  // cannot race between desktop and mobile journeys.
  const firstUser:DemoUserId='user10';
  const otherUser:DemoUserId='user9';
  const contexts:BrowserContext[]=[];
  const makeContext=async()=>{
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport,
      storageState:demoLoginOtpCompletedState});
    contexts.push(context);
    return context;
  };
  const login=async(page:Page,id:DemoUserId)=>{
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill(id);
    await page.getByLabel('Password',{exact:true}).fill(id);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
  };
  const openBeneficiaries=async(page:Page)=>{
    await page.goto('/?action=beneficiaries');
    await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
    await page.getByRole('button',{name:/^(Filter|ফিল্টার)$/}).click();
  };
  const openMobileAccountMenu=async(page:Page)=>{
    const dialog=page.locator('.citizen-dialog');
    if(await dialog.isVisible())return dialog;
    await page.locator('.citizen-mobile-menu-trigger').click();
    await expect(dialog).toBeVisible();
    return dialog;
  };
  const selectedListButton=(page:Page)=>page.getByRole('button',{name:/^(Selected list|নির্বাচিত তালিকা)$/});
  const setLanguage=async(page:Page,target:'en'|'bn')=>{
    if(await page.locator('.taxpay-citizen-shell').getAttribute('lang')===target)return;
    const rail=page.locator('.taxpayer-reference-rail-bottom');
    if(await rail.isVisible()){
      await rail.getByRole('button').filter({hasText:/Language|ভাষা/}).click();
    }else{
      const dialog=await openMobileAccountMenu(page);
      await dialog.locator('.citizen-dialog-language').click();
    }
    await expect(page.locator('.taxpay-citizen-shell')).toHaveAttribute('lang',target);
    // The visual language toggle is optimistic; do not navigate/reload before
    // the capability-scoped SQL preference confirms the exact saved language.
    // This catches actual failed persistence instead of racing an in-flight
    // Edge write and incorrectly attributing another browser's old language.
    await expect.poll(async()=>{
      return page.evaluate(async({url,key})=>{
        const session=JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')??'null');
        if(!session?.capability)return null;
        const res=await fetch(url+'/functions/v1/taxpay-guest-beneficiaries',{
          method:'POST',cache:'no-store',
          headers:{apikey:key,'content-type':'application/json','x-taxpay-guest-capability':session.capability},
          body:JSON.stringify({action:'demo-settings'}),
        });
        if(!res.ok)return null;
        const body=await res.json();
        return body.success===true?body.data?.language??null:null;
      },{url:api.origin,key});
    },{timeout:15000}).toBe(target);
  };
  const signOut=async(page:Page)=>{
    const rail=page.locator('.taxpayer-reference-rail-bottom');
    if(await rail.isVisible()){
      await rail.getByRole('button',{name:/Sign out|সাইন আউট/}).click();
    }else{
      const dialog=await openMobileAccountMenu(page);
      await dialog.locator('.citizen-dialog-signout').click();
    }
    await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
  };
  try{
    const listName='Persistence '+randomUUID().slice(0,8);
    const personName='Synthetic account record '+randomUUID().slice(0,8);
    const tin='8'+randomUUID().replace(/\D/g,'').slice(0,11).padEnd(11,'7');
    expect(tin).toMatch(/^\d{12}$/);

    const firstContext=await makeContext();
    const first=await firstContext.newPage();
    await login(first,firstUser);
    const emptyLegacySession=randomUUID();
    await first.evaluate(id=>sessionStorage.setItem('taxpay-guest-simulation-session',id),emptyLegacySession);
    await first.goto('/?action=history');
    const recovery=first.getByRole('region',{name:/^(Recover earlier saved payments|আগের পেমেন্ট ফিরিয়ে আনুন)$/});
    await expect(recovery).toBeVisible();
    const restore=first.getByRole('button',{name:/^(Restore earlier payments|আগের পেমেন্ট ফিরিয়ে আনুন)$/});
    await restore.click();
    await expect(recovery.getByRole('alert')).toContainText('No earlier payment records were found');
    expect(await first.evaluate(()=>sessionStorage.getItem('taxpay-guest-simulation-session'))).toBe(emptyLegacySession);
    await restore.click();
    await expect(recovery.getByRole('alert')).toContainText('No earlier payment records were found');
    expect(await first.evaluate(()=>sessionStorage.getItem('taxpay-guest-simulation-session'))).toBe(emptyLegacySession);
    await setLanguage(first,'en');
    await openBeneficiaries(first);
    await first.getByRole('button',{name:'Create list',exact:true}).first().click();
    let dialog=first.getByRole('dialog',{name:'Create list'});
    await dialog.locator('#beneficiary-create-list-name').fill(listName);
    await dialog.getByRole('button',{name:'Create list',exact:true}).click();
    await expect(selectedListButton(first)).toContainText(listName);

    await first.getByRole('button',{name:'Add beneficiary',exact:true}).click();
    // Direct Add Beneficiary opens the single-entry modal.
    dialog=first.getByRole('dialog',{name:'Beneficiary entry'});
    await expect(dialog).toBeVisible();
    await expect(first.getByRole('dialog',{name:'Choose how to add beneficiaries'})).toHaveCount(0);
    await expect(first.getByText('Import from Excel',{exact:true})).toHaveCount(0);
    await dialog.locator('#beneficiary-tin').fill(tin);
    await dialog.locator('#beneficiary-name').fill(personName);
    await chooseBeneficiaryOption(dialog,'beneficiary-tag','clients');
    await dialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
    await expect(first.getByTestId('beneficiary-records')).toContainText(personName);
    await expect(first.getByTestId('beneficiary-records')).toContainText(maskTinForDisplay(tin));
    await expect(first.getByTestId('beneficiary-records')).not.toContainText(tin);

    const firstProfile=await first.evaluate(()=>JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')??'null'));
    expect(firstProfile?.profileId).toBe(firstUser);
    const payment=await first.evaluate(async({apiUrl,key,capability,paymentSessionId,idempotencyKey,payerName,profileId})=>{
      // One exclusive Return head, independent of the combined Other Tax route.
      // The valid local source may remain pending Office synchronization, but
      // it must not be rejected for an incomplete accounting/receipt envelope.
      const taxpayerTin='1010101010101';
      const assessmentYear='2026-27';
      const receiptReference='SIM-'+idempotencyKey;
      const line={beneficiary:profileId,category:'TAX_WITH_RETURN',headId:125,
        assessmentYear,amountMinor:12345,totalAmount:123.45};
      const data={origin:'TAXPAY_UI',service:'TAX_WITH_RETURN',amountMinor:12345,sessionId:paymentSessionId,idempotencyKey,
        details:{payerId:profileId,payerName,payerMode:'SELF',payerTin:taxpayerTin,
          taxpayerTin,assessmentYear,receiptReference,lines:[line],
          receiptSnapshot:{paymentCategory:'TAX_WITH_RETURN',payerTin:taxpayerTin,
            taxpayerTin,assessmentYear,challanNo:receiptReference,totalAmount:123.45,
            items:[{headId:125,totalAmount:123.45}]}}};
      const response=await fetch(apiUrl+'/functions/v1/demo-story1-taxpay/payments',{
        method:'POST',headers:{apikey:key,'x-taxpay-guest-capability':capability,'content-type':'application/json'},
        body:JSON.stringify(data)
      });
      return {status:response.status,body:await response.json()};
    },{apiUrl:api.origin,key,capability:firstProfile.capability,paymentSessionId:firstProfile.paymentSessionId,
      idempotencyKey:randomUUID(),payerName:personName,profileId:firstUser});
    // The local SQL row is deliberately absent from hosted TaxPay. Office must
    // reject that unverified source read, while the durable local payment and
    // its owner-scoped TaxPay activity remain available for this real-browser
    // persistence journey.
    expect(payment.status).toBe(503);
    expect(payment.body.error).toBe('OFFICE_SYNC_PENDING');
    expect(payment.body.retryable).toBe(true);
    expect(typeof payment.body.requestId).toBe('string');
    const paymentReference='SIM-'+payment.body.requestId.replaceAll('-','').slice(0,16).toUpperCase();
    const profileReads=await first.evaluate(async({apiUrl,key,capability,paymentSessionId,paymentId})=>{
      const root=apiUrl+'/functions/v1/demo-story1-taxpay';
      const headers={apikey:key,'x-taxpay-guest-capability':capability};
      const requests=[
        fetch(`${root}/profile-history?view=payer&pageSize=100`,{headers,cache:'no-store'}),
        fetch(`${root}/payments?sessionId=${encodeURIComponent(paymentSessionId)}&page=1&perPage=100`,{headers,cache:'no-store'}),
        fetch(`${root}/notifications?sessionId=${encodeURIComponent(paymentSessionId)}`,{headers,cache:'no-store'}),
        fetch(`${root}/payments/${encodeURIComponent(paymentId)}?sessionId=${encodeURIComponent(paymentSessionId)}`,{headers,cache:'no-store'}),
      ];
      const responses=await Promise.all(requests);
      return Promise.all(responses.map(async response=>({status:response.status,body:await response.json()})));
    },{apiUrl:api.origin,key,capability:firstProfile.capability,
      paymentSessionId:firstProfile.paymentSessionId,paymentId:payment.body.requestId});
    expect(profileReads[0].status,JSON.stringify(profileReads[0].body)).toBe(200);
    expect(profileReads[0].body.data.some((row:{id:string})=>row.id===paymentReference)).toBe(true);
    expect(profileReads[1].status,JSON.stringify(profileReads[1].body)).toBe(200);
    expect(profileReads[1].body.data.items.some((row:{id:string})=>row.id===payment.body.requestId)).toBe(true);
    expect(profileReads[2].status,JSON.stringify(profileReads[2].body)).toBe(200);
    expect(profileReads[2].body.data.some((notice:{paymentId:string})=>notice.paymentId===payment.body.requestId)).toBe(true);
    expect(profileReads[3].status,JSON.stringify(profileReads[3].body)).toBe(200);
    expect(profileReads[3].body.data.id).toBe(payment.body.requestId);
    await first.goto('/?action=history');
    await expect(first.getByTestId('signed-in-payment-activity')).toContainText(paymentReference);

    // Exercise the actual correction button, API and SQL-backed register
    // against the disposable saved payment, including no-op rejection.
    const correctionReference=profileReads[3].body.data.data.details.receiptSnapshot.challanNo as string;
    const correctionReason='Incorrect assessment year '+randomUUID().slice(0,8);
    await first.goto('/?action=corrections');
    const picker=first.locator('#correction-challan');
    await expect(picker.locator('option').filter({hasText:correctionReference})).toHaveCount(1);
    await picker.selectOption(correctionReference);
    await first.locator('#correction-reason').fill(correctionReason);
    const submitCorrection=first.getByRole('button',{name:'Submit correction request'});
    await submitCorrection.click();
    await expect(first.getByRole('alert').filter({hasText:'Choose at least one different year'})).toBeVisible();
    await first.locator('#correction-proposed-year').selectOption('2025-2026');
    const acknowledgement=first.waitForResponse(response=>response.url().endsWith('/demo-story1-taxpay/corrections')&&response.request().method()==='POST');
    await submitCorrection.click();
    const correctionResponse=await acknowledgement;
    expect(correctionResponse.status()).toBe(200);
    const correctionId=(await correctionResponse.json()).data.id as string;
    await expect(first.getByText('Request recorded:',{exact:false})).toContainText(correctionId);
    await expect(first.getByTestId('preview-correction-register')).toContainText(correctionId);
    await first.reload();
    await expect(first.getByTestId('preview-correction-register')).toContainText(correctionId);

    await setLanguage(first,'bn');
    expect(firstProfile?.selectedListId).toBeTruthy();

    // Sign out discards only this browser's capability; the SQL account data remains.
    await signOut(first);
    await expect.poll(()=>first.evaluate(()=>sessionStorage.getItem('korbritto.demo-profile-session.v1'))).toBeNull();

    const secondContext=await makeContext();
    const second=await secondContext.newPage();
    await login(second,firstUser);
    await openBeneficiaries(second);
    await expect(second.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','bn');
    await expect(selectedListButton(second)).toContainText(listName);
    await expect(second.getByTestId('beneficiary-records')).toContainText(personName);
    await expect(second.getByTestId('beneficiary-records')).toContainText(maskTinForDisplay(tin));
    await expect(second.getByTestId('beneficiary-records')).not.toContainText(tin);
    const secondProfile=await second.evaluate(()=>JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')??'null'));
    expect(secondProfile?.paymentSessionId).toBe(firstProfile.paymentSessionId);
    await second.reload();
    await second.getByRole('button',{name:/^(Filter|ফিল্টার)$/}).click();
    await expect(selectedListButton(second)).toContainText(listName);
    await expect(second.getByTestId('beneficiary-records')).toContainText(personName);
    await second.goto('/?action=history');
    await expect(second.getByTestId('signed-in-payment-activity')).toContainText(paymentReference);
    await expect(second.getByTestId('signed-in-payment-activity')).toContainText('123.45');
    await second.reload();
    await expect(second.getByTestId('signed-in-payment-activity')).toContainText(paymentReference);
    await second.goto('/?action=corrections');
    await expect(second.getByTestId('preview-correction-register')).toContainText(correctionId);
    await expect(second.getByRole('button',{name:'সংশোধনের আবেদন জমা দিন'})).toBeVisible();
    await second.goto('/?action=taxpayer_home');
    const correctionMetric=second.locator('.taxpay-summary-metric--requests');
    await expect(correctionMetric.locator('strong')).not.toHaveText('—');
    await correctionMetric.click();
    await expect(second.getByTestId('dashboard-recorded-corrections')).toContainText(correctionReason);

    const otherContext=await makeContext();
    const other=await otherContext.newPage();
    await login(other,otherUser);
    await setLanguage(other,'en');
    // Phase 1 / M02: a new preview account has no issued e-TIN. Keep all 24
    // approved fields in the same structure, but never invent identity values.
    // This runs at both 1280px desktop and 375px mobile against real local SQL.
    await other.goto('/?action=account_profile');
    const profilePanel=other.getByTestId('taxpayer-unified-profile-page').getByTestId('user1-taxpayer-profile');
    await expect(profilePanel).toBeVisible();
    await expect(profilePanel.locator('[data-profile-field]')).toHaveCount(24);
    await expect(profilePanel.locator('[data-profile-field="tin"]')).toContainText('Not available');
    await expect(profilePanel.getByRole('button',{name:'Copy TIN'})).toBeDisabled();
    const profileWidth=await profilePanel.evaluate(element=>({
      left:element.getBoundingClientRect().left,
      right:element.getBoundingClientRect().right,
      viewport:window.innerWidth,
    }));
    expect(profileWidth.left).toBeGreaterThanOrEqual(-1);
    expect(profileWidth.right).toBeLessThanOrEqual(profileWidth.viewport+1);
    await setLanguage(other,'bn');
    await expect(profilePanel.locator('[data-profile-field]')).toHaveCount(24);
    await expect(profilePanel.locator('[data-profile-field="tin"]')).toContainText('পাওয়া যায়নি');
    await setLanguage(other,'en');
    await openBeneficiaries(other);
    await expect(other.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','en');
    const otherBeneficiaries=other.getByTestId('beneficiaries-page');
    await expect(otherBeneficiaries).not.toContainText(personName);
    await expect(otherBeneficiaries).not.toContainText(tin);
    await expect(otherBeneficiaries).not.toContainText(listName);
    await other.goto('/?action=history');
    await expect(other.getByTestId('signed-in-payment-activity')).not.toContainText(paymentReference);
    await other.goto('/?action=corrections');
    await expect(other.getByTestId('preview-correction-register')).not.toContainText(correctionId);
    await expect(other.getByText('No correction requests saved yet.')).toBeVisible();

    // The actual read-only SQL RPC also confirms the new owner-scoped rows and
    // rejects the other profile's capability; no HTTP route is intercepted.
    const capability=secondProfile.capability as string;
    const snapshot=await second.evaluate(async({raw,key,capability})=>{
      const response=await fetch(raw+'/functions/v1/taxpay-guest-beneficiaries',{
        method:'POST',headers:{apikey:key,'content-type':'application/json','x-taxpay-guest-capability':capability},
        body:JSON.stringify({action:'snapshot'})
      });
      return {status:response.status,body:await response.json()};
    },{raw:api.origin,key,capability});
    expect(snapshot.status).toBe(200);
    expect(snapshot.body.success).toBe(true);
    expect(snapshot.body.data.profileId).toBe(firstUser);
    expect(snapshot.body.data.settings.language).toBe('bn');
    expect(snapshot.body.data.settings.selectedListId).toBe(firstProfile.selectedListId);
    expect(snapshot.body.data.lists.some((list:{name:string})=>list.name===listName)).toBe(true);
    expect(snapshot.body.data.people.some((person:{tin:string;display_name:string;tag:string})=>
      person.tin===tin&&person.display_name===personName&&person.tag==='clients')).toBe(true);
    const otherCapability=await other.evaluate(()=>JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')??'null')?.capability);
    const otherSnapshot=await other.evaluate(async({raw,key,capability})=>{
      const response=await fetch(raw+'/functions/v1/taxpay-guest-beneficiaries',{
        method:'POST',headers:{apikey:key,'content-type':'application/json','x-taxpay-guest-capability':capability},
        body:JSON.stringify({action:'snapshot'})
      });
      return {status:response.status,body:await response.json()};
    },{raw:api.origin,key,capability:otherCapability});
    expect(otherSnapshot.status).toBe(200);
    expect(otherSnapshot.body.data.profileId).toBe(otherUser);
    expect(otherSnapshot.body.data.people.some((person:{tin:string})=>person.tin===tin)).toBe(false);
    expect(otherSnapshot.body.data.lists.some((list:{name:string})=>list.name===listName)).toBe(false);
  }finally{
    await Promise.all(contexts.map(context=>context.close()));
  }
});


/** WS2 Stage 5: isolated disposable User1 *preview* capability, not a real
 * production Supabase Auth account or settled finance record. The ten aliases
 * are existing eligible public fixture profiles, never issued TINs. */
test('User1 fixture has ten beneficiary recipients in three owned lists with cross-browser and other-user isolation',async({browser},info)=>{
  test.setTimeout(150_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw Error('Disposable Supabase configuration required');
  const target=new URL(raw);
  if(target.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(target.hostname))
    throw Error('Refusing User1 fixture writes to a hosted environment');
  const viewport=info.project.name.startsWith('mobile')?{width:375,height:812}:{width:1280,height:800};
  const suffix=randomUUID().slice(0,8);
  const names={
    clients:'User1 Clients '+suffix,
    family:'User1 Friends & Family '+suffix,
    others:'User1 Others '+suffix,
  };
  const categories=[
    {name:names.clients,tag:'clients',recipients:[2,3,4,5],relations:[null,null,null,null],labels:[null,null,null,null]},
    {name:names.family,tag:'friends_family',recipients:[6,7,8,9],
      relations:['father','mother','siblings','friends'],labels:[null,null,null,null]},
    {name:names.others,tag:'others',recipients:[11,12],relations:[null,null],
      labels:['Professional contact','Community representative']},
  ] as const;
  const expected=categories.flatMap(group=>group.recipients.map((n,i)=>({
    tin:sampleTinForUserNumber(n),display_name:DEMO_USERS[('user'+n) as DemoUserId].nameEn,
    tag:group.tag,relationship:group.relations[i],other_label:group.labels[i],list:group.name,
  })));
  expect(expected).toHaveLength(10);
  expect(new Set(expected.map(row=>row.tin)).size).toBe(10);
  expect(expected.every(row=>typeof row.tin==='string'&&/^\d{12}$/.test(row.tin))).toBe(true);

  const contexts:BrowserContext[]=[];
  const newContext=async()=>{
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport});
    contexts.push(context);
    return context;
  };
  const signIn=async(page:Page,id:'user1'|'user2')=>{
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill(id);
    await page.getByLabel('Password',{exact:true}).fill(id);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')??'null'));
    expect(session?.profileId).toBe(id);
    expect(typeof session.capability).toBe('string');
    return session as {profileId:string;capability:string};
  };
  const apiRequest=async(page:Page,capability:string,action:string,fields:Record<string,unknown>={})=>
    page.evaluate(async({url,key,capability,action,fields})=>{
      const response=await fetch(url+'/functions/v1/taxpay-guest-beneficiaries',{
        method:'POST',cache:'no-store',
        headers:{apikey:key,'content-type':'application/json','x-taxpay-guest-capability':capability},
        body:JSON.stringify({action,...fields}),
      });
      return {status:response.status,body:await response.json()};
    },{url:target.origin,key,capability,action,fields});
  // Each viewport owns only these newly created disposable fixture groups.
  // Remove them after the cross-browser checks so the next viewport does not
  // consume six groups on the same User1 account. Never delete preexisting lists.
  let fixtureOwner: {page:Page;capability:string}|undefined;
  const lists:{name:string;id:string}[]=[];
  try{
    const first=await (await newContext()).newPage();
    const user1=await signIn(first,'user1');
    fixtureOwner={page:first,capability:user1.capability};
    for(const category of categories){
      const created=await apiRequest(first,user1.capability,'create-list',{name:category.name});
      expect(created.status,JSON.stringify(created.body)).toBe(200);
      expect(created.body.success).toBe(true);
      const listId=created.body.data?.id as string;
      expect(listId).toMatch(/^[a-f\d-]{36}$/i);
      lists.push({name:category.name,id:listId});
      const rows=category.recipients.map((n,i)=>({
        tin:sampleTinForUserNumber(n),
        display_name:DEMO_USERS[('user'+n) as DemoUserId].nameEn,
        tag:category.tag,relationship:category.relations[i],other_label:category.labels[i],
      }));
      const added=await apiRequest(first,user1.capability,'add',{listId,rows});
      expect(added.status,JSON.stringify(added.body)).toBe(200);
      expect(added.body.success).toBe(true);
      expect(added.body.data).toBe(category.recipients.length);
    }
    const snapshot=async(page:Page,cap:string)=>{
      const result=await apiRequest(page,cap,'snapshot');
      expect(result.status,JSON.stringify(result.body)).toBe(200);
      expect(result.body.success).toBe(true);
      return result.body.data as {profileId:string;lists:Array<{id:string;name:string}>;
        people:Array<{id:string;list_id:string;tin:string;display_name:string;
          tag:string;relationship:string|null;other_label:string|null}>};
    };
    const firstRead=await snapshot(first,user1.capability);
    expect(firstRead.profileId).toBe('user1');
    for(const category of categories){
      const list=lists.find(item=>item.name===category.name)!;
      expect(firstRead.lists).toContainEqual(expect.objectContaining({id:list.id,name:list.name}));
      const saved=firstRead.people.filter(person=>person.list_id===list.id);
      expect(saved).toHaveLength(category.recipients.length);
      for(let i=0;i<category.recipients.length;i++){
        const original=expected.find(e=>e.tin===sampleTinForUserNumber(category.recipients[i]))!;
        expect(saved).toContainEqual(expect.objectContaining({
          tin:original.tin,display_name:original.display_name,tag:original.tag,
          relationship:original.relationship,other_label:original.other_label,
        }));
      }
    }
    await first.goto('/?action=beneficiaries');
    await expect(first.getByTestId('beneficiaries-page')).toBeVisible();
    if(!await first.locator('#beneficiary-list').isVisible())
      await first.getByRole('button',{name:/^(Filter|ফিল্টার)$/}).click();
    await first.locator('#beneficiary-list').click();
    await first.locator('#beneficiary-list-menu').getByRole('button',{name:names.clients,exact:true}).click();
    await expect(first.getByTestId('beneficiary-records')).toContainText(expected[0].display_name);
    const search=first.getByRole('searchbox',{name:/^(Search this list|এই তালিকায় খুঁজুন)$/});
    await search.fill(expected[0].tin!);
    await expect(first.getByTestId('beneficiary-records')).toContainText(expected[0].display_name);
    await expect(first.getByTestId('beneficiary-records')).not.toContainText(expected[1].display_name);
    await search.fill('');
    // Selection is stored through an asynchronous, capability-scoped SQL
    // settings write. Wait for its actual server confirmation before reload;
    // otherwise mobile browsers can abort the write mid-flight and create a
    // false persistence failure (or hide a real server error).
    await expect.poll(async()=>{
      const setting=await apiRequest(first,user1.capability,'demo-settings');
      expect(setting.status,JSON.stringify(setting.body)).toBe(200);
      return setting.body.data?.selectedListId;
    },{timeout:15000}).toBe(lists.find(list=>list.name===names.clients)!.id);
    await first.reload();
    if(!await first.locator('#beneficiary-list').isVisible())
      await first.getByRole('button',{name:/^(Filter|ফিল্টার)$/}).click();
    await expect(first.locator('#beneficiary-list')).toContainText(names.clients);

    // A fresh browser with User1's independently reissued capability reads
    // the same three owned SQL lists. Do not share the first browser session.
    const again=await (await newContext()).newPage();
    const secondUser1=await signIn(again,'user1');
    const reread=await snapshot(again,secondUser1.capability);
    for(const entry of expected){
      const list=lists.find(item=>item.name===entry.list)!;
      expect(reread.people).toContainEqual(expect.objectContaining({
        list_id:list.id,tin:entry.tin,tag:entry.tag,relationship:entry.relationship,
        other_label:entry.other_label,
      }));
    }
    await again.goto('/?action=beneficiaries');
    await expect(again.getByTestId('beneficiaries-page')).toBeVisible();
    if(!await again.locator('#beneficiary-list').isVisible())
      await again.getByRole('button',{name:/^(Filter|ফিল্টার)$/}).click();
    await again.locator('#beneficiary-list').click();
    // The open mobile picker is a fixed-position popover. It must sit above
    // the sticky header and mobile bottom nav rather than trapping list actions.
    await expect.poll(async()=>Number(await again.locator('.beneficiary-directory__list-filter .beneficiary-list-picker').evaluate(
      picker=>getComputedStyle(picker).zIndex
    ))).toBeGreaterThan(55);
    await again.locator('#beneficiary-list-menu').getByRole('button',{name:names.others,exact:true}).click({timeout:15000});
    await expect(again.getByTestId('beneficiary-records')).toContainText('Professional contact');
    await expect(again.getByTestId('beneficiary-records')).toContainText('Community representative');

    const foreign=await (await newContext()).newPage();
    const user2=await signIn(foreign,'user2');
    const foreignRead=await snapshot(foreign,user2.capability);
    for(const entry of expected){
      expect(foreignRead.people.some(row=>row.tin===entry.tin&&
        lists.some(list=>list.id===row.list_id))).toBe(false);
    }
    for(const list of lists)expect(foreignRead.lists.some(row=>row.id===list.id)).toBe(false);
    await foreign.goto('/?action=beneficiaries');
    await expect(foreign.getByTestId('beneficiaries-page')).toBeVisible();
    for(const list of lists)await expect(foreign.getByTestId('beneficiaries-page')).not.toContainText(list.name);
    // No settled financial record is created: WS1/WS3 own associated
    // payment/allocation fixtures and payer/recipient readback.
  }finally{
    try{
      if(fixtureOwner&&lists.length){
        const {page,capability}=fixtureOwner;
        const read=await apiRequest(page,capability,'snapshot');
        expect(read.status).toBe(200);
        expect(read.body.success).toBe(true);
        const ownedIds=new Set(lists.map(list=>list.id));
        const owned=read.body.data.people as Array<{id:string;list_id:string}>;
        for(const person of owned.filter(row=>ownedIds.has(row.list_id))){
          const removed=await apiRequest(page,capability,'remove',{id:person.id});
          expect(removed.status,JSON.stringify(removed.body)).toBe(200);
        }
        for(const list of lists){
          const removed=await apiRequest(page,capability,'delete-list',{id:list.id});
          expect(removed.status,JSON.stringify(removed.body)).toBe(200);
        }
        const after=await apiRequest(page,capability,'snapshot');
        expect(after.status).toBe(200);
        expect(after.body.success).toBe(true);
        expect(after.body.data.lists.some((row:{id:string})=>ownedIds.has(row.id))).toBe(false);
        expect(after.body.data.people.some((row:{list_id:string})=>ownedIds.has(row.list_id))).toBe(false);
        const retained=read.body.data.lists.filter((row:{id:string})=>!ownedIds.has(row.id));
        expect(after.body.data.lists).toEqual(expect.arrayContaining(retained));
      }
    }finally{
      await Promise.all(contexts.map(context=>context.close()));
    }
  }
});


// Regression for the actual User1 2023–2024 Activity screen. Historical
// references must open the correction form without pretending to be receipts.
test('User1 historical Activity exposes all three correction entries and persists reference-only request',async({browser},info)=>{
  test.setTimeout(90000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  if(!raw||!['localhost','127.0.0.1','[::1]'].includes(new URL(raw).hostname))throw Error('Disposable local Supabase required');
  const viewport=info.project.name.startsWith('mobile')?{width:375,height:812}:{width:1280,height:800};
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport,storageState:demoLoginOtpCompletedState});
  try{
    const page=await context.newPage();
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill('user1');
    await page.getByLabel('Password',{exact:true}).fill('user1');
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await page.goto('/?action=history&scenarioYear=2023-2024');
    await expect(page.getByTestId('user1-synthetic-workspace')).not.toContainText('DEMO-PAY-23-01');
    await page.goto('/?action=history&scenarioYear=2023-2024&qaScenario=1');
    const workspace=page.getByTestId('user1-synthetic-workspace');
    await expect(workspace).toBeVisible();
    await expect(workspace.getByRole('combobox',{name:/Assessment year|করবর্ষ/})).toHaveValue('2023-2024');
    const row=(reference:string)=>page.locator('.taxpayer-transaction-table tbody tr:visible,.taxpayer-transaction-mobile-record:visible').filter({hasText:reference});
    const form=()=>page.getByRole('dialog',{name:/^(Apply for Correction|সংশোধনের আবেদন)$/});
    for(const reference of ['DEMO-PAY-23-01','DEMO-AIT-23-01','DEMO-ETDS-23-01']){
      await row(reference).getByRole('button',{name:/Details for |বিস্তারিত: /}).click();
      const action=page.getByTestId('historical-detail-apply-correction');
      await expect(action).toBeVisible();
      await action.click();
      const dialog=form();
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('#correction-challan')).toHaveValue(reference);
      await expect(dialog.locator('#correction-current-year')).toHaveValue('2023-2024');
      await expect(dialog.locator('#correction-current-circle')).toHaveValue('');
      await expect(dialog.locator('#correction-current-head')).toHaveValue('');
      await dialog.getByRole('button',{name:/Close correction form|সংশোধনের ফরম বন্ধ করুন/}).click();
      await expect(dialog).toHaveCount(0);
    }
    await row('DEMO-PAY-23-01').getByRole('button',{name:/Details for |বিস্তারিত: /}).click();
    await page.getByTestId('historical-detail-apply-correction').click();
    const dialog=form();
    await expect(dialog).toBeVisible();
    const reason='Historical year review '+randomUUID();
    await dialog.locator('#correction-proposed-year').selectOption('2024-2025');
    await dialog.locator('#correction-reason').fill(reason);
    const responsePromise=page.waitForResponse(r=>r.url().endsWith('/demo-story1-taxpay/corrections')&&r.request().method()==='POST');
    await dialog.getByRole('button',{name:/Submit correction request|সংশোধনের আবেদন জমা দিন/}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const envelope=await response.json();
    expect(envelope.data).toMatchObject({paymentId:null,originalReference:'DEMO-PAY-23-01',currentAY:'2023-2024',proposedAY:'2024-2025',officeSyncState:'PENDING'});
    await expect(dialog.getByRole('status').filter({hasText:/Request recorded|আবেদন নথিভুক্ত/})).toBeVisible();
    await expect(dialog.getByTestId('preview-correction-register')).toHaveCount(0);
    await expect(dialog.locator('.taxpay-modal__footer').getByRole('button',{name:/Submit correction request|সংশোধনের আবেদন জমা দিন/})).toBeVisible();
    await dialog.getByRole('button',{name:/View correction requests|সংশোধনের আবেদন দেখুন/}).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/action=corrections/);
    const register=page.getByTestId('preview-correction-register');
    await expect(register).toContainText(reason);
    await page.reload();
    await expect(register).toContainText(reason);
    await expect(register).toContainText('DEMO-PAY-23-01');
    // The real persisted historical request must appear on a different-year
    // dashboard and lead back to the all-year SQL register, not sample cards.
    await page.goto('/?action=taxpayer_home&scenarioYear=2026-2027');
    const overview=page.getByTestId('taxpayer-overview-bento');
    await overview.locator('.taxpay-summary-metric--requests').click();
    await expect(overview.getByTestId('dashboard-recorded-corrections')).toContainText(reason);
    await overview.getByRole('button',{name:/^View requests$/}).click();
    await expect(page.getByRole('combobox',{name:/Assessment year|করবর্ষ/})).toHaveValue('all');
    await expect(register).toContainText(reason);
    await page.reload();
    await expect(register).toContainText(reason);
    await page.goto('/?action=account_notifications&scenarioYear=2023-2024');
    const notificationRegister=page.getByTestId('correction-notifications');
    const notice=notificationRegister.locator('li').filter({hasText:reason});
    await expect(notice).toHaveCount(1);
    const read=notice.getByRole('button',{name:/Mark as read|পঠিত হিসেবে চিহ্নিত করুন/});
    await expect(read).toBeVisible();
    await read.click();
    await expect(read).toHaveCount(0);
    await page.reload();
    await expect(notice).toBeVisible();
    await expect(read).toHaveCount(0);
    await notice.getByRole('button',{name:/View correction|সংশোধন দেখুন/}).click();
    await expect(page.getByTestId('preview-correction-register')).toContainText(envelope.data.id);
    await expect(page.getByTestId('preview-correction-register').locator('input[type=search]')).toHaveValue(envelope.data.id);
  }finally{await context.close();}
});
