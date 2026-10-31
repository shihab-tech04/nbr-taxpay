import {expect,test} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

// Real disposable Auth + PostgREST. Fail closed if pointed at any hosted database.
test('real account saves private beneficiary, reopens it, isolates another owner and prefills Pay Tax',async({browser})=>{
  test.setTimeout(120_000);
  const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL, key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  if(!raw||!key)throw new Error('BLOCKED: disposable local Supabase credentials required');
  const api=new URL(raw);
  if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname))
    throw new Error('Refusing non-loopback beneficiary acceptance');
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
    return {id:value.user.id as string,session};
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
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Add one beneficiary'}).click();
  const addDialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await addDialog.locator('#beneficiary-tin').fill('012345678901');
  await addDialog.locator('#beneficiary-name').fill('Local Beneficiary One');
  await addDialog.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await expect(page.getByText('Beneficiary saved.')).toBeVisible({timeout:15000});
  await expect(records).toContainText('012345678901');
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(records).toContainText('Local Beneficiary One');

  // Import a genuine compressed Excel workbook: one duplicate and one valid new beneficiary.
  await page.getByRole('button',{name:'Add beneficiary',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose how to add beneficiaries'}).getByRole('button',{name:'Import from Excel'}).click();
  await page.locator('#beneficiary-file').setInputFiles({
    name:'beneficiaries-two-rows.xlsx',
    mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer:Buffer.from(readFileSync('tests/fixtures/beneficiary-two-rows.xlsx.base64','utf8').trim(),'base64'),
  });
  const importAlerts=await page.locator('[role="alert"]').allTextContents();
  const importDialog=page.getByRole('dialog',{name:'Beneficiary entry'});
  await expect(importDialog.getByText(/Upload ready:/),'Excel parser / import errors: '+JSON.stringify(importAlerts)).toBeVisible();
  await importDialog.getByRole('button',{name:'Next',exact:true}).click();
  await expect(importDialog.getByText('Already saved in this list.')).toBeVisible();
  await expect(importDialog.getByText('1 valid, 1 needing attention')).toBeVisible();
  await importDialog.getByRole('button',{name:'Next',exact:true}).click();
  await importDialog.getByRole('button',{name:'Finish import'}).click();
  await expect(page.getByText('1 beneficiaries added to the list.')).toBeVisible({timeout:15000});
  await expect(records).toContainText('Local Beneficiary Two');
  await page.reload();
  await expect(records).toContainText('Local Beneficiary Two');

  const read=async(token:string)=>{
    const response=await fetch(new URL('/rest/v1/taxpay_beneficiaries?select=owner_uid,tin,display_name',api.origin),{
      headers:{apikey:key,Authorization:'Bearer '+token},
    });
    expect(response.status).toBe(200);
    return response.json();
  };
  const own=await read(ownerA.session.access_token);
  expect(own).toHaveLength(2);
  expect(own).toEqual(expect.arrayContaining([{owner_uid:ownerA.id,tin:'012345678901',display_name:'Local Beneficiary One'},{owner_uid:ownerA.id,tin:'987654321098',display_name:'Local Beneficiary Two'}]));
  expect(await read(ownerB.session.access_token)).toEqual([]);

  const otherContext=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:320,height:720}});
  const otherPage=await otherContext.newPage();
  await otherPage.goto(loginUrl(ownerB.session));
  await expect(otherPage.getByTestId('beneficiaries-page')).toBeVisible({timeout:15000});
  await expect(otherPage.getByText('Local Beneficiary One')).toHaveCount(0);
  await otherContext.close();

  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).first().click();
  const modal=page.getByRole('dialog',{name:'Pay Tax'});
  // Real Supabase Auth must render the same approved three-section entry UI.
  await expect(modal.locator('[data-payer-relationship]')).toHaveCount(2);
  await modal.locator('[data-payer-relationship="OTHER"]').click();
  await modal.locator('[data-payment-entry="OTHER_TAX"]').click();
  await expect(modal.locator('[data-payment-access]')).toHaveCount(2);
  await expect(modal.locator('[data-payment-access="ACCOUNT"]')).toHaveAttribute('aria-pressed','true');
  await expect(modal.locator('[data-payment-access="GUEST"]')).toBeVisible();
  await expect(modal.locator('[data-payer-relationship]')).toHaveCount(2);
  await expect(modal.locator('[data-payment-entry]')).toHaveCount(2);
  await modal.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(modal.getByText('Continuing with your account')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toHaveCount(0);
  const picker=modal.getByTestId('saved-beneficiary-picker');
  await expect(picker).toContainText('Local Beneficiary One',{timeout:15000});
  await picker.locator('label').filter({hasText:'Local Beneficiary One'}).locator('input').check();
  await picker.getByRole('button',{name:/Add selected to payment|Use selected beneficiary/}).click();
  await expect(modal.locator('#guest-tin')).toHaveValue('012345678901');
  await context.close();
});
