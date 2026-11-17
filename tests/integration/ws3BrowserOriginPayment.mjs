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
  // Keep the citizen UI distinct from the Office drawer Vite process on 3000.
  // 4175 is already in the Taxpayer Edge's approved local Origin allowlist.
  const port='4175',base='http://127.0.0.1:'+port;
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
    // The browser's real demo-login, settings and beneficiary requests use
    // the existing Edge handler backed by the same original disposable SQL.
    // No fake login/session or mocked payment response is supplied.
    await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
      const method=route.request().method();
      const cors={'access-control-allow-origin':base,
        'access-control-allow-methods':'POST, OPTIONS',
        'access-control-allow-headers':'apikey, content-type, x-client-info, x-taxpay-guest-capability',
        'cache-control':'no-store'};
      if(method==='OPTIONS')return route.fulfill({status:204,headers:cors,body:''});
      assert.equal(method,'POST','Preview identity must use the approved POST contract');
      const data=route.request().postDataJSON();
      const capability=route.request().headers()['x-taxpay-guest-capability'];
      const reply=await request('TAXPAY_RECIPIENTS','',method,data,
        {origin:base,apikey:anonKey,...(capability?{'x-taxpay-guest-capability':capability}:{})});
      return route.fulfill({status:reply.status,contentType:'application/json',
        headers:cors,body:JSON.stringify(reply.data)});
    });
    await page.route('**/functions/v1/demo-story1-taxpay/payments',async route=>{
      if(route.request().method()==='OPTIONS')return route.fulfill({
        status:204,headers:{
          'access-control-allow-origin':base,
          'access-control-allow-methods':'POST, OPTIONS',
          'access-control-allow-headers':'apikey, content-type, x-taxpay-guest-capability',
          'cache-control':'no-store'},body:''});
      if(route.request().method()!=='POST')return route.continue();
      const input=route.request().postDataJSON();
      assert.equal(input.origin,'TAXPAY_UI','Original UI must supply its own provenance');
      assert.equal(input.service,'OTHER_TAX_PAYMENT');
      const headers={apikey:anonKey};
      const capability=route.request().headers()['x-taxpay-guest-capability'];
      if(capability)headers['x-taxpay-guest-capability']=capability;
      const result=await request('TAXPAY_SQL','/payments','POST',input,headers);
      captured.push({input,result,capability});
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
    await expect.poll(async()=>{
      if(await otp.isVisible())return 'otp';
      if(!await login.count())return 'complete';
      return 'pending';
    },{timeout:15000}).not.toBe('pending');
    if(await otp.isVisible()){
      await otp.fill('111111');
      await page.getByTestId('taxpayer-login-submit').click();
    }
    // The sign-in route can retain its modal while session hydration resolves.
    // Confirm the server-issued preview identity, not modal animation state.
    await expect.poll(()=>page.evaluate(()=>
      sessionStorage.getItem('taxpay-taxpayer-preview-user')),
      {timeout:30000}).toBe('user1');
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
    // The disposable SQL fixture adds a new named list, not necessarily the
    // first expanded list. Exercise the real saved-first search across all
    // owned lists; never forge selection or bypass the capability-bound reader.
    const savedSearch=picker.getByRole('searchbox',{name:'Search beneficiaries'});
    await expect(savedSearch).toBeVisible({timeout:30000});
    await savedSearch.fill('WS3 recipient');
    // A saved TIN can appear in multiple owned lists. This payment selects
    // the first matching saved contact for each distinct recipient TIN;
    // duplicate list cards are not duplicate payment beneficiaries.
    const recipient2=picker.getByRole('checkbox',{name:'Select WS3 recipient 2',exact:true}).first();
    const recipient3=picker.getByRole('checkbox',{name:'Select WS3 recipient 3',exact:true}).first();
    await expect(recipient2).toBeVisible();
    await expect(recipient3).toBeVisible();
    await recipient2.check();
    await recipient3.check();
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
    const {input,result,capability}=captured[0];
    assert.ok(capability,'Existing preview login must bind payment to server-issued capability');
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
    // The paired Office browser test must display this SAME browser-originated
    // parent, not the earlier standalone SQL fixture.
    const fixturePath=process.env.WS3_OFFICE_UI_FIXTURE_OUT;
    if(fixturePath){
      const {writeFileSync}=await import('node:fs');
      writeFileSync(fixturePath,JSON.stringify({
        payment:row,
        expected:{id,status:source.status,payerId:'user1',
          receiptReference:input.details.receiptReference,
          allocationIds:expected.map(a=>a.allocationId),
          allocationTins:expected.map(a=>a.taxpayerTin),
          headIds:expected.map(a=>a.headId),
          assessmentYears:expected.map(a=>a.assessmentYear),
          amountsMinor:expected.map(a=>a.amountMinor),totalMinor:5000},
      }),{mode:0o600});
    }
    const retry=await request('TAXPAY_SQL','/payments','POST',input,
      {apikey:anonKey,'x-taxpay-guest-capability':capability});
    assert.equal(retry.status,200,'Replaying the identical browser request must be idempotent');
    assert.equal(retry.data.id,id);
    assert.equal(retry.data.replayed,true);
    assert.equal(Number(psql(officeDb,
      'SELECT count(*) FROM demo_payment.story_payments WHERE id='+sqlText(id)+'::uuid;')),1);
    console.log('PASS WS3 browser-origin preview payment: current WS1 source '+sourceSha+
      ' -> original disposable Taxpayer SQL -> existing signed Edge -> separate Office SQL'+
      ' -> authorized Office readback, two original allocation IDs and exact values');
    // F-039 original current Work A UI: one saved payer-owned recipient
    // and one confirmed fictional public-lookup TIN, without saving the second.
    // The shared user1 fixture saves user4. User10 is deliberately absent,
    // so the test must use a genuinely unsaved fictional lookup identity.
    const unsavedTin='000000000000';
    const savedBefore=Number(psql(sourceDb,
      "SELECT count(*) FROM taxpay_guest_private.beneficiaries WHERE tin='"+unsavedTin+"';"));
    assert.equal(savedBefore,0,'F039 one-time fixture must begin with unsaved TIN');
    await page.goto(base+'/?action=landing');
    await page.getByRole('button',{name:'Pay Tax',exact:true}).first().click();
    const oneTimeDialog=page.getByRole('dialog',{name:'Pay Tax'});
    const oneTimeStart=oneTimeDialog.getByTestId('account-draft-entry')
      .getByRole('button',{name:/Start new Tax payment/});
    if(await oneTimeStart.isVisible({timeout:2000}).catch(()=>false))
      await oneTimeStart.click();
    await expect(oneTimeDialog.locator('[data-payer-relationship="OTHER"]'))
      .toBeVisible({timeout:15000});
    await oneTimeDialog.locator('[data-payer-relationship="OTHER"]').click();
    await oneTimeDialog.locator('[data-payment-entry="OTHER_TAX"]').click();
    await oneTimeDialog.locator('.tax-service-choice__actions')
      .getByRole('button',{name:'Continue',exact:true}).click();
    const f039Picker=oneTimeDialog.getByTestId('saved-beneficiary-picker');
    await expect(f039Picker).toBeVisible({timeout:20000});
    // This is a fresh payment entry. Saved lists are collapsed until the
    // payer explicitly searches or expands a list; a previously selected
    // contact must not be carried across transactions by the browser test.
    const f039Search=f039Picker.getByRole('searchbox',{name:'Search beneficiaries'});
    await expect(f039Search).toBeVisible();
    await f039Search.fill('WS3 recipient 2');
    const savedRecipient=f039Picker.getByRole('checkbox',
      {name:'Select WS3 recipient 2',exact:true}).first();
    await expect(savedRecipient).toBeVisible();
    await savedRecipient.check();
    const oneTimeEntry=oneTimeDialog.getByTestId('one-time-taxpayer-entry');
    await expect(oneTimeEntry).toBeVisible();
    await oneTimeEntry.locator('#other-tax-one-time-tin').fill(unsavedTin);
    await oneTimeEntry.getByRole('button',{name:'Search one-time taxpayer'}).click();
    await expect(oneTimeEntry.getByTestId('one-time-taxpayer-preview'))
      .toContainText('User 10');
    const addOneTime=oneTimeEntry.getByRole('button',{name:'Add to this payment'});
    if(!await addOneTime.isEnabled()){
      // Diagnostics only; never print the capability, full TIN or private data.
      const state=await oneTimeDialog.evaluate(dialog=>{
        const entry=dialog.querySelector('[data-testid="one-time-taxpayer-entry"]');
        const picker=dialog.querySelector('[data-testid="saved-beneficiary-picker"]');
        const field=entry?.querySelector('#other-tax-one-time-tin');
        return {
          oneTimePreviewPresent:Boolean(entry?.querySelector('[data-testid="one-time-taxpayer-preview"]')),
          tinLength:field&&'value' in field?String(field.value).length:null,
          savedRecipientChecked:picker?.querySelectorAll('input[type="checkbox"]:checked,[role="checkbox"][aria-checked="true"]').length??0,
          pickerLoading:Boolean(picker?.textContent?.includes('Loading beneficiary lists')),
          alerts:Array.from(dialog.querySelectorAll('[role="alert"]'))
            .map(el=>el.textContent?.trim().slice(0,120)).filter(Boolean),
          previewSessionPresent:Boolean(sessionStorage.getItem('taxpay-taxpayer-preview-user')),
        };
      });
      console.error('F039_ONE_TIME_DISABLED_STATE '+JSON.stringify(state));
    }
    await addOneTime.click();
    await expect(oneTimeEntry.getByTestId('confirmed-one-time-taxpayer'))
      .toContainText(unsavedTin);
    await expect(f039Picker.getByTestId('beneficiary-list-accordion'))
      .not.toContainText(unsavedTin);
    await oneTimeDialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
    const f039Batch=oneTimeDialog.getByTestId('other-tax-batch');
    await f039Batch.locator('[data-head-group="Advance Tax"] summary').click();
    await f039Batch.getByRole('checkbox',{name:/Select 68A/}).check();
    await f039Batch.getByTestId('other-tax-line')
      .locator('input[id^="other-tax-amount"]').fill('10');
    await f039Batch.getByTestId('other-tax-taxpayer-tabs')
      .getByRole('button').nth(1).click();
    await f039Batch.getByRole('checkbox',{name:/Select 68B/}).check();
    await f039Batch.getByTestId('other-tax-line')
      .locator('select[id^="other-tax-year"]').selectOption('2025-26');
    await f039Batch.getByTestId('other-tax-line')
      .locator('input[id^="other-tax-amount"]').fill('20');
    await oneTimeDialog.getByRole('button',{name:'Continue to payment channel'}).click();
    await oneTimeDialog.getByRole('button',{name:'Pay online'}).click();
    await oneTimeDialog.getByRole('button',{name:'Mobile banking'}).click();
    await oneTimeDialog.getByRole('radio',{name:'bKash'}).check();
    await oneTimeDialog.getByRole('checkbox',{name:/I confirm each taxpayer TIN/}).check();
    await oneTimeDialog.getByRole('button',{name:/Pay ৳ 30/}).click();
    await expect(oneTimeDialog.getByRole('heading',{name:'Payment record saved'}))
      .toBeVisible({timeout:30000});
    assert.equal(captured.length,2,'F-039 must create exactly one additional original UI POST');
    const oneTimePost=captured[1];
    assert.equal(oneTimePost.result.status,200,'One-time recipient must reach real SQL');
    assert.equal(oneTimePost.result.data.mirrored,true);
    assert.equal(oneTimePost.input.amountMinor,3000);
    const oneTimeAllocations=oneTimePost.input.details.allocations;
    assert.deepEqual(oneTimeAllocations.map(a=>a.taxpayerTin),['222222222222',unsavedTin]);
    assert.deepEqual(oneTimeAllocations.map(a=>a.amountMinor),[1000,2000]);
    assert.deepEqual(oneTimeAllocations.map(a=>a.headId),[122,123]);
    assert.deepEqual(oneTimeAllocations.map(a=>a.assessmentYear),['2026-27','2025-26']);
    assert.equal(oneTimeAllocations[1].taxpayerName,'User 10');
    assert.equal(Number(psql(sourceDb,
      "SELECT count(*) FROM taxpay_guest_private.beneficiaries WHERE tin='"+unsavedTin+"';")),
      savedBefore,'F-039 must not create any saved beneficiary record');
    const oneTimeId=oneTimePost.result.data.id;
    const oneTimeSource=psql(sourceDb,
      "SELECT jsonb_build_object('id',id,'amountMinor',amount_minor,'status',status,'data',data)"+
      ' FROM demo_payment.story_payments WHERE id='+sqlText(oneTimeId)+'::uuid;');
    const oneTimeOffice=psql(officeDb,
      "SELECT jsonb_build_object('id',id,'amountMinor',amount_minor,'status',status,'data',data)"+
      ' FROM demo_payment.story_payments WHERE id='+sqlText(oneTimeId)+'::uuid;');
    assert.deepEqual(oneTimeOffice,oneTimeSource,'F-039 source and Office SQL must match');
    assert.deepEqual(oneTimeSource.data.details.allocations,oneTimeAllocations);
    const f039Officer=await request('OFFICE_SQL','/payments?page=1&perPage=100','GET',
      undefined,{authorization:'Bearer '+officeToken});
    assert.equal(f039Officer.status,200);
    const f039Row=f039Officer.data.data.items.find(item=>item.id===oneTimeId);
    assert.ok(f039Row,'F-039 saved + one-time parent must be officer-readable');
    assert.deepEqual(f039Row.details.allocations,oneTimeAllocations);
    assert.equal(f039Row.details.payerId,'user1');
    assert.equal(f039Row.certificateReference,'SK-PC-'+oneTimeId);
    assert.equal(f039Row.details.receiptReference,oneTimePost.input.details.receiptReference);
    const f039Retry=await request('TAXPAY_SQL','/payments','POST',oneTimePost.input,
      {apikey:anonKey,'x-taxpay-guest-capability':oneTimePost.capability});
    assert.equal(f039Retry.status,200);
    assert.equal(f039Retry.data.id,oneTimeId);
    assert.equal(f039Retry.data.replayed,true);
    assert.equal(Number(psql(sourceDb,
      'SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key='+
      sqlText(oneTimePost.input.idempotencyKey)+'::uuid;')),1);
    assert.equal(Number(psql(officeDb,
      'SELECT count(*) FROM demo_payment.story_payments WHERE id='+sqlText(oneTimeId)+'::uuid;')),1);
    // Run the existing Office EN/BN drawer readback against F-039's original
    // one-time browser parent, instead of weakening or duplicating drawer checks.
    if(fixturePath){
      const {writeFileSync}=await import('node:fs');
      writeFileSync(fixturePath,JSON.stringify({
        payment:f039Row,
        expected:{id:oneTimeId,status:oneTimeSource.status,payerId:'user1',
          receiptReference:oneTimePost.input.details.receiptReference,
          allocationIds:oneTimeAllocations.map(a=>a.allocationId),
          allocationTins:oneTimeAllocations.map(a=>a.taxpayerTin),
          headIds:oneTimeAllocations.map(a=>a.headId),
          assessmentYears:oneTimeAllocations.map(a=>a.assessmentYear),
          amountsMinor:oneTimeAllocations.map(a=>a.amountMinor),totalMinor:3000},
      }),{mode:0o600});
    }
    console.log('PASS F-039 browser saved + one-time: original preview-auth UI POST -> original disposable Taxpayer SQL -> signed Edge -> distinct Office SQL and authorized officer readback; no one-time beneficiary auto-save, exact allocations and idempotent replay');
    // Distinct unsigned browser journey: actual guest form request, NOT a
    // preview profile, fake JWT, synthetic Auth account, or mocked payment ACK.
    // Uses the existing anonymous demo_story1_submit RPC through the same
    // local Edge handler and independent disposable Office database.
    const guestContext=await browser.newContext({viewport:{width:1280,height:900}});
    try {
      const guestPage=await guestContext.newPage();
      const guestCaptured=[];
      await guestPage.route('**/*',route=>{
        const host=new URL(route.request().url()).hostname;
        return ['localhost','127.0.0.1'].includes(host)
          ?route.continue():route.abort('blockedbyclient');
      });
      await guestPage.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
        const method=route.request().method();
        const cors={'access-control-allow-origin':base,
          'access-control-allow-methods':'POST, OPTIONS',
          'access-control-allow-headers':'apikey, content-type, x-client-info, x-taxpay-guest-capability',
          'cache-control':'no-store'};
        if(method==='OPTIONS')return route.fulfill({status:204,headers:cors,body:''});
        assert.equal(method,'POST');
        const capability=route.request().headers()['x-taxpay-guest-capability'];
        const reply=await request('TAXPAY_RECIPIENTS','',method,route.request().postDataJSON(),
          {origin:base,apikey:anonKey,...(capability?{'x-taxpay-guest-capability':capability}:{})});
        return route.fulfill({status:reply.status,contentType:'application/json',
          headers:cors,body:JSON.stringify(reply.data)});
      });
      await guestPage.route('**/functions/v1/demo-story1-taxpay/payments',async route=>{
        if(route.request().method()==='OPTIONS')return route.fulfill({
          status:204,headers:{'access-control-allow-origin':base,
            'access-control-allow-methods':'POST, OPTIONS',
            'access-control-allow-headers':'apikey, content-type, x-taxpay-guest-capability'},body:''});
        if(route.request().method()!=='POST')return route.continue();
        const input=route.request().postDataJSON();
        assert.equal(input.origin,'TAXPAY_UI');
        assert.equal(input.service,'OTHER_TAX_PAYMENT');
        assert.ok(!route.request().headers()['x-taxpay-guest-capability'],
          'Unsigned payment must not impersonate a preview account');
        const result=await request('TAXPAY_SQL','/payments','POST',input,{apikey:anonKey});
        guestCaptured.push({input,result});
        return route.fulfill({status:result.status,contentType:'application/json',
          headers:{'cache-control':'no-store','access-control-allow-origin':base},
          body:JSON.stringify(result.data)});
      });
      await guestPage.goto(base+'/?action=landing');
      await guestPage.getByRole('button',{name:'Pay Tax',exact:true}).first().click();
      const guestDialog=guestPage.getByRole('dialog',{name:'Pay Tax'});
      const guestDraft=guestDialog.getByTestId('account-draft-entry');
      const guestStart=guestDraft.getByRole('button',{name:/Start new Tax payment/});
      await expect.poll(async()=>{
        if(await guestStart.isVisible().catch(()=>false))return 'draft';
        if(await guestDialog.locator('[data-payer-relationship]').count()===2)return 'payer';
        if(await guestDraft.getByRole('alert').count())return 'error';
        return 'loading';
      },{timeout:15000}).not.toBe('loading');
      assert.equal(await guestDraft.getByRole('alert').count(),0,
        'Unsigned draft owner SQL must recover without a fabricated response');
      if(await guestStart.isVisible().catch(()=>false))await guestStart.click();
      await guestDialog.locator('[data-payer-relationship="OTHER"]').click();
      await guestDialog.locator('[data-payment-entry="OTHER_TAX"]').click();
      const walkin=guestDialog.locator('[data-payment-access="GUEST"]');
      await expect(walkin).toBeVisible();
      await walkin.click();
      await guestDialog.locator('.tax-service-choice__actions')
        .getByRole('button',{name:'Continue',exact:true}).click();
      await guestDialog.locator('#guest-tin').fill('111111111111');
      await guestDialog.getByRole('button',{name:/^Search(?: TIN)?$/}).click();
      await guestDialog.getByTestId('other-tax-primary-taxpayer')
        .getByRole('button',{name:'Add taxpayer'}).click();
      await guestDialog.locator('#guest-payer-name').fill('WS3 unsigned payer');
      await guestDialog.locator('#guest-phone').fill('01712345678');
      await guestDialog.getByRole('button',{name:'Add another taxpayer'}).click();
      const other=guestDialog.getByTestId('other-tax-taxpayer');
      await other.locator('input[id^="other-tax-tin"]').fill('222222222222');
      await other.getByRole('button',{name:'Search',exact:true}).click();
      await other.getByRole('button',{name:'Add taxpayer'}).click();
      await guestDialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
      const heads=guestDialog.getByTestId('other-tax-batch');
      await heads.locator('[data-head-group="Advance Tax"] summary').click();
      await heads.getByRole('checkbox',{name:/Select 68A/}).check();
      await heads.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('12');
      await heads.getByTestId('other-tax-taxpayer-tabs').getByRole('button').nth(1).click();
      await heads.getByRole('checkbox',{name:/Select 68B/}).check();
      await heads.getByTestId('other-tax-line').locator('select[id^="other-tax-year"]').selectOption('2025-26');
      await heads.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('18');
      await guestDialog.getByRole('button',{name:'Continue to payment channel'}).click();
      await guestDialog.getByRole('button',{name:'Pay online'}).click();
      await guestDialog.getByRole('button',{name:'Mobile banking'}).click();
      await guestDialog.getByRole('radio',{name:'bKash'}).check();
      await guestDialog.getByRole('checkbox',{name:/I confirm each taxpayer TIN/}).check();
      await guestDialog.getByRole('button',{name:/Pay ৳ 30/}).click();
      await expect(guestDialog.getByRole('heading',{name:'Payment record saved'}))
        .toBeVisible({timeout:30000});
      assert.equal(guestCaptured.length,1,'Guest browser must submit exactly one original POST');
      const {input:guestInput,result:guestResult}=guestCaptured[0];
      assert.equal(guestResult.status,200);
      assert.equal(guestResult.data.mirrored,true);
      assert.equal(guestInput.amountMinor,3000);
      assert.equal(guestInput.details.allocations.length,2);
      assert.equal(guestInput.details.allocations.reduce((n,a)=>n+a.amountMinor,0),3000);
      assert.deepEqual(guestInput.details.allocations.map(a=>a.taxpayerTin),
        ['111111111111','222222222222']);
      const guestId=guestResult.data.id;
      const guestSource=psql(sourceDb,
        'SELECT jsonb_build_object(\'id\',id,\'amountMinor\',amount_minor,\'status\',status,\'data\',data)'+
        ' FROM demo_payment.story_payments WHERE id='+sqlText(guestId)+'::uuid;');
      const guestOffice=psql(officeDb,
        'SELECT jsonb_build_object(\'id\',id,\'amountMinor\',amount_minor,\'status\',status,\'data\',data)'+
        ' FROM demo_payment.story_payments WHERE id='+sqlText(guestId)+'::uuid;');
      assert.equal(guestSource.id,guestId);
      assert.equal(guestSource.amountMinor,3000);
      assert.deepEqual(guestSource.data.details.allocations,guestInput.details.allocations);
      assert.deepEqual(guestOffice,guestSource,'Guest source and Office mirror must be byte-equal SQL snapshots');
      const guestOfficer=await request('OFFICE_SQL','/payments?page=1&perPage=100','GET',undefined,
        {authorization:'Bearer '+officeToken});
      assert.equal(guestOfficer.status,200);
      const guestRow=guestOfficer.data.data.items.find(item=>item.id===guestId);
      assert.ok(guestRow,'Approved officer must see the original unsigned-guest payment');
      assert.deepEqual(guestRow.details.allocations,guestInput.details.allocations);
      assert.equal(guestRow.certificateReference,'SK-PC-'+guestId);
      assert.equal(guestRow.details.receiptReference,guestInput.details.receiptReference);
      assert.equal(guestRow.details.payerMode,'OTHER');
      const guestReplay=await request('TAXPAY_SQL','/payments','POST',guestInput,{apikey:anonKey});
      assert.equal(guestReplay.status,200);
      assert.equal(guestReplay.data.id,guestId);
      assert.equal(guestReplay.data.replayed,true);
      assert.equal(Number(psql(sourceDb,
        'SELECT count(*) FROM demo_payment.story_payments WHERE idempotency_key='+
        sqlText(guestInput.idempotencyKey)+'::uuid;')),1);
      assert.equal(Number(psql(officeDb,
        'SELECT count(*) FROM demo_payment.story_payments WHERE id='+sqlText(guestId)+'::uuid;')),1);
      console.log('PASS WS3 unsigned guest browser: original no-login Pay Tax POST -> anonymous Taxpayer SQL -> signed Edge -> separate Office SQL -> officer API, immutable two-recipient allocations, receipt/certificate, retry and no duplicate parent');
    } finally {
      await guestContext.close();
    }
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
