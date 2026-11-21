import { openLegacyTaxServiceChoice } from './pay-tax-entry-helper';
import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';
import {expect,test} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

// Real disposable Auth + PostgREST. Fail closed if pointed at any hosted database.
test('real account saves private beneficiary, reopens it, isolates another owner and prefills Pay Tax',async({browser})=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL, key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
  if(!raw||!key||!dsn)throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api=new URL(raw);
  const database=new URL(dsn);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing non-loopback beneficiary acceptance');
  if((database.protocol!=='postgres:'&&database.protocol!=='postgresql:')||
    !['localhost','127.0.0.1','[::1]'].includes(database.hostname))
    throw new Error('Refusing non-loopback beneficiary SQL fixture');
  const makeUser=async()=>{
    const email='beneficiary-'+randomUUID()+'@example.invalid',password=randomBytes(32).toString('base64url');
    const response=await fetch(new URL('/auth/v1/signup',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),
    });
    expect(response.status).toBe(200);
    const value=await response.json();
    expect(value.user?.id).toBeTruthy();
    const session=value.session??value;
    expect(session.access_token).toBeTruthy();
    return {id:value.user.id as string,session,email,password};
  };
  const signIn=async(user:{id:string;email:string;password:string})=>{
    const response=await fetch(new URL('/auth/v1/token?grant_type=password',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email:user.email,password:user.password}),
    });
    expect(response.status).toBe(200);
    const value=await response.json();
    expect(value.user?.id).toBe(user.id);
    expect(value.access_token).toBeTruthy();
    expect(value.refresh_token).toBeTruthy();
    return value;
  };
  const ownerA=await makeUser(),ownerB=await makeUser();
  const loginUrl=(session:{access_token:string;refresh_token:string;expires_at?:number})=>
    '/?action=beneficiaries#access_token='+encodeURIComponent(session.access_token)+
    '&refresh_token='+encodeURIComponent(session.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+
    (session.expires_at??Math.floor(Date.now()/1000)+3600);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
  const page=await context.newPage();
  const records=page.locator('[data-testid="beneficiaries-page"] ul:visible');
  await page.goto(loginUrl(ownerA.session));
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
  await expect(page.getByRole('heading',{name:'Beneficiaries',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Manage taxpayer authorizations'})).toHaveCount(0);
  await page.getByRole('button',{name:'Create list',exact:true}).first().click();
  const listDialog=page.getByRole('dialog',{name:'Create list'});
  await listDialog.locator('#beneficiary-create-list-name').fill('Family');
  await listDialog.getByRole('button',{name:'Create list',exact:true}).click();
  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  // Add beneficiary opens the existing individual form directly while Excel import is hidden.
  const addDialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await expect(addDialog).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Choose how to add beneficiaries'})).toHaveCount(0);
  await addDialog.locator('#beneficiary-tin').fill('012345678901');
  await addDialog.locator('#beneficiary-name').fill('Local Beneficiary One');
  await chooseBeneficiaryOption(addDialog,'beneficiary-tag','friends_family:father');
  await addDialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await expect(page.getByText('Beneficiary saved.')).toBeVisible({timeout:15000});
  await expect(records).toContainText('012*********');
  // Compact owner-approved identity column combines name · final tag and bare TIN
  // while preserving native Actions cells and the mobile payment/list controls.
  await page.setViewportSize({width:1280,height:900});
  const table=page.getByTestId('beneficiary-directory-desktop');
  await expect(table).toBeVisible();
  await expect(table.locator('thead th')).toHaveText(['Beneficiary','Actions']);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table.locator('tbody tr td')).toHaveCount(2);
  const identity=table.locator('tbody tr:first-child .beneficiary-directory__person');
  await expect(identity.locator('.taxpayer-transaction-row__title')).toHaveText('Local Beneficiary One · Father');
  await expect(identity.locator('.beneficiary-directory__tin')).toHaveText('012*********');
  const alignment=await table.evaluate(element=>{
    const headers=Array.from(element.querySelectorAll('thead th'));
    const cells=Array.from(element.querySelectorAll('tbody tr:first-child td'));
    return headers.map((header,i)=>Math.abs(header.getBoundingClientRect().left-cells[i].getBoundingClientRect().left));
  });
  for(const offset of alignment)expect(offset).toBeLessThanOrEqual(2);
  const viewport=table.locator('..');
  // Board-style tables may scroll inside their own viewport when action
  // columns need more width; they must not push the document horizontally.
  await expect(viewport).toHaveCSS('overflow-x','auto');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.setViewportSize({width:375,height:812});
  await expect(page.getByTestId('beneficiary-directory-mobile')).toBeVisible();
  await expect(page.getByTestId('beneficiary-directory-mobile').locator('li')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(records).toContainText('Local Beneficiary One');

  // Excel entry is hidden; adding the second taxpayer uses the existing form while retaining owner-isolation coverage.
  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  const secondAddDialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await expect(secondAddDialog).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Choose how to add beneficiaries'})).toHaveCount(0);
  await expect(page.getByText('Import from Excel',{exact:true})).toHaveCount(0);
  await secondAddDialog.locator('#beneficiary-tin').fill('987654321098');
  await secondAddDialog.locator('#beneficiary-name').fill('Local Beneficiary Two');
  await chooseBeneficiaryOption(secondAddDialog,'beneficiary-tag','clients');
  await secondAddDialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await expect(page.getByText('Beneficiary saved.')).toBeVisible({timeout:15000});
  await expect(records).toContainText('Local Beneficiary Two');
  await page.reload();
  await expect(records).toContainText('Local Beneficiary Two');

  const read=async(token:string)=>{
    const response=await fetch(new URL('/rest/v1/taxpay_beneficiaries?select=owner_uid,tin,display_name,tag,relationship',api.origin),{
      headers:{apikey:key,Authorization:'Bearer '+token},
    });
    expect(response.status).toBe(200);
    return response.json();
  };
  const own=await read(ownerA.session.access_token);
  expect(own).toHaveLength(2);
  expect(own).toEqual(expect.arrayContaining([
    {owner_uid:ownerA.id,tin:'012345678901',display_name:'Local Beneficiary One',tag:'friends_family',relationship:'father'},
    {owner_uid:ownerA.id,tin:'987654321098',display_name:'Local Beneficiary Two',tag:'clients',relationship:null},
  ]));
  expect(await read(ownerB.session.access_token)).toEqual([]);

  // US-010 requires persistence after signing into a new browser session for
  // the same owner, not just reloading the page with its original token.
  const freshOwnerSession=await signIn(ownerA);
  const freshOwnerContext=await browser.newContext({
    baseURL:'http://127.0.0.1:4173',
    viewport:{width:375,height:812},
    storageState:{cookies:[],origins:[]},
  });
  try{
    const freshOwnerPage=await freshOwnerContext.newPage();
    await freshOwnerPage.goto(loginUrl(freshOwnerSession));
    await expect(freshOwnerPage.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
    const persistedRow=freshOwnerPage.getByTestId('beneficiary-directory-mobile').locator('li')
      .filter({hasText:'Local Beneficiary One'});
    await expect(persistedRow).toContainText('Father');
    await expect(persistedRow).toContainText('012*********');
    await expect(freshOwnerPage.getByTestId('beneficiary-directory-mobile'))
      .toContainText('Local Beneficiary Two');
  }finally{
    await freshOwnerContext.close();
  }

  const otherContext=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:320,height:720}});
  const otherPage=await otherContext.newPage();
  await otherPage.goto(loginUrl(ownerB.session));
  await expect(otherPage.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
  await expect(otherPage.getByText('Local Beneficiary One')).toHaveCount(0);
  await otherContext.close();

  await page.goto('/?action=landing');
  await openLegacyTaxServiceChoice(page);
  const modal=page.getByRole('dialog',{name:'Pay Tax'});
  // Real Supabase Auth keeps the payer and service choices, but must not
  // ask an already authenticated taxpayer to sign in or pay as a walk-in.
  await expect(modal.locator('[data-payer-relationship]')).toHaveCount(2);
  await modal.locator('[data-payer-relationship="OTHER"]').click();
  await modal.locator('[data-payment-entry="OTHER_TAX"]').click();
  await expect(modal.locator('[data-entry-section="access"]')).toHaveCount(0);
  await expect(modal.locator('[data-payment-access]')).toHaveCount(0);
  await expect(modal.locator('[data-payer-relationship]')).toHaveCount(2);
  await expect(modal.locator('[data-payment-entry]')).toHaveCount(2);
  await expect(modal.getByRole('button',{name:'Continue',exact:true})).toBeEnabled();
  await modal.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(modal.getByText('Continuing with your account')).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'})).toHaveCount(0);
  const picker=modal.getByTestId('saved-beneficiary-picker');
  await expect(picker.getByRole('button',{name:'Manage beneficiaries'})).toBeVisible({timeout:15000});
  await expect(picker.getByRole('button',{name:/Family/})).toHaveAttribute('aria-expanded','true');
  await expect(picker).toContainText('Local Beneficiary One',{timeout:15000});
  await picker.getByRole('checkbox',{name:'Select Local Beneficiary One'}).check();
  await expect(picker).toContainText('1 selected for this payment');
  await expect(picker).toContainText('012*********');
  await expect(modal.locator('#guest-tin, #guest-payer-name')).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Add another taxpayer'})).toHaveCount(0);

  // Disposable local SQL only: preserve an immutable payment snapshot independently
  // of the saved-contact row that may later be removed.
  const paymentSession=randomUUID();
  const submittedPaymentResponse=await fetch(new URL('/rest/v1/rpc/demo_story1_submit',api.origin),{
    method:'POST',
    headers:{apikey:key,Authorization:'Bearer '+ownerA.session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({p_input:{
      idempotencyKey:randomUUID(),
      sessionId:paymentSession,
      service:'ADVANCE_TAX',
      amountMinor:1500,
      details:{
        taxpayerTin:'012345678901',
        taxpayerName:'Local Beneficiary One',
        payerName:'Local owner',
        assessmentYear:'2026-27',
        paymentHead:'Advance tax',
      },
    }}),
  });
  expect(submittedPaymentResponse.status).toBe(200);
  const submittedPayment=await submittedPaymentResponse.json() as {id?:string;status?:string};
  expect(submittedPayment.id).toBeTruthy();
  expect(submittedPayment.status).toBe('SIMULATED_SUCCESS');

  // This random Auth user has no approver-created demo-profile binding, so
  // the production claim RPC correctly refuses to link this synthetic payment.
  // Seed only the disposable local owner-history index to model an already
  // owned history row; both the Auth API and SQL target must be loopback.
  const paymentId=submittedPayment.id;
  expect(paymentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(ownerA.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  const ownerHistoryFixture=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',
    `insert into public.taxpay_story1_payment_owners(payment_id,owner_uid)
     values ('${paymentId}'::uuid,'${ownerA.id}'::uuid)
     returning payment_id::text;`],{
       encoding:'utf8',timeout:10_000,
       env:{
         ...process.env,
         PGHOST:database.hostname,
         PGPORT:database.port||'5432',
         PGUSER:decodeURIComponent(database.username),
         PGPASSWORD:decodeURIComponent(database.password),
         PGDATABASE:database.pathname.slice(1),
       },
     });
  expect(ownerHistoryFixture.status,ownerHistoryFixture.stderr).toBe(0);
  expect(ownerHistoryFixture.stdout.trim()).toBe(paymentId);

  const readPaymentHistory=async()=>{
    const response=await fetch(new URL('/rest/v1/rpc/taxpay_my_story1_payments',api.origin),{
      method:'POST',
      headers:{apikey:key,Authorization:'Bearer '+ownerA.session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify({p_page:1,p_per_page:100}),
    });
    expect(response.status).toBe(200);
    return response.json() as Promise<{
      items:Array<{id:string;service:string;amountMinor:number;status:string;details:Record<string,unknown>}>;
      total:number;page:number;perPage:number;
    }>;
  };
  const historyBeforeDelete=await readPaymentHistory();
  expect(historyBeforeDelete.total).toBe(1);
  expect(historyBeforeDelete.items).toHaveLength(1);
  expect(historyBeforeDelete.items[0]).toMatchObject({
    id:submittedPayment.id,service:'ADVANCE_TAX',amountMinor:1500,status:'SIMULATED_SUCCESS',
    details:{taxpayerTin:'012345678901',taxpayerName:'Local Beneficiary One'},
  });

  // Exact accepted deletion must round-trip through real owner-scoped SQL.
  // A zero-row RLS/stale delete must never be reported as successful.
  const savedUrl=new URL('/rest/v1/taxpay_beneficiaries',api.origin);
  savedUrl.searchParams.set('select','id,tin');
  savedUrl.searchParams.set('owner_uid','eq.'+ownerA.id);
  const savedResponse=await fetch(savedUrl,{headers:{apikey:key,Authorization:'Bearer '+ownerA.session.access_token}});
  expect(savedResponse.status).toBe(200);
  const savedRows=await savedResponse.json() as Array<{id:string;tin:string}>;
  expect(savedRows).toHaveLength(2);
  const first=savedRows.find(row=>row.tin==='012345678901');
  const second=savedRows.find(row=>row.tin==='987654321098');
  expect(first?.id).toBeTruthy();
  expect(second?.id).toBeTruthy();

  const deleteUrl=(id:string)=>new URL('/rest/v1/taxpay_beneficiaries?id=eq.'+id,api.origin);
  const unauthorizedEdit=await fetch(deleteUrl(first!.id),{
    method:'PATCH',
    headers:{apikey:key,Authorization:'Bearer '+ownerB.session.access_token,
      'Content-Type':'application/json',Prefer:'return=representation'},
    body:JSON.stringify({display_name:'Unauthorized edit',tag:'clients',relationship:null}),
  });
  expect(unauthorizedEdit.status).toBe(200);
  expect(await unauthorizedEdit.json()).toEqual([]);
  expect((await read(ownerA.session.access_token)).find(
    (row:{tin:string})=>row.tin==='012345678901')).toMatchObject({
      owner_uid:ownerA.id,display_name:'Local Beneficiary One',tag:'friends_family',relationship:'father',
    });

  const denied=await fetch(deleteUrl(first!.id),{
    method:'DELETE',
    headers:{apikey:key,Authorization:'Bearer '+ownerB.session.access_token,Prefer:'return=representation'},
  });
  expect(denied.status).toBe(200);
  expect(await denied.json()).toEqual([]);
  expect((await read(ownerA.session.access_token))).toHaveLength(2);

  await page.goto('/?action=beneficiaries');
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByTestId('beneficiary-directory-mobile')).toContainText('Local Beneficiary One');
  await page.getByTestId('beneficiary-directory-mobile').locator('li')
    .filter({hasText:'Local Beneficiary One'})
    .getByRole('button',{name:'Edit',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Edit beneficiary'});
  await expect(editor).toContainText('Local Beneficiary One');
  // Edit must persist the exact mandatory final relationship, not just repaint UI.
  await chooseBeneficiaryOption(editor,'beneficiary-edit-tag','friends_family:friends');
  await editor.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByText('Beneficiary details updated.')).toBeVisible();
  expect((await read(ownerA.session.access_token)).find(
    (row:{tin:string})=>row.tin==='012345678901')).toMatchObject({
      owner_uid:ownerA.id,tag:'friends_family',relationship:'friends',
    });
  await page.reload();
  await expect(page.getByTestId('beneficiary-directory-mobile')).toContainText('Local Beneficiary One');
  await page.getByTestId('beneficiary-directory-mobile').locator('li')
    .filter({hasText:'Local Beneficiary One'})
    .getByRole('button',{name:'Edit',exact:true}).click();
  const updatedEditor=page.getByRole('dialog',{name:'Edit beneficiary'});
  await expect(updatedEditor).toContainText('Local Beneficiary One');
  await updatedEditor.getByRole('button',{name:'Delete beneficiary'}).click();
  const confirmation=page.getByRole('dialog',{name:'Confirm beneficiary removal'});
  await confirmation.getByRole('button',{name:'Remove',exact:true}).click();
  await expect(page.getByText('Beneficiary removed.')).toBeVisible();
  const afterConfirmed=await read(ownerA.session.access_token);
  expect(afterConfirmed).toHaveLength(1);
  expect(afterConfirmed[0].tin).toBe('987654321098');

  // Simulate a legitimate second device removing the remaining contact while
  // the owner's confirmation modal is open. A stale click is a recoverable error.
  await page.getByTestId('beneficiary-directory-mobile').locator('li')
    .filter({hasText:'Local Beneficiary Two'})
    .getByRole('button',{name:'Edit',exact:true}).click();
  const staleEditor=page.getByRole('dialog',{name:'Edit beneficiary'});
  await expect(staleEditor).toContainText('Local Beneficiary Two');
  await staleEditor.getByRole('button',{name:'Delete beneficiary'}).click();
  const staleConfirmation=page.getByRole('dialog',{name:'Confirm beneficiary removal'});
  const concurrent=await fetch(deleteUrl(second!.id),{
    method:'DELETE',
    headers:{apikey:key,Authorization:'Bearer '+ownerA.session.access_token,Prefer:'return=representation'},
  });
  expect(concurrent.status).toBe(200);
  const deletedRows=await concurrent.json() as Array<{id:string}>;
  expect(deletedRows.map(row=>row.id)).toEqual([second!.id]);
  await staleConfirmation.getByRole('button',{name:'Remove',exact:true}).click();
  await expect(staleConfirmation.getByRole('alert')).toContainText(
    'The beneficiary is no longer saved. Refresh and try again.');
  await staleConfirmation.getByRole('button',{name:'Cancel'}).click();
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  expect(await read(ownerA.session.access_token)).toEqual([]);
  expect(await read(ownerB.session.access_token)).toEqual([]);
  expect(await readPaymentHistory()).toEqual(historyBeforeDelete);
  await context.close();
});
