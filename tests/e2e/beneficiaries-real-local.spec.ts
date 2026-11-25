import { openUnifiedSignedInPayment } from './pay-tax-entry-helper';
import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';
import {setWorkspaceLanguage} from './workspace-language';
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

  const modal=await openUnifiedSignedInPayment(page);
  await expect(modal.getByTestId('unified-account-own')).toContainText('Linked taxpayer profile is unavailable.');
  await expect(modal.getByTestId('unified-account-own').getByRole('checkbox')).toHaveCount(0);
  await expect(modal.locator('[data-payer-relationship], [data-payment-entry], [data-payment-access]')).toHaveCount(0);
  await expect(modal.getByRole('button',{name:'Continue to Payment Head'})).toBeDisabled();
  await expect(page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'})).toHaveCount(0);
  const picker=modal.getByTestId('saved-beneficiary-picker');
  await expect(picker.getByRole('button',{name:'Manage beneficiaries'})).toBeVisible({timeout:15000});
  await expect(picker.getByRole('button',{name:/Family/})).toHaveAttribute('aria-expanded','true');
  await expect(picker).toContainText('Local Beneficiary One',{timeout:15000});
  await picker.getByRole('checkbox',{name:'Select Local Beneficiary One'}).check();
  await expect(picker).toContainText('1 selected for this payment');
  await expect(picker).toContainText('012*********');
  await expect(modal.getByTestId('unified-tin-input')).toHaveValue('');
  await expect(modal.locator('#guest-payer-name')).toHaveCount(0);
  await expect(modal.getByTestId('unified-taxpayer-count')).toHaveText('1');
  await expect(modal.getByRole('button',{name:'Continue to Payment Head'})).toBeDisabled();
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
  const ownerHistoryFixture=spawnSync('psql',['-X','-Atq','-v','ON_ERROR_STOP=1','-c',
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

 
// F-059: exercise the 1–80 Others detail boundary through the real UI and owner-scoped local SQL.
test('F-059 Others description enforces the 1–80 character boundary in UI and SQL',async({browser})=>{
  test.setTimeout(90_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL, key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
  if(!raw||!key||!dsn)throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api=new URL(raw), database=new URL(dsn);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing non-loopback beneficiary acceptance');
  if((database.protocol!=='postgres:'&&database.protocol!=='postgresql:')||
    !['localhost','127.0.0.1','[::1]'].includes(database.hostname))
    throw new Error('Refusing non-loopback beneficiary SQL fixture');
  const email='beneficiary-f059-'+randomUUID()+'@example.invalid';
  const password=randomBytes(32).toString('base64url');
  const signup=await fetch(new URL('/auth/v1/signup',api.origin),{
    method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
    body:JSON.stringify({email,password}),
  });
  expect(signup.status).toBe(200);
  const signed=await signup.json();
  expect(signed.user?.id).toBeTruthy();
  const ownerId=signed.user.id as string;
  const initialSession=signed.session??signed;
  expect(initialSession.access_token).toBeTruthy();
  const signIn=async()=>{
    const response=await fetch(new URL('/auth/v1/token?grant_type=password',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),
    });
    expect(response.status).toBe(200);
    const value=await response.json();
    expect(value.user?.id).toBe(ownerId);
    expect(value.access_token).toBeTruthy();
    expect(value.refresh_token).toBeTruthy();
    return value;
  };
  const loginUrl=(session:{access_token:string;refresh_token:string;expires_at?:number})=>
    '/?action=beneficiaries#access_token='+encodeURIComponent(session.access_token)+
    '&refresh_token='+encodeURIComponent(session.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+
    (session.expires_at??Math.floor(Date.now()/1000)+3600);
  const tin='765432109876', name='F059 Boundary Person', labelOne='Q', label80='Z'.repeat(80);
  const read=async(token:string)=>{
    const url=new URL('/rest/v1/taxpay_beneficiaries',api.origin);
    url.searchParams.set('select','id,owner_uid,list_id,tin,display_name,tag,relationship,other_label');
    url.searchParams.set('owner_uid','eq.'+ownerId);
    url.searchParams.set('tin','eq.'+tin);
    const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+token}});
    expect(response.status).toBe(200);
    return response.json() as Promise<Array<{
      id:string;owner_uid:string;list_id:string;tin:string;display_name:string;
      tag:string|null;relationship:string|null;other_label:string|null;
    }>>;
  };
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
  try{
    const page=await context.newPage();
    await page.goto(loginUrl(initialSession));
    await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
    await page.getByRole('button',{name:'Create list',exact:true}).first().click();
    const listDialog=page.getByRole('dialog',{name:'Create list'});
    await listDialog.locator('#beneficiary-create-list-name').fill('F059 validation');
    await listDialog.getByRole('button',{name:'Create list',exact:true}).click();

    await page.getByRole('button',{name:'Add beneficiary',exact:true}).first().click();
    const addDialog=page.getByRole('dialog',{name:'Beneficiary entry'});
    await addDialog.locator('#beneficiary-tin').fill(tin);
    await addDialog.locator('#beneficiary-name').fill(name);
    await chooseBeneficiaryOption(addDialog,'beneficiary-tag','others');
    const addLabel=addDialog.locator('#beneficiary-other-label');
    await expect(addLabel).toHaveAttribute('maxlength','80');
    await addLabel.fill(labelOne);
    await expect(addDialog).toContainText('1/80 characters');
    await addDialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
    await expect(page.getByText('Beneficiary saved.',{exact:true})).toBeVisible({timeout:15000});
    let rows=await read(initialSession.access_token);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      owner_uid:ownerId,tin,display_name:name,tag:'others',relationship:null,other_label:labelOne,
    });
    const directory=page.getByTestId('beneficiary-directory-mobile');
    const savedRow=directory.locator('li').filter({hasText:name});
    await expect(savedRow.locator('.taxpay-mobile-table-card__title span').first())
      .toHaveText(name+' · '+labelOne);

    // Edit the saved Others detail to the exact 80-character limit and verify SQL readback.
    await savedRow.getByRole('button',{name:'Edit',exact:true}).click();
    const editor=page.getByRole('dialog',{name:'Edit beneficiary'});
    const editLabel=editor.locator('#beneficiary-edit-other-label');
    await expect(editLabel).toHaveAttribute('maxlength','80');
    await editLabel.fill(label80);
    await expect(editor).toContainText('80/80 characters');
    await editor.getByRole('button',{name:'Save changes',exact:true}).click();
    await expect(page.getByText('Beneficiary details updated.',{exact:true})).toBeVisible({timeout:15000});
    rows=await read(initialSession.access_token);
    expect(rows).toHaveLength(1);
    const accepted80=rows[0];
    expect(accepted80).toMatchObject({
      owner_uid:ownerId,tin,display_name:name,tag:'others',relationship:null,other_label:label80,
    });
    const updatedRow=directory.locator('li').filter({hasText:name});
    const title=updatedRow.locator('.taxpay-mobile-table-card__title span').first();
    await expect(title).toHaveText(name+' · '+label80);
    expect((await title.innerText()).split(label80)).toHaveLength(2);

    // The approved input prevents an 81st typed character; the mandatory empty detail remains invalid.
    await updatedRow.getByRole('button',{name:'Edit',exact:true}).click();
    const invalidEditor=page.getByRole('dialog',{name:'Edit beneficiary'});
    const invalidLabel=invalidEditor.locator('#beneficiary-edit-other-label');
    await expect(invalidLabel).toHaveAttribute('maxlength','80');
    await invalidLabel.press('End');
    await invalidLabel.pressSequentially('Z');
    await expect(invalidLabel).toHaveValue(label80);
    await invalidLabel.fill('');
    expect(await invalidLabel.evaluate(el=>(el as HTMLInputElement).validity.valueMissing)).toBe(true);
    await expect(invalidEditor.getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();
    await expect(invalidEditor).toBeVisible();
    expect(await read(initialSession.access_token)).toEqual([accepted80]);

    // Bypass the browser control and attempt the same invalid writes against the real local SQL constraint.
    const patchSaved=async(value:string)=>{
      const url=new URL('/rest/v1/taxpay_beneficiaries',api.origin);
      url.searchParams.set('id','eq.'+accepted80.id);
      return fetch(url,{
        method:'PATCH',
        headers:{apikey:key,Authorization:'Bearer '+initialSession.access_token,
          'Content-Type':'application/json',Prefer:'return=representation'},
        body:JSON.stringify({other_label:value}),
      });
    };
    for(const invalidValue of ['', 'Z'.repeat(81)]){
      const rejected=await patchSaved(invalidValue);
      expect(rejected.status).toBe(400);
      expect(await rejected.text()).toContain('taxpay_beneficiary_other_label_consistency');
      expect(await read(initialSession.access_token)).toEqual([accepted80]);
    }

    // Recover after invalid input without losing the selected beneficiary or its list.
    const recoveredLabel='Recovered family contact';
    await invalidLabel.fill(recoveredLabel);
    const recoverySave=invalidEditor.getByRole('button',{name:'Save changes',exact:true});
    await expect(recoverySave).toBeEnabled();
    await recoverySave.click();
    await expect(page.getByText('Beneficiary details updated.',{exact:true})).toBeVisible({timeout:15000});
    await expect(invalidEditor).toBeHidden();
    const recoveredRows=await read(initialSession.access_token);
    expect(recoveredRows).toHaveLength(1);
    const recoveredRow=recoveredRows[0];
    expect(recoveredRow).toMatchObject({
      id:accepted80.id,owner_uid:ownerId,list_id:accepted80.list_id,
      tin,display_name:name,tag:'others',relationship:null,other_label:recoveredLabel,
    });
    const recoveredMobileRow=directory.locator('li').filter({hasText:name});
    const recoveredTitle=recoveredMobileRow.locator('.taxpay-mobile-table-card__title span').first();
    await expect(recoveredTitle).toHaveText(name+' · '+recoveredLabel);
    expect((await recoveredTitle.innerText()).split(recoveredLabel)).toHaveLength(2);

    // A new password-grant session and mobile browser context must read the same exact owner SQL row and label.
    const freshSession=await signIn();
    const freshContext=await browser.newContext({
      baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812},storageState:{cookies:[],origins:[]},
    });
    try{
      const freshPage=await freshContext.newPage();
      await freshPage.goto(loginUrl(freshSession));
      await expect(freshPage.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
      const freshRow=freshPage.getByTestId('beneficiary-directory-mobile').locator('li').filter({hasText:name});
      const freshTitle=freshRow.locator('.taxpay-mobile-table-card__title span').first();
      await expect(freshTitle).toHaveText(name+' · '+recoveredLabel);
      expect((await read(freshSession.access_token))).toEqual([recoveredRow]);
    }finally{
      await freshContext.close();
    }
  }finally{
    await context.close();
  }
});

