import {expect,test,type BrowserContext,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';

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
  const contexts:BrowserContext[]=[];
  const makeContext=async()=>{
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport});
    contexts.push(context);
    return context;
  };
  const login=async(page:Page,id:'user9'|'user10')=>{
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill(id);
    await page.getByLabel('Password',{exact:true}).fill(id);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
  };
  const openBeneficiaries=async(page:Page)=>{
    await page.goto('/?action=beneficiaries');
    await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  };
  const setLanguage=async(page:Page,target:'en'|'bn')=>{
    if(await page.locator('.taxpay-citizen-shell').getAttribute('lang')===target)return;
    await page.locator('.taxpayer-reference-rail-bottom').getByRole('button').filter({hasText:/Language|ভাষা/}).click();
    await expect(page.locator('.taxpay-citizen-shell')).toHaveAttribute('lang',target);
  };
  const signOut=async(page:Page)=>{
    await page.locator('.taxpayer-reference-rail-bottom').getByRole('button',{name:/Sign out|সাইন আউট/}).click();
    await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
  };
  try{
    const listName='Persistence '+randomUUID().slice(0,8);
    const personName='Synthetic account record '+randomUUID().slice(0,8);
    const tin='8'+randomUUID().replace(/\D/g,'').slice(0,11).padEnd(11,'7');
    expect(tin).toMatch(/^\d{12}$/);

    const firstContext=await makeContext();
    const first=await firstContext.newPage();
    await login(first,'user10');
    const emptyLegacySession=randomUUID();
    await first.evaluate(id=>sessionStorage.setItem('taxpay-guest-simulation-session',id),emptyLegacySession);
    await first.goto('/?action=history');
    const recovery=first.locator('section[aria-label="Recover earlier saved payments"]');
    await expect(recovery).toBeVisible();
    const restore=first.getByRole('button',{name:'Restore earlier payments',exact:true});
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
    await expect(first.getByRole('button',{name:'Selected list'})).toContainText(listName);

    await first.getByRole('button',{name:'Add beneficiary',exact:true}).click();
    await first.getByRole('dialog',{name:'Choose how to add beneficiaries'})
      .getByRole('button',{name:'Add one beneficiary'}).click();
    dialog=first.getByRole('dialog',{name:'Beneficiary entry'});
    await dialog.locator('#beneficiary-tin').fill(tin);
    await dialog.locator('#beneficiary-name').fill(personName);
    await dialog.locator('#beneficiary-tag').selectOption('clients');
    await dialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
    await expect(first.getByTestId('beneficiary-records')).toContainText(personName);
    await expect(first.getByTestId('beneficiary-records')).toContainText(tin);

    const firstProfile=await first.evaluate(()=>JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')??'null'));
    expect(firstProfile?.profileId).toBe('user10');
    const payment=await first.evaluate(async({apiUrl,key,capability,paymentSessionId,idempotencyKey,payerName})=>{
      const data={origin:'TAXPAY_UI',service:'TAX_WITH_RETURN',amountMinor:12345,sessionId:paymentSessionId,idempotencyKey,
        details:{payerId:'user10',payerName,lines:[{beneficiary:'user10',category:'TAX_WITH_RETURN',
          assessmentYear:'2026-27',amountMinor:12345}]}};
      const response=await fetch(apiUrl+'/functions/v1/demo-story1-taxpay/payments',{
        method:'POST',headers:{apikey:key,'x-taxpay-guest-capability':capability,'content-type':'application/json'},
        body:JSON.stringify(data)
      });
      return {status:response.status,body:await response.json()};
    },{apiUrl:api.origin,key,capability:firstProfile.capability,paymentSessionId:firstProfile.paymentSessionId,
      idempotencyKey:randomUUID(),payerName:personName});
    expect(payment.status).toBe(200);
    expect(typeof payment.body.id).toBe('string');
    const paymentReference='SIM-'+payment.body.id.replaceAll('-','').slice(0,16).toUpperCase();
    await first.goto('/?action=history');
    await expect(first.getByTestId('signed-in-payment-activity')).toContainText(paymentReference);

    await setLanguage(first,'bn');
    expect(firstProfile?.selectedListId).toBeTruthy();

    // Sign out discards only this browser's capability; the SQL account data remains.
    await signOut(first);
    await expect.poll(()=>first.evaluate(()=>sessionStorage.getItem('korbritto.demo-profile-session.v1'))).toBeNull();

    const secondContext=await makeContext();
    const second=await secondContext.newPage();
    await login(second,'user10');
    await openBeneficiaries(second);
    await expect(second.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','bn');
    await expect(second.getByRole('button',{name:'Selected list'})).toContainText(listName);
    await expect(second.getByTestId('beneficiary-records')).toContainText(personName);
    await expect(second.getByTestId('beneficiary-records')).toContainText(tin);
    const secondProfile=await second.evaluate(()=>JSON.parse(sessionStorage.getItem('korbritto.demo-profile-session.v1')??'null'));
    expect(secondProfile?.paymentSessionId).toBe(firstProfile.paymentSessionId);
    await second.reload();
    await expect(second.getByRole('button',{name:'Selected list'})).toContainText(listName);
    await expect(second.getByTestId('beneficiary-records')).toContainText(personName);
    await second.goto('/?action=history');
    await expect(second.getByTestId('signed-in-payment-activity')).toContainText(paymentReference);
    await expect(second.getByTestId('signed-in-payment-activity')).toContainText('123.45');
    await second.reload();
    await expect(second.getByTestId('signed-in-payment-activity')).toContainText(paymentReference);

    const otherContext=await makeContext();
    const other=await otherContext.newPage();
    await login(other,'user9');
    await setLanguage(other,'en');
    await openBeneficiaries(other);
    await expect(other.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','en');
    await expect(other.getByTestId('beneficiary-records')).not.toContainText(personName);
    await expect(other.getByTestId('beneficiary-records')).not.toContainText(tin);
    await expect(other.getByText(listName,{exact:true})).toHaveCount(0);
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
    expect(snapshot.body.data.profileId).toBe('user10');
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
    expect(otherSnapshot.body.data.profileId).toBe('user9');
    expect(otherSnapshot.body.data.people.some((person:{tin:string})=>person.tin===tin)).toBe(false);
    expect(otherSnapshot.body.data.lists.some((list:{name:string})=>list.name===listName)).toBe(false);
  }finally{
    await Promise.all(contexts.map(context=>context.close()));
  }
});
