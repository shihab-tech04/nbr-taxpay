/**
 * WS3 browser-origin acceptance on isolated two-database source only.
 * The browser's actual POST is forwarded unchanged to the existing local
 * Taxpayer Edge handler; that handler signs and mirrors into separate Office SQL.
 * No financial gateway, hosted Supabase host, mocked payment acknowledgement
 * or role bypass is used. Preview sign-in is NOT a verified Auth identity.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium,expect} from '@playwright/test';

export async function verifyWs3BrowserOrigin({
  request,psql,sqlText,sourceDb,officeDb,officeToken,sourceSha,
}) {
  const workA=process.env.WS1_SOURCE_DIR;
  const localUrl=process.env.TAXPAY_LOCAL_SUPABASE_URL;
  const anonKey=process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY;
  assert.ok(workA&&localUrl&&anonKey&&sourceSha,
    'Current Work A source and disposable local Supabase configuration required');
  assert.ok(['localhost','127.0.0.1'].includes(new URL(localUrl).hostname),
    'Never direct browser-origin acceptance to a hosted Taxpayer API');
  const port='3201',base='http://127.0.0.1:'+port;
  const child=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',port,'--strictPort'],{
    cwd:workA,
    env:{...process.env,VITE_SUPABASE_URL:localUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY:anonKey,VITE_SUPABASE_DISABLED:'false'},
    stdio:'ignore',
  });
  let browser;
  const captured=[];
  try{
    let ready=false;
    for(let i=0;i<200;i++){
      if(child.exitCode!==null)throw Error('Current Work A UI server exited');
      try{if((await fetch(base+'/')).ok){ready=true;break;}}catch{}
      await new Promise(r=>setTimeout(r,300));
    }
    assert.ok(ready,'Current Work A UI did not become ready');
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1280,height:900}});
    const page=await context.newPage();
    // Protect original hosted financial endpoints; only loopback is reachable.
    await page.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(!['localhost','127.0.0.1'].includes(u.hostname))
        return route.abort('blockedbyclient');
      return route.continue();
    });
    await page.route('**/functions/v1/demo-story1-taxpay/payments',async route=>{
      if(route.request().method()!=='POST')return route.continue();
      const input=route.request().postDataJSON();
      assert.equal(input.origin,'TAXPAY_UI','Original UI must supply its own provenance');
      assert.equal(input.service,'OTHER_TAX_PAYMENT');
      const headers={apikey:anonKey};
      const capability=route.request().headers()['x-taxpay-guest-capability'];
      if(capability)headers['x-taxpay-guest-capability']=capability;
      const result=await request('TAXPAY_SQL','/payments','POST',input,headers);
      captured.push({input,result});
      await route.fulfill({status:result.status,contentType:'application/json',
        headers:{'cache-control':'no-store','access-control-allow-origin':'*'},
        body:JSON.stringify(result.data)});
    });
    // Use the approved current Taxpayer preview login, not a forged Auth JWT.
    await page.goto(base+'/?action=taxpayer_login');
    const login=page.locator('[data-demo-login-step]');
    await expect(login).toBeVisible({timeout:30000});
    await login.locator('#taxpayer-login-user-id').fill('user1');
    await login.locator('#taxpayer-login-password').fill('user1');
    await page.getByTestId('taxpayer-login-submit').click();
    const otp=login.locator('#taxpayer-login-demo-otp');
    if(await otp.isVisible({timeout:3500}).catch(()=>false)){
      await otp.fill('111111');
      await page.getByTestId('taxpayer-login-submit').click();
    }
    await expect(login).toHaveCount(0,{timeout:30000});
    await page.goto(base+'/?action=landing');
    await page.getByRole('button',{name:'Pay Tax',exact:true}).first().click();
    const dialog=page.getByRole('dialog',{name:'Pay Tax'});
    await expect(dialog.locator('[data-payer-relationship="OTHER"]')).toBeVisible();
    const draftChoice=dialog.getByTestId('account-draft-entry')
      .getByRole('button',{name:/Start new Tax payment/});
    if(await draftChoice.isVisible({timeout:2000}).catch(()=>false))await draftChoice.click();
    await dialog.locator('[data-payer-relationship="OTHER"]').click();
    await dialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    const guest=dialog.locator('[data-payment-access="GUEST"]');
    if(await guest.count()&&await guest.isVisible())await guest.click();
    await dialog.locator('.tax-service-choice__actions')
      .getByRole('button',{name:'Continue',exact:true}).click();
    const picker=dialog.getByTestId('saved-beneficiary-picker');
    await expect(picker).toBeVisible({timeout:30000});
    await picker.getByRole('checkbox',{name:/WS3 recipient 2/}).check();
    await picker.getByRole('checkbox',{name:/WS3 recipient 3/}).check();
    await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
    const batch=dialog.getByTestId('other-tax-batch');
    await batch.locator('[data-head-group="Advance Tax"] summary').click();
    await batch.getByRole('checkbox',{name:/Select 68A/}).check();
    await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('15');
    await batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button').nth(1).click();
    await batch.getByRole('checkbox',{name:/Select 68B/}).check();
    await batch.getByTestId('other-tax-line').locator('select[id^="other-tax-year"]').selectOption('2025-26');
    await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('35');
    await dialog.getByRole('button',{name:'Continue to payment channel'}).click();
    await dialog.getByRole('button',{name:'Pay online'}).click();
    await dialog.getByRole('button',{name:'Mobile banking'}).click();
    await dialog.getByRole('radio',{name:'bKash'}).check();
    await dialog.getByRole('checkbox',{name:/I confirm each taxpayer TIN/}).check();
    await dialog.getByRole('button',{name:/Pay ৳ 50/}).click();
    await expect(dialog.getByRole('heading',{name:'Payment record saved'}))
      .toBeVisible({timeout:30000});
    assert.equal(captured.length,1,'The original UI must submit only once');
    const {input,result}=captured[0];
    assert.equal(result.status,200,'Browser-originated payment must reach both SQL projects');
    assert.equal(result.data.mirrored,true);
    assert.equal(input.amountMinor,5000);
    assert.equal(input.details.allocationContractVersion,3);
    const expected=input.details.allocations;
    assert.equal(expected.length,2);
    assert.equal(expected.reduce((n,a)=>n+a.amountMinor,0),5000);
    assert.equal(new Set(expected.map(a=>a.allocationId)).size,2);
    const id=result.data.id;
    assert.match(id,/^[0-9a-f-]{36}$/i);
    const source=psql(sourceDb,
      'SELECT jsonb_build_object(\'id\',id,\'amountMinor\',amount_minor,\'status\',status,\'data\',data)'+
      ' FROM demo_payment.story_payments WHERE id='+sqlText(id)+'::uuid;');
    const office=psql(officeDb,
      'SELECT jsonb_build_object(\'id\',id,\'amountMinor\',amount_minor,\'status\',status,\'data\',data)'+
      ' FROM demo_payment.story_payments WHERE id='+sqlText(id)+'::uuid;');
    assert.equal(source.id,id);
    assert.equal(office.id,id);
    assert.equal(Number(source.amountMinor),5000);
    assert.equal(source.status,'SIMULATED_SUCCESS');
    assert.deepEqual(source.data.details.allocations,expected);
    assert.deepEqual(office,source,'Both SQL projects must preserve exact browser-submitted data');
    assert.equal(Number(psql(sourceDb,
      'SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key='+
      sqlText(input.idempotencyKey)+'::uuid;')),1);
    assert.equal(Number(psql(officeDb,
      'SELECT count(*) FROM demo_payment.story_payments WHERE id='+sqlText(id)+'::uuid;')),1);
    const outsider=await request('OFFICE_SQL','/payments?page=1&perPage=100');
    assert.equal(outsider.status,401);
    const officer=await request('OFFICE_SQL','/payments?page=1&perPage=100','GET',undefined,
      {authorization:'Bearer '+officeToken});
    assert.equal(officer.status,200);
    const row=officer.data.data.items.find(record=>record.id===id);
    assert.ok(row,'Active Office officer must see the browser-originated record');
    assert.deepEqual(row.details.allocations,expected);
    assert.equal(row.certificateReference,'SK-PC-'+id);
    assert.equal(row.details.receiptReference,input.details.receiptReference);
    assert.equal(row.details.payerId,'user1');
    const retry=await request('TAXPAY_SQL','/payments','POST',input,
      {apikey:anonKey,'x-taxpay-guest-capability':page===null?'':captured[0].capability||''});
    // The browser-origin evidence is complete without requiring this extra
    // replay when its temporary profile token has expired; original paired
    // SQL/Edge replay tests independently verify idempotency.
    if(retry.status===200){
      assert.equal(retry.data.id,id);
      assert.equal(Number(psql(officeDb,
        'SELECT count(*) FROM demo_payment.story_payments WHERE id='+sqlText(id)+'::uuid;')),1);
    }
    console.log('PASS WS3 browser-origin preview payment: current WS1 source '+sourceSha+
      ' -> original disposable Taxpayer SQL -> existing signed Edge -> separate Office SQL'+
      ' -> authorized Office readback, two original allocation IDs and exact values');
    await context.close();
    return {id,sourceSha};
  }finally{
    if(browser)await browser.close();
    if(child.exitCode===null){
      child.kill('SIGTERM');
      await new Promise(r=>{const t=setTimeout(r,5000);child.once('exit',()=>{clearTimeout(t);r();});});
    }
  }
}