// F-060: every approved category/relation pair must persist through owner SQL
// and render its single final label in English and Bengali.
test('F-060 supported beneficiary categories persist and recover without duplicate final tags',async({browser})=>{
  test.setTimeout(150_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL, key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
  if(!raw||!key||!dsn)throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api=new URL(raw), database=new URL(dsn);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing non-loopback beneficiary acceptance');
  if((database.protocol!=='postgres:'&&database.protocol!=='postgresql:')||
    !['localhost','127.0.0.1','[::1]'].includes(database.hostname))
    throw new Error('Refusing non-loopback beneficiary SQL fixture');

  const email='beneficiary-f060-'+randomUUID()+'@example.invalid';
  const password=randomBytes(32).toString('base64url');
  const signup=await fetch(new URL('/auth/v1/signup',api.origin),{
    method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
    body:JSON.stringify({email,password}),
    signal:AbortSignal.timeout(15000),
  });
  expect(signup.status).toBe(200);
  const signed=await signup.json();
  expect(signed.user?.id).toBeTruthy();
  const ownerId=signed.user.id as string;
  const initialSession=signed.session??signed;
  expect(initialSession.access_token).toBeTruthy();
  const signIn=async()=>{
    const response=await fetch(new URL('/auth/v1/token?grant_type=password',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),
      signal:AbortSignal.timeout(15000),
    });
    expect(response.status).toBe(200);
    const value=await response.json();
    expect(value.user?.id).toBe(ownerId);
    expect(value.access_token).toBeTruthy();
    expect(value.refresh_token).toBeTruthy();
    return value;
  };
  const loginUrl=(session:{access_token:string;refresh_token:string;expires_at?:number})=>
    '/?action=beneficiaries#access_token='+encodeURIComponent(session.access_token)+
    '&refresh_token='+encodeURIComponent(session.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+
    (session.expires_at??Math.floor(Date.now()/1000)+3600);

  const choices=[
    {value:'clients',tag:'clients',relationship:null,other_label:null,en:'Clients',bn:'ক্লায়েন্ট'},
    {value:'friends_family:father',tag:'friends_family',relationship:'father',other_label:null,en:'Father',bn:'বাবা'},
    {value:'friends_family:mother',tag:'friends_family',relationship:'mother',other_label:null,en:'Mother',bn:'মা'},
    {value:'friends_family:siblings',tag:'friends_family',relationship:'siblings',other_label:null,en:'Siblings',bn:'ভাইবোন'},
    {value:'friends_family:son',tag:'friends_family',relationship:'son',other_label:null,en:'Son',bn:'ছেলে'},
    {value:'friends_family:daughter',tag:'friends_family',relationship:'daughter',other_label:null,en:'Daughter',bn:'মেয়ে'},
    {value:'friends_family:spouse',tag:'friends_family',relationship:'spouse',other_label:null,en:'Spouse',bn:'স্বামী/স্ত্রী'},
    {value:'friends_family:friends',tag:'friends_family',relationship:'friends',other_label:null,en:'Friends',bn:'বন্ধু'},
    {value:'others',tag:'others',relationship:null,other_label:'Service contact',en:'Service contact',bn:'Service contact'},
  ] as const;
  const records=choices.map((choice,index)=>({
    ...choice,tin:String(765432109000+index),name:'F060 Person '+(index+1),
  }));
  type SavedRow={id:string;owner_uid:string;list_id:string;tin:string;display_name:string;
    tag:string|null;relationship:string|null;other_label:string|null};
  const read=async(token:string)=>{
    const url=new URL('/rest/v1/taxpay_beneficiaries',api.origin);
    url.searchParams.set('select','id,owner_uid,list_id,tin,display_name,tag,relationship,other_label');
    url.searchParams.set('owner_uid','eq.'+ownerId);
    url.searchParams.set('order','tin.asc');
    const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
    expect(response.status).toBe(200);
    return response.json() as Promise<SavedRow[]>;
  };
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
  const closeContext=async(value:import('@playwright/test').BrowserContext)=>{
    if(test.info().status!=='timedOut')await value.close();
  };
  try{
    const page=await context.newPage();
    await page.goto(loginUrl(initialSession));
    await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
    await expect(page.getByRole('heading',{name:'Beneficiaries',exact:true})).toBeVisible();
    console.info('[F060] owner session and beneficiary UI ready');
    for(let index=0;index<records.length;index++){
      const record=records[index];
      console.info('[F060] adding '+record.value);
      await page.getByRole('button',{name:'Add beneficiary',exact:true}).first().click();
      const dialog=page.getByRole('dialog',{name:'Beneficiary entry'});
      await expect(dialog).toBeVisible();
      console.info('[F060] add form opened');
      await dialog.locator('#beneficiary-tin').fill(record.tin);
      await dialog.locator('#beneficiary-name').fill(record.name);
      console.info('[F060] taxpayer identity entered');
      await dialog.locator('#beneficiary-tag').click();
      const optionRoot=dialog.locator('#beneficiary-tag-options');
      const options=optionRoot.locator('[role="option"]');
      console.info('[F060] category menu opened with '+await options.count()+' options');
      if(index===0){
        const values=await options.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-option-value')).filter(Boolean).sort());
        expect(values).toEqual(choices.map(choice=>choice.value).sort());
      }
      await optionRoot.locator('[role="option"][data-option-value="'+record.value+'"]').click();
      console.info('[F060] category selected '+record.value);
      if(record.tag==='others')await dialog.locator('#beneficiary-other-label').fill(record.other_label!);
      if(index===0)await dialog.locator('#beneficiary-new-list-name').fill('F060 supported categories');
      console.info('[F060] required category details entered');
      await dialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
      console.info('[F060] add submitted '+record.value);
      await expect(page.getByText('Beneficiary saved.',{exact:true})).toBeVisible({timeout:15000});
      console.info('[F060] saved '+record.value);
    }

    const directory=page.getByTestId('beneficiary-directory-mobile');
    await expect(directory.locator('li')).toHaveCount(records.length);
    const initialRows=await read(initialSession.access_token);
    expect(initialRows).toHaveLength(records.length);
    expect(new Set(initialRows.map(row=>row.id)).size).toBe(records.length);
    expect(new Set(initialRows.map(row=>row.list_id)).size).toBe(1);
    console.info('[F060] all nine owner SQL rows and mobile labels verified');
    for(const record of records){
      const saved=initialRows.find(row=>row.tin===record.tin);
      expect(saved).toMatchObject({
        owner_uid:ownerId,tin:record.tin,display_name:record.name,
        tag:record.tag,relationship:record.relationship,other_label:record.other_label,
      });
      const item=directory.locator('li').filter({hasText:record.name});
      const title=item.locator('.taxpay-mobile-table-card__title span').first();
      await expect(title).toHaveText(record.name+' · '+record.en);
      expect((await title.innerText()).split(record.en)).toHaveLength(2);
      expect(await title.innerText()).not.toContain('Friends & family members');
    }
    console.info('[F060] approved desktop directory verified');

    // The approved desktop directory uses the same final labels and one row per saved record.
    await page.setViewportSize({width:1280,height:900});
    const desktop=page.getByTestId('beneficiary-directory-desktop');
    await expect(desktop).toBeVisible();
    await expect(desktop.locator('tbody tr')).toHaveCount(records.length);
    for(const record of records){
      const row=desktop.locator('tbody tr').filter({hasText:record.name});
      await expect(row.locator('.taxpayer-transaction-row__title')).toHaveText(record.name+' · '+record.en);
    }
    await page.setViewportSize({width:375,height:812});

    // An unsupported relation must be rejected by SQL and leave the saved row intact.
    const fatherRecord=records.find(record=>record.value==='friends_family:father')!;
    const fatherBefore=initialRows.find(row=>row.tin===fatherRecord.tin)!;
    const invalidUrl=new URL('/rest/v1/taxpay_beneficiaries',api.origin);
    invalidUrl.searchParams.set('id','eq.'+fatherBefore.id);
    const rejected=await fetch(invalidUrl,{
      method:'PATCH',headers:{apikey:key,Authorization:'Bearer '+initialSession.access_token,
        'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify({relationship:'cousin'}),
      signal:AbortSignal.timeout(15000),
    });
    expect(rejected.status).toBe(400);
    expect(await rejected.text()).toContain('taxpay_beneficiary_fixed_tag_pair');
    expect(await read(initialSession.access_token)).toEqual(initialRows);
    console.info('[F060] unsupported relation rejected without row mutation');

    // Cancel leaves Father saved; retrying the edit to Mother preserves owner, row and list.
    const fatherItem=directory.locator('li').filter({hasText:fatherRecord.name});
    await fatherItem.getByRole('button',{name:'Edit',exact:true}).click();
    const cancelledEditor=page.getByRole('dialog',{name:'Edit beneficiary'});
    await chooseBeneficiaryOption(cancelledEditor,'beneficiary-edit-tag','friends_family:mother');
    await cancelledEditor.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(cancelledEditor).toBeHidden();
    expect(await read(initialSession.access_token)).toEqual(initialRows);
    await expect(fatherItem.locator('.taxpay-mobile-table-card__title span').first()).toHaveText(fatherRecord.name+' · Father');
    console.info('[F060] cancelled edit preserved Father');

    await fatherItem.getByRole('button',{name:'Edit',exact:true}).click();
    const retryEditor=page.getByRole('dialog',{name:'Edit beneficiary'});
    await chooseBeneficiaryOption(retryEditor,'beneficiary-edit-tag','friends_family:mother');
    await retryEditor.getByRole('button',{name:'Save changes',exact:true}).click();
    await expect(page.getByText('Beneficiary details updated.',{exact:true})).toBeVisible({timeout:15000});
    await expect(retryEditor).toBeHidden();
    const savedRows=await read(initialSession.access_token);
    expect(savedRows).toHaveLength(records.length);
    const updatedFather=savedRows.find(row=>row.tin===fatherRecord.tin)!;
    expect(updatedFather).toMatchObject({
      id:fatherBefore.id,owner_uid:fatherBefore.owner_uid,list_id:fatherBefore.list_id,
      tin:fatherBefore.tin,display_name:fatherBefore.display_name,tag:'friends_family',relationship:'mother',other_label:null,
    });
    await expect(directory.locator('li').filter({hasText:fatherRecord.name})
      .locator('.taxpay-mobile-table-card__title span').first()).toHaveText(fatherRecord.name+' · Mother');
    console.info('[F060] retry saved Mother on the same row and list');

    // A fresh same-owner login reads every exact row, then the same final tags in Bengali.
    const freshSession=await signIn();
    const freshContext=await browser.newContext({
      baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812},storageState:{cookies:[],origins:[]},
    });
    try{
      const freshPage=await freshContext.newPage();
      await freshPage.goto(loginUrl(freshSession));
      await expect(freshPage.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
      const freshDirectory=freshPage.getByTestId('beneficiary-directory-mobile');
      await expect(freshDirectory.locator('li')).toHaveCount(records.length);
      expect(await read(freshSession.access_token)).toEqual(savedRows);
      for(const record of records){
        const label=record.value==='friends_family:father'?'Mother':record.en;
        await expect(freshDirectory.locator('li').filter({hasText:record.name})
          .locator('.taxpay-mobile-table-card__title span').first()).toHaveText(record.name+' · '+label);
      }
      console.info('[F060] fresh same-owner English readback verified');
      await setWorkspaceLanguage(freshPage,'bn');
      for(const record of records){
        const label=record.value==='friends_family:father'?'মা':record.bn;
        await expect(freshDirectory.locator('li').filter({hasText:record.name})
          .locator('.taxpay-mobile-table-card__title span').first()).toHaveText(record.name+' · '+label);
      }
      console.info('[F060] fresh same-owner Bengali readback verified');
    }finally{
      await closeContext(freshContext);
    }
  }finally{
    await closeContext(context);
  }
});

// F-061 scoped SQL-first evidence: one owner's search/filter result must be an
// exact subset of that owner's SQL rows on the approved desktop/mobile views.
test('F-061 beneficiary search and filters match owner-scoped SQL rows',async({browser})=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL, key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
  if(!raw||!key||!dsn)throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api=new URL(raw), database=new URL(dsn);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing non-loopback beneficiary acceptance');
  if((database.protocol!=='postgres:'&&database.protocol!=='postgresql:')||
    !['localhost','127.0.0.1','[::1]'].includes(database.hostname))
    throw new Error('Refusing non-loopback beneficiary SQL fixture');

  type Session={access_token:string;refresh_token:string;expires_at?:number};
  type User={id:string;email:string;session:Session};
  type List={id:string;owner_uid:string;name:string};
  type SavedRow={id:string;owner_uid:string;list_id:string;tin:string;display_name:string;
    tag:string|null;relationship:string|null;other_label:string|null};
  const createUser=async():Promise<User>=>{
    const email='beneficiary-f061-'+randomUUID()+'@example.invalid';
    const password=randomBytes(32).toString('base64url');
    const response=await fetch(new URL('/auth/v1/signup',api.origin),{
      method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15000),
    });
    const body=await response.text();
    expect(response.status,body).toBe(200);
    const signed=JSON.parse(body);
    expect(signed.user?.id).toBeTruthy();
    const session=signed.session??signed;
    expect(session.access_token).toBeTruthy();
    expect(session.refresh_token).toBeTruthy();
    return {id:signed.user.id,email,session};
  };
  const ownerA=await createUser(),ownerB=await createUser();
  expect(ownerA.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(ownerB.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  const loginUrl=(session:Session)=>
    '/?action=beneficiaries#access_token='+encodeURIComponent(session.access_token)+
    '&refresh_token='+encodeURIComponent(session.refresh_token)+
    '&token_type=bearer&expires_in=3600&expires_at='+
    (session.expires_at??Math.floor(Date.now()/1000)+3600);
  const insert=async<T>(table:string,token:string,columns:string,payload:unknown):Promise<T[]>=>{
    const url=new URL('/rest/v1/'+table,api.origin);
    url.searchParams.set('select',columns);
    const response=await fetch(url,{
      method:'POST',
      headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(15000),
    });
    const body=await response.text();
    expect(response.status,body).toBe(201);
    return JSON.parse(body) as T[];
  };
  const listsA=await insert<List>('taxpay_beneficiary_lists',ownerA.session.access_token,
    'id,owner_uid,name',[
      {owner_uid:ownerA.id,name:'F061 Alpha'},
      {owner_uid:ownerA.id,name:'F061 Beta'},
    ]);
  const listsB=await insert<List>('taxpay_beneficiary_lists',ownerB.session.access_token,
    'id,owner_uid,name',[{owner_uid:ownerB.id,name:'F061 Private'}]);
  expect(listsA).toHaveLength(2);
  expect(listsB).toHaveLength(1);
  const alpha=listsA.find(list=>list.name==='F061 Alpha')!;
  const beta=listsA.find(list=>list.name==='F061 Beta')!;
  const rowsA=await insert<SavedRow>('taxpay_beneficiaries',ownerA.session.access_token,
    'id,owner_uid,list_id,tin,display_name,tag,relationship,other_label',[
      {owner_uid:ownerA.id,list_id:alpha.id,tin:'765432100001',display_name:'F061 Zahra',tag:'clients',relationship:null,other_label:null},
      {owner_uid:ownerA.id,list_id:alpha.id,tin:'765432100002',display_name:'F061 Nabil',tag:'friends_family',relationship:'father',other_label:null},
      {owner_uid:ownerA.id,list_id:beta.id,tin:'765432100003',display_name:'F061 Mina',tag:'others',relationship:null,other_label:'Tax adviser'},
    ]);
  const rowsB=await insert<SavedRow>('taxpay_beneficiaries',ownerB.session.access_token,
    'id,owner_uid,list_id,tin,display_name,tag,relationship,other_label',[
      {owner_uid:ownerB.id,list_id:listsB[0].id,tin:'765432100004',display_name:'F061 Mina',tag:'clients',relationship:null,other_label:null},
    ]);
  expect(rowsA).toHaveLength(3);
  expect(rowsB).toHaveLength(1);

  const readApi=async(token:string,ownerId:string)=>{
    const url=new URL('/rest/v1/taxpay_beneficiaries',api.origin);
    url.searchParams.set('select','id,owner_uid,list_id,tin,display_name,tag,relationship,other_label');
    url.searchParams.set('owner_uid','eq.'+ownerId);
    url.searchParams.set('order','tin.asc');
    const response=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
    const body=await response.text();
    expect(response.status,body).toBe(200);
    return JSON.parse(body) as SavedRow[];
  };
  const sqlRows=spawnSync('psql',['-X','-Atq','-v','ON_ERROR_STOP=1','-c',
    `select coalesce(json_agg(to_jsonb(q) order by q.tin)::text,'[]') from (
       select id::text,owner_uid::text,list_id::text,tin,display_name,tag,relationship,other_label
       from public.taxpay_beneficiaries where owner_uid='${ownerA.id}'::uuid
     ) q;`],{
       encoding:'utf8',timeout:10_000,
       env:{...process.env,PGHOST:database.hostname,PGPORT:database.port||'5432',
         PGUSER:decodeURIComponent(database.username),PGPASSWORD:decodeURIComponent(database.password),
         PGDATABASE:database.pathname.slice(1)},
     });
  expect(sqlRows.status,sqlRows.stderr).toBe(0);
  const authoritativeRows=JSON.parse(sqlRows.stdout.trim()) as SavedRow[];
  expect(authoritativeRows).toEqual([...rowsA].sort((a,b)=>a.tin.localeCompare(b.tin)));
  expect(await readApi(ownerA.session.access_token,ownerA.id)).toEqual(authoritativeRows);
  expect(await readApi(ownerB.session.access_token,ownerA.id)).toEqual([]);

  const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:375,height:812}});
  try{
    const page=await context.newPage();
    await page.goto(loginUrl(ownerA.session));
    await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
    await expect(page.getByRole('heading',{name:'Beneficiaries',exact:true})).toBeVisible();
    const mobile=page.getByTestId('beneficiary-directory-mobile');
    await expect(mobile.locator('li')).toHaveCount(authoritativeRows.length);
    for(const row of authoritativeRows)await expect(mobile.locator('li').filter({hasText:row.display_name})).toHaveCount(1);
    await expect(mobile.locator('li').filter({hasText:'F061 Mina'})).toHaveCount(1);

    const search=page.getByPlaceholder('Name or TIN');
    await search.fill('765432100002');
    await expect(mobile.locator('li')).toHaveCount(1);
    await expect(mobile.locator('li').first()).toContainText('F061 Nabil');
    await search.fill('F061 Mina');
    await expect(mobile.locator('li')).toHaveCount(1);
    await expect(mobile.locator('li').first()).toContainText('F061 Mina');
    await search.fill('no matching local row');
    await expect(mobile.locator('li')).toHaveCount(0);
    await expect(page.getByText('No matching beneficiaries',{exact:true})).toBeVisible();
    await search.fill('');

    await page.getByRole('button',{name:'Filter',exact:true}).click();
    await chooseBeneficiaryOption(page,'beneficiary-filter-tag','clients');
    await expect(mobile.locator('li')).toHaveCount(1);
    await expect(mobile.locator('li').first()).toContainText('F061 Zahra');
    await chooseBeneficiaryOption(page,'beneficiary-filter-tag','friends_family:father');
    await expect(mobile.locator('li')).toHaveCount(1);
    await expect(mobile.locator('li').first()).toContainText('F061 Nabil');

    const listButton=page.locator('#beneficiary-list');
    await listButton.click();
    const listMenu=page.getByRole('dialog',{name:'Choose beneficiary list'});
    await listMenu.getByRole('button',{name:'F061 Beta',exact:true}).click();
    await expect(mobile.locator('li')).toHaveCount(1);
    await expect(mobile.locator('li').first()).toContainText('F061 Mina');
    await expect(page.getByTestId('beneficiary-directory-desktop')).toBeHidden();

    await listButton.click();
    await page.getByRole('dialog',{name:'Choose beneficiary list'})
      .getByRole('button',{name:'All beneficiaries',exact:true}).click();
    await page.setViewportSize({width:1280,height:900});
    const desktop=page.getByTestId('beneficiary-directory-desktop');
    await expect(desktop).toBeVisible();
    await expect(desktop.locator('tbody tr')).toHaveCount(authoritativeRows.length);
    const zahra=desktop.locator('tbody tr').filter({hasText:'F061 Zahra'});
    await expect(zahra.getByRole('button',{name:'Edit',exact:true})).toHaveClass(/beneficiary-directory__secondary/);
    await expect(zahra.getByRole('button',{name:'Make payment',exact:true})).toHaveClass(/beneficiary-directory__pay/);

    await setWorkspaceLanguage(page,'bn');
    await expect(page.getByPlaceholder('নাম বা টিআইএন')).toBeVisible();
    await page.getByPlaceholder('নাম বা টিআইএন').fill('765432100002');
    await expect(desktop.locator('tbody tr')).toHaveCount(1);
    await expect(desktop.locator('tbody tr').first()).toContainText('F061 Nabil');
    await expect(desktop.locator('tbody tr').first().getByRole('button',{name:'সম্পাদনা',exact:true})).toBeVisible();
    await expect(desktop.locator('tbody tr').first().getByRole('button',{name:'পেমেন্ট করুন',exact:true})).toBeVisible();
  }finally{
    await context.close();
  }
});

