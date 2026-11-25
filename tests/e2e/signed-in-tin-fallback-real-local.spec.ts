import { openUnifiedSignedInPayment } from './pay-tax-entry-helper';
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
      const run=spawnSync('psql',['-X','-q','-At','-v','ON_ERROR_STOP=1','-c',query],{
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
    // Create an explicitly synthetic profile binding in this loopback-only
    // disposable database, using the test runner's privileged SQL fixture.
    // No production permissions or binding workflow are altered.
    let fixtureProfile='';
    try{
      expect(SAMPLE_TIN_SUGGESTIONS).toHaveLength(30);
      expect(auth.user.id).toMatch(/^[0-9a-f-]{36}$/i);
      // Earlier isolated suites can already own some of these synthetic IDs.
      // Reserve a free fixture row atomically; never overwrite another owner.
      fixtureProfile=psql(`INSERT INTO public.sim_payment_account_bindings(user_id,owner_uid,assigned_by)
        SELECT u.id,'${auth.user.id}'::uuid,'${auth.user.id}'::uuid
        FROM public.sim_payment_users u
        WHERE u.id IN ('user25','user26','user27','user28','user29','user30')
          AND NOT EXISTS(SELECT 1 FROM public.sim_payment_account_bindings b WHERE b.user_id=u.id)
        ORDER BY u.id LIMIT 1 FOR UPDATE OF u SKIP LOCKED
        ON CONFLICT DO NOTHING RETURNING user_id;`);
      expect(fixtureProfile, 'An unbound disposable fixture profile is required').toMatch(/^user(2[5-9]|30)$/);
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
      await expect(page.getByTestId('beneficiaries-page')).toContainText('012*********',{timeout:15_000});
      expect(await readBeneficiaries()).toEqual([
        {owner_uid:auth.user.id,tin:'012345678901',display_name:'Saved Contact'}
      ]);

      // Native signed-in navigation, at its actual desktop/mobile viewport.
      const dialog=await openUnifiedSignedInPayment(page,language);
      const picker=dialog.getByTestId('saved-beneficiary-picker');
      const count=dialog.getByTestId('unified-taxpayer-count');
      await expect(picker).toBeVisible({timeout:15_000});
      await expect(dialog.getByTestId('unified-account-own').getByRole('checkbox')).toBeVisible();
      await expect(count).toHaveText('0');
      const savedSearch=picker.locator('#payment-beneficiary-search');
      await savedSearch.fill('012345678901');
      await expect(picker.getByRole('checkbox')).toHaveCount(1);
      await picker.getByRole('checkbox').check();
      await expect(count).toHaveText('1');
      const classification=dialog.getByRole('combobox',{name:language==='bn'?'আয়করের ধরন Saved Contact':'Income tax type for Saved Contact'});
      await classification.selectOption('NON_COMPANY');

      // Real local Auth/SQL: add a beneficiary from payment, return to the same
      // saved draft, then manage again without a duplicate draft or payment.
      const bn=language==='bn';
      const saveLabel=bn?'খসড়া সংরক্ষণ করুন':'Save Draft';
      const readDrafts=async()=>{
        const response=await fetch(new URL('/rest/v1/taxpay_account_payment_form_drafts?select=id,service,revision,form_payload&owner_uid=eq.'+encodeURIComponent(auth.user.id),api.origin),{headers:{apikey:key,Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(15_000)});
        expect(response.status).toBe(200);return response.json();
      };
      await picker.getByRole('button',{name:bn?'উপকারভোগী যোগ':'Add beneficiary',exact:true}).click();
      const guard=dialog.getByRole('alertdialog');
      await guard.getByRole('button',{name:bn?'সম্পাদনা চালিয়ে যান':'Keep editing'}).click();
      await expect(count).toHaveText('1');
      await picker.getByRole('button',{name:bn?'উপকারভোগী যোগ':'Add beneficiary',exact:true}).click();
      await guard.getByRole('button',{name:saveLabel,exact:true}).click();
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      const addFromPayment=page.getByRole('dialog',{name:bn?'উপকারভোগী যোগ':'Beneficiary entry'});
      await expect(addFromPayment).toBeVisible();
      await addFromPayment.locator('#beneficiary-tin').fill('333333333333');
      await addFromPayment.getByRole('button',{name:bn?'খুঁজুন':'Search',exact:true}).click();
      await expect(addFromPayment.getByTestId('searched-taxpayer-card')).toBeVisible();
      await chooseBeneficiaryOption(addFromPayment,'beneficiary-tag','clients');
      await addFromPayment.getByRole('button',{name:bn?'উপকারভোগী যোগ':'Add beneficiary',exact:true}).click();
      await expect(addFromPayment).toHaveCount(0);
      expect((await readBeneficiaries()).map((row:{tin:string})=>row.tin).sort()).toEqual(['012345678901','333333333333']);
      const firstDrafts=await readDrafts();expect(firstDrafts).toHaveLength(1);
      const draftId=firstDrafts[0].id;
      await page.getByTestId('beneficiary-return-to-payment').getByRole('button').click();
      await expect(dialog.getByTestId('unified-account-own')).toBeVisible();
      await expect(count).toHaveText('1');
      await picker.locator('#payment-beneficiary-search').fill('333333333333');
      await expect(picker.getByRole('checkbox')).toHaveCount(1);
      await picker.getByRole('checkbox').check();
      await expect(count).toHaveText('2');
      await picker.getByRole('button',{name:bn?'উপকারভোগী পরিচালনা':'Manage beneficiaries'}).click();
      await guard.getByRole('button',{name:saveLabel,exact:true}).click();
      await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
      const afterManage=await readDrafts();expect(afterManage).toHaveLength(1);expect(afterManage[0].id).toBe(draftId);expect(afterManage[0].revision).toBeGreaterThan(firstDrafts[0].revision);
      await page.getByTestId('beneficiary-return-to-payment').getByRole('button').click();
      await expect(count).toHaveText('2');
      await picker.locator('#payment-beneficiary-search').fill('333333333333');
      await expect(picker.getByRole('checkbox')).toBeChecked();
      await picker.getByRole('checkbox').uncheck();
      await expect(count).toHaveText('1');
      await picker.locator('#payment-beneficiary-search').fill('012345678901');
      await expect(picker.getByRole('checkbox')).toBeChecked();
      expect(psql('SELECT count(*)::text FROM demo_payment.story_payments')).toBe(beforePaymentCount);

      const tin=dialog.getByTestId('unified-tin-input');
      const search=dialog.getByRole('button',{name:language==='bn'?'করদাতার টিআইএন অনুসন্ধান':'Search taxpayer TIN',exact:true});
      const addName=language==='bn'?'করদাতা যোগ করুন':'Add taxpayer';
      await tin.fill('123456789012');
      await search.click();
      await expect(dialog.getByRole('alert')).toContainText(language==='bn'?'টিআইএন তথ্য পাওয়া যায়নি।':'TIN information not found.');
      await expect(dialog.getByTestId('unified-taxpayer-search-result')).toHaveCount(0);
      await expect(count).toHaveText('1');

      await tin.fill('111111111111');
      await search.click();
      const result=dialog.getByTestId('unified-taxpayer-search-result');
      await expect(result).toBeVisible();
      await expect(result).toContainText(language==='bn'?'ইউজার 1':'User 1');
      await expect(result.getByRole('button',{name:addName,exact:true})).toBeEnabled();
      await result.getByRole('button',{name:addName,exact:true}).click();
      await expect(count).toHaveText('2');
      await expect(dialog.locator('.unified-taxpayer-workspace__person')).toHaveCount(2);
      await expect(dialog.locator('.unified-taxpayer-workspace__person').filter({hasText:'111*********'})).toHaveCount(1);
      await expect(dialog.getByTestId('authorized-taxpayer-choices')).toHaveCount(0);

      // Confirming a one-time sample neither creates an address-book row nor a payment.
      expect((await readBeneficiaries()).map((row:{tin:string})=>row.tin).sort()).toEqual(['012345678901','333333333333']);
      expect(psql('SELECT count(*)::text FROM demo_payment.story_payments')).toBe(beforePaymentCount);
      const next=dialog.getByRole('button',{name:language==='bn'?'পেমেন্ট খাতে এগিয়ে যান':'Continue to Payment Head',exact:true});
      await expect(next).toBeEnabled();
      await next.click();
      await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
      await expect(dialog.locator('.taxpay-modal__step-count')).toContainText('2/3');
      await dialog.locator('.taxpay-modal__back').click();
      await expect(dialog.locator('.taxpay-modal__step-count')).toContainText('1/3');
      await expect(count).toHaveText('2');
      await expect(dialog.locator('.unified-taxpayer-workspace__person').filter({hasText:'111*********'})).toHaveCount(1);
      expect(await readBeneficiaries()).toHaveLength(2);
      expect(psql('SELECT count(*)::text FROM demo_payment.story_payments')).toBe(beforePaymentCount);
    }finally{
      await context.close().catch(()=>undefined);
      if(fixtureProfile)psql(`DELETE FROM public.sim_payment_account_bindings WHERE owner_uid='${auth.user.id}'::uuid AND user_id='${fixtureProfile}';`);
    }
  });
}
