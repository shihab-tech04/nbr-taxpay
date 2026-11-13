import {expect,test} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';
import {SAMPLE_TIN_SUGGESTIONS} from '../../src/data/sampleTinSuggestions';

for(const language of ['en','bn'] as const){
  test('saved-first one-time TIN fallback confirms an explicit sample without saving or granting history access ('+language+')',async({browser})=>{
    test.setTimeout(150_000);
    const raw=process.env.TAXPAY_LOCAL_SUPABASE_URL;
    const key=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
    const dsn=process.env.TAXPAY_LOCAL_PG_DSN;
    if(!raw||!key||!dsn)throw new Error('Disposable Auth, PostgREST and SQL are required.');
    const api=new URL(raw),database=new URL(dsn);
    if(api.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(api.hostname)||
      !['localhost','127.0.0.1','[::1]'].includes(database.hostname))
      throw new Error('Refusing hosted Auth or SQL for the one-time TIN fallback test.');
    const psql=(query:string)=>{
      const run=spawnSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c',query],{
        encoding:'utf8',timeout:10_000,
        env:{...process.env,PGHOST:database.hostname.replace(/^\[|\]$/g,''),PGPORT:database.port||'5432',
          PGUSER:decodeURIComponent(database.username),PGPASSWORD:decodeURIComponent(database.password),
          PGDATABASE:database.pathname.slice(1)}
      });
      if(run.status!==0)throw new Error((run.stderr||'Local SQL query failed').slice(0,500));
      return run.stdout.trim();
    };
    const beforePaymentCount=psql('SELECT count(*)::text FROM demo_payment.story_payments');
    const email='tin-fallback-'+randomUUID()+'@example.invalid';
    const password=randomBytes(32).toString('base64url');
    const signup=await fetch(new URL('/auth/v1/signup',api.origin),{
      method:'POST',headers:{apikey:key,'content-type':'application/json'},
      body:JSON.stringify({email,password}),signal:AbortSignal.timeout(15_000)
    });
    expect(signup.status).toBe(200);
    const auth=await signup.json();
    expect(auth.user?.id).toBeTruthy();
    const session=auth.session??auth;
    expect(session.access_token).toBeTruthy();
    const loginUrl='/?action=beneficiaries&lang='+language+
      '#access_token='+encodeURIComponent(session.access_token)+
      '&refresh_token='+encodeURIComponent(session.refresh_token)+
      '&token_type=bearer&expires_in=3600&expires_at='+
      (session.expires_at??Math.floor(Date.now()/1000)+3600);
    const mobile=test.info().project.name==='mobile-375';
    const context=await browser.newContext({
      baseURL:'http://127.0.0.1:4173',
      viewport:mobile?{width:375,height:812}:{width:1280,height:900}
    });
    const page=await context.newPage();
    page.setDefaultTimeout(10_000);
    page.setDefaultNavigationTimeout(20_000);
    const readBeneficiaries=async()=>{
      const response=await fetch(new URL('/rest/v1/taxpay_beneficiaries?select=owner_uid,tin,display_name&owner_uid=eq.'+
        encodeURIComponent(auth.user.id),api.origin),{
        headers:{apikey:key,Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(15_000)
      });
      expect(response.status).toBe(200);
      return response.json();
    };
    try{
      expect(SAMPLE_TIN_SUGGESTIONS).toHaveLength(30);
      await page.goto(loginUrl);
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible({timeout:15_000});
      await page.getByRole('button',{name:language==='bn'?'তালিকা তৈরি':'Create list',exact:true}).first().click();
      const create=page.getByRole('dialog',{name:language==='bn'?'তালিকা তৈরি':'Create list'});
      await create.locator('#beneficiary-create-list-name').fill('Family');
      await create.getByRole('button',{name:language==='bn'?'তালিকা তৈরি':'Create list',exact:true}).click();
      await page.getByRole('button',{name:language==='bn'?'উপকারভোগী যোগ':'Add beneficiary',exact:true}).first().click();
      const add=page.getByRole('dialog',{name:language==='bn'?'উপকারভোগী যোগ':'Beneficiary entry'});
      await add.locator('#beneficiary-tin').fill('012345678901');
      await add.locator('#beneficiary-name').fill('Saved Contact');
      await chooseBeneficiaryOption(add,'beneficiary-tag','friends_family:father');
      await add.getByRole('button',{name:language==='bn'?'উপকারভোগী যোগ':'Add beneficiary',exact:true}).click();
      await expect(page.getByTestId('beneficiaries-page')).toContainText('012345678901',{timeout:15_000});
      expect(await readBeneficiaries()).toEqual([
        {owner_uid:auth.user.id,tin:'012345678901',display_name:'Saved Contact'}
      ]);

      await page.goto('/?action=guest&lang='+language+'&initialCategory=OTHER_TAX_PAYMENT');
      // The direct ?action=guest route renders standalone GuestPayment, not the embedded Pay Tax modal.
      await expect(page.getByRole('heading',{name:language==='bn'?'অতিথি আয়কর পরিশোধ':'Guest Income Tax Payment'})).toBeVisible();
      await expect(page.locator('.taxpay-modal')).toHaveCount(0);
      await expect(page.locator('#guest-payer-other')).toBeVisible({timeout:15_000});
      await page.locator('#guest-payer-other').click();
      const picker=page.getByTestId('saved-beneficiary-picker');
      await expect(picker).toBeVisible({timeout:15_000});
      const savedSearch=picker.locator('#payment-beneficiary-search');
      await savedSearch.fill('012345678901');
      await expect(picker.getByRole('checkbox')).toHaveCount(1);
      await expect(picker.getByTestId('one-time-tin-fallback-open')).toHaveCount(0);
      await picker.getByRole('checkbox').check();

      await savedSearch.fill('111111111111');
      const noSavedMatch=picker.getByTestId('one-time-tin-fallback-open');
      await expect(noSavedMatch).toBeVisible();
      await noSavedMatch.click();
      const fallback=picker.getByTestId('one-time-tin-fallback');
      const tinInput=fallback.locator('#payment-fallback-tin');
      const searchName=language==='bn'?'টিআইএন খুঁজুন':'Search TIN';
      await tinInput.fill('123456789012');
      await fallback.getByRole('button',{name:searchName,exact:true}).click();
      await expect(fallback.getByRole('alert')).toContainText(
        language==='bn'?'কোনো নমুনা প্রোফাইল পাওয়া যায়নি':'No sample profile found');
      await expect(fallback.getByRole('button',{name:language==='bn'?'এই করদাতাকে নিশ্চিত করুন':'Confirm this taxpayer',exact:true})).toHaveCount(0);

      await tinInput.fill('111111111111');
      await fallback.getByRole('button',{name:searchName,exact:true}).click();
      await expect(fallback.locator('#payment-fallback-name')).toHaveValue(language==='bn'?'ইউজার 1':'User 1');
      await expect(fallback).toContainText(language==='bn'?'নমুনা প্রোফাইল':'sample profiles');
      await fallback.getByRole('button',{name:language==='bn'?'এই করদাতাকে নিশ্চিত করুন':'Confirm this taxpayer',exact:true}).click();
      const selected=picker.getByTestId('one-time-tin-selection');
      await expect(selected).toContainText(language==='bn'?'ইউজার 1':'User 1');
      await expect(selected).toContainText('111111111111');
      await expect(selected).toContainText(language==='bn'?'সংরক্ষিত নয়':'Not saved to your beneficiary lists');
      await expect(page.getByTestId('authorized-taxpayer-choices')).toHaveCount(0);

      // Confirming a one-time sample must not create an address-book row or a payment.
      expect(await readBeneficiaries()).toEqual([
        {owner_uid:auth.user.id,tin:'012345678901',display_name:'Saved Contact'}
      ]);
      expect(psql('SELECT count(*)::text FROM demo_payment.story_payments')).toBe(beforePaymentCount);

      const receiptPhone=page.locator('#guest-phone');
      if(await receiptPhone.count()===1&&await receiptPhone.isEditable())
        await receiptPhone.fill('01712345678');
      const continueLabel=language==='bn'?'পেমেন্ট খাতে এগিয়ে যান':'Continue to Payment Head';
      await page.getByRole('button',{name:continueLabel,exact:true}).click();
      await expect(page.getByText(language==='bn'?'ধাপ 2 / ৪':'Step 2 of 4',{exact:true})).toBeVisible();
      const backLabel=language==='bn'?'পূর্ববর্তী ধাপ':'Back';
      await page.getByRole('button',{name:backLabel,exact:true}).first().click();
      await expect(page.getByText(language==='bn'?'ধাপ 1 / ৪':'Step 1 of 4',{exact:true})).toBeVisible();
      await expect(picker.getByTestId('one-time-tin-selection')).toContainText('111111111111');
    }finally{
      await context.close().catch(()=>undefined);
    }
  });
}