// F-063 owner boundary, cross-session persistence, and direct SQL readback.
type F063Session = { access_token: string; refresh_token: string; expires_at?: number };
type F063Owner = { id: string; email: string; password: string; session: F063Session };
type F063SavedRow = {
  id: string;
  owner_uid: string;
  list_id: string;
  tin: string;
  display_name: string;
  tag: string | null;
  relationship: string | null;
  other_label: string | null;
  list_owner_uid: string;
  list_name: string;
};

test('F-063 saved beneficiaries persist across owners sessions and resist cross-owner reads and writes', async ({ browser }) => {
  test.setTimeout(120_000);
  const raw = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  const dsn = process.env.TAXPAY_LOCAL_PG_DSN;
  if (!raw || !key || !dsn) throw new Error('BLOCKED: disposable local Supabase credentials required');

  const api = new URL(raw);
  const database = new URL(dsn);
  if (api.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)) {
    throw new Error('Refusing non-loopback beneficiary acceptance');
  }
  if ((database.protocol !== 'postgres:' && database.protocol !== 'postgresql:') ||
    !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) {
    throw new Error('Refusing non-loopback beneficiary SQL fixture');
  }

  const makeOwner = async (): Promise<F063Owner> => {
    const email = `beneficiary-f063-${randomUUID()}@example.invalid`;
    const password = randomBytes(32).toString('base64url');
    const response = await fetch(new URL('/auth/v1/signup', api.origin), {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    expect(response.status, body).toBe(200);
    const value = JSON.parse(body);
    const session = value.session ?? value;
    expect(value.user?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(session.access_token).toBeTruthy();
    expect(session.refresh_token).toBeTruthy();
    return { id: value.user.id, email, password, session };
  };

  const signIn = async (owner: F063Owner): Promise<F063Session> => {
    const response = await fetch(new URL('/auth/v1/token?grant_type=password', api.origin), {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: owner.email, password: owner.password }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    expect(response.status, body).toBe(200);
    const value = JSON.parse(body);
    expect(value.user?.id).toBe(owner.id);
    expect(value.access_token).toBeTruthy();
    expect(value.refresh_token).toBeTruthy();
    return value;
  };

  const loginUrl = (session: F063Session) =>
    '/?action=beneficiaries#access_token=' + encodeURIComponent(session.access_token) +
    '&refresh_token=' + encodeURIComponent(session.refresh_token) +
    '&token_type=bearer&expires_in=3600&expires_at=' +
    (session.expires_at ?? Math.floor(Date.now() / 1000) + 3600);

  const sqlRows = (ownerUid: string, tin: string): F063SavedRow[] => {
    expect(ownerUid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(tin).toMatch(/^\d{12}$/);
    const query = `select coalesce(json_agg(to_jsonb(q) order by q.tin)::text,'[]') from (
      select b.id::text,b.owner_uid::text,b.list_id::text,b.tin,b.display_name,b.tag,
        b.relationship,b.other_label,l.owner_uid::text as list_owner_uid,l.name as list_name
      from public.taxpay_beneficiaries b
      join public.taxpay_beneficiary_lists l on l.id=b.list_id
      where b.owner_uid='${ownerUid}'::uuid and b.tin='${tin}'
    ) q;`;
    const result = spawnSync('psql', ['-X', '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', query], {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        PGHOST: database.hostname,
        PGPORT: database.port || '5432',
        PGUSER: decodeURIComponent(database.username),
        PGPASSWORD: decodeURIComponent(database.password),
        PGDATABASE: database.pathname.slice(1),
      },
    });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout.trim()) as F063SavedRow[];
  };

  const directReadByTin = async (token: string, tin: string) => {
    const url = new URL('/rest/v1/taxpay_beneficiaries', api.origin);
    url.searchParams.set('select', 'id,owner_uid,list_id,tin,display_name,tag,relationship,other_label');
    url.searchParams.set('tin', `eq.${tin}`);
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    expect(response.status, body).toBe(200);
    return JSON.parse(body) as Array<Record<string, unknown>>;
  };

  const projectUse = test.info().project.use as { viewport?: { width: number; height: number } };
  const viewport = projectUse.viewport ?? { width: 1280, height: 800 };
  const rowLocator = (page: import('@playwright/test').Page) => viewport.width < 768
    ? page.getByTestId('beneficiary-directory-mobile').locator('li')
    : page.getByTestId('beneficiary-directory-desktop').locator('tbody tr');
  const contexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = [];

  try {
    const ownerA = await makeOwner();
    const ownerB = await makeOwner();
    const ownerIds = [ownerA.id, ownerB.id];
    for (const ownerId of ownerIds) expect(ownerId).toMatch(/^[0-9a-f-]{36}$/i);
    const tin = Array.from(randomBytes(12), byte => String(byte % 10)).join('');
    const displayName = `F063 owner record ${randomUUID().slice(0, 8)}`;
    const listName = `F063 private list ${randomUUID().slice(0, 8)}`;

    const ownerAContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173', viewport, storageState: { cookies: [], origins: [] },
    });
    contexts.push(ownerAContext);
    const ownerAPage = await ownerAContext.newPage();
    await ownerAPage.goto(loginUrl(ownerA.session));
    await expect(ownerAPage.getByTestId('beneficiaries-page')).toBeVisible({ timeout: 15_000 });
    await ownerAPage.getByRole('button', { name: 'Create list', exact: true }).first().click();
    const createList = ownerAPage.getByRole('dialog', { name: 'Create list' });
    await createList.locator('#beneficiary-create-list-name').fill(listName);
    await createList.getByRole('button', { name: 'Create list', exact: true }).click();
    await ownerAPage.getByRole('button', { name: 'Add beneficiary', exact: true }).click();
    const add = ownerAPage.getByRole('dialog', { name: 'Beneficiary entry' });
    await expect(add).toBeVisible();
    await add.locator('#beneficiary-tin').fill(tin);
    await add.locator('#beneficiary-name').fill(displayName);
    await chooseBeneficiaryOption(add, 'beneficiary-tag', 'friends_family:father');
    await add.getByRole('button', { name: 'Add beneficiary', exact: true }).click();
    await expect(ownerAPage.getByText('Beneficiary saved.')).toBeVisible({ timeout: 15_000 });
    await expect(rowLocator(ownerAPage).filter({ hasText: displayName })).toHaveCount(1);

    const authoritative = sqlRows(ownerA.id, tin);
    expect(authoritative).toHaveLength(1);
    const saved = authoritative[0];
    expect(saved).toMatchObject({
      owner_uid: ownerA.id,
      tin,
      display_name: displayName,
      tag: 'friends_family',
      relationship: 'father',
      other_label: null,
      list_owner_uid: ownerA.id,
      list_name: listName,
    });
    expect(await directReadByTin(ownerA.session.access_token, tin)).toEqual([{
      id: saved.id,
      owner_uid: saved.owner_uid,
      list_id: saved.list_id,
      tin: saved.tin,
      display_name: saved.display_name,
      tag: saved.tag,
      relationship: saved.relationship,
      other_label: saved.other_label,
    }]);

    // A distinct browser session for B must not see A's known TIN in UI or API.
    const ownerBContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173', viewport, storageState: { cookies: [], origins: [] },
    });
    contexts.push(ownerBContext);
    const ownerBPage = await ownerBContext.newPage();
    const ownerBSession = await signIn(ownerB);
    await ownerBPage.goto(loginUrl(ownerBSession));
    await expect(ownerBPage.getByTestId('beneficiaries-page')).toBeVisible({ timeout: 15_000 });
    await ownerBPage.getByPlaceholder('Name or TIN').fill(tin);
    await expect(rowLocator(ownerBPage).filter({ hasText: displayName })).toHaveCount(0);
    expect(await directReadByTin(ownerBSession.access_token, tin)).toEqual([]);

    const knownRecord = new URL('/rest/v1/taxpay_beneficiaries', api.origin);
    knownRecord.searchParams.set('id', `eq.${saved.id}`);
    knownRecord.searchParams.set('owner_uid', `eq.${ownerA.id}`);
    knownRecord.searchParams.set('tin', `eq.${tin}`);
    const writeHeaders = {
      apikey: key,
      Authorization: `Bearer ${ownerBSession.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    for (const [method, body] of [
      ['PATCH', { display_name: `${displayName} altered by B` }],
      ['DELETE', undefined],
    ] as const) {
      const response = await fetch(knownRecord, {
        method,
        headers: writeHeaders,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
      expect([200, 204, 401, 403], `${method} must be denied or return no affected row`).toContain(response.status);
      if (response.status === 200) expect(await response.json()).toEqual([]);
      expect(sqlRows(ownerA.id, tin)).toEqual(authoritative);
    }

    // Sign A out in its original browser, then switch that same browser to B.
    // No stale A row may survive the session boundary.
    await ownerAPage.goto('/?action=account_profile');
    const signOut = ownerAPage.getByRole('button', { name: /Sign out|সাইন আউট/ }).last();
    await expect(signOut).toBeVisible();
    await signOut.click();
    await expect(ownerAPage).toHaveURL(/(?:[?&]action=landing|\/$)/);
    await expect.poll(() => ownerAPage.evaluate(() => localStorage.getItem('sb-nbr-taxpay-test-auth-token'))).toBeNull();
    await expect(ownerAPage.getByText(displayName, { exact: false })).toHaveCount(0);
    const switchedBSession = await signIn(ownerB);
    await ownerAPage.goto(loginUrl(switchedBSession));
    await expect(ownerAPage.getByTestId('beneficiaries-page')).toBeVisible({ timeout: 15_000 });
    await ownerAPage.getByPlaceholder('Name or TIN').fill(tin);
    await expect(rowLocator(ownerAPage).filter({ hasText: displayName })).toHaveCount(0);

    // A's fresh authenticated browser still reads the unchanged SQL-owned row.
    const ownerAReturnContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:4173', viewport, storageState: { cookies: [], origins: [] },
    });
    contexts.push(ownerAReturnContext);
    const ownerAReturnPage = await ownerAReturnContext.newPage();
    const ownerAReturnSession = await signIn(ownerA);
    await ownerAReturnPage.goto(loginUrl(ownerAReturnSession));
    await expect(ownerAReturnPage.getByTestId('beneficiaries-page')).toBeVisible({ timeout: 15_000 });
    await expect(rowLocator(ownerAReturnPage).filter({ hasText: displayName })).toHaveCount(1);
    await ownerAReturnPage.reload();
    await expect(rowLocator(ownerAReturnPage).filter({ hasText: displayName })).toHaveCount(1);
    expect(sqlRows(ownerA.id, tin)).toEqual(authoritative);
    expect(await directReadByTin(ownerAReturnSession.access_token, tin)).toEqual([{
      id: saved.id,
      owner_uid: saved.owner_uid,
      list_id: saved.list_id,
      tin: saved.tin,
      display_name: saved.display_name,
      tag: saved.tag,
      relationship: saved.relationship,
      other_label: saved.other_label,
    }]);
  } finally {
    for (const context of contexts.reverse()) await context.close();
  }
});
