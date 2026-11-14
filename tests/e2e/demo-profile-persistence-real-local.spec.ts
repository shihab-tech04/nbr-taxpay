import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';
import {expect,test,type BrowserContext,type Page} from '@playwright/test';
import {demoLoginOtpCompletedState} from './demo-login-test-state';
import {randomUUID} from 'node:crypto';
import type {DemoUserId} from '../../src/data/demoUsers';

/** Real browser + local Edge Function/Postgres only. Never use hosted credentials. */
test('demo User ID retains nonempty lists, tagged beneficiary and language across sign-out, refresh and browsers',async({browser},info)=>{
  test.setTimeout(120_000);
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
    await expect(first.getByTestId('beneficiary-records')).toContainText(tin);

    const firstProfile=await first.evaluate(()=>JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')??'null'));
    expect(firstProfile?.profileId).toBe(firstUser);
    const payment=await first.evaluate(async({apiUrl,key,capability,paymentSessionId,idempotencyKey,payerName,profileId})=>{
      const data={origin:'TAXPAY_UI',service:'TAX_WITH_RETURN',amountMinor:12345,sessionId:paymentSessionId,idempotencyKey,
        details:{payerId:profileId,payerName,lines:[{beneficiary:profileId,category:'TAX_WITH_RETURN',
          assessmentYear:'2026-27',amountMinor:12345}]}};
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
    await expect(second.getByTestId('beneficiary-records')).toContainText(tin);
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

    const otherContext=await makeContext();
    const other=await otherContext.newPage();
    await login(other,otherUser);
    await setLanguage(other,'en');
    await openBeneficiaries(other);
    await expect(other.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','en');
    const otherBeneficiaries=other.getByTestId('beneficiaries-page');
    await expect(otherBeneficiaries).not.toContainText(personName);
    await expect(otherBeneficiaries).not.toContainText(tin);
    await expect(otherBeneficiaries).not.toContainText(listName);
    await other.goto('/?action=history');
    await expect(other.getByTestId('signed-in-payment-activity')).not.toContainText(paymentReference);

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
