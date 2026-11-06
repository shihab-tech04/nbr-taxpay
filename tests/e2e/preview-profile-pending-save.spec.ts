import {test,expect} from '@playwright/test';

/** Exercises the real preview sign-out UI and pending-setting flush.
 * Only HTTP is intercepted; no hosted account data is mutated. */
test('failed preference write keeps profile signed in, retries, and restores saved Bangla after relogin',async({page})=>{
  const cap='A'.repeat(43);
  const sid='00000000-0000-4000-8000-000000009009';
  let persistedLanguage:'en'|'bn'='en';
  let rejectSettingWrites=true;
  let failureCount=0;
  await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
    const request=route.request().postDataJSON() as Record<string,unknown>;
    const action=request.action;
    if(action==='demo-settings'&&request.key==='language'&&rejectSettingWrites){
      failureCount++;
      return route.fulfill({status:503,contentType:'application/json',
        body:JSON.stringify({success:false,code:'SERVICE_UNAVAILABLE'})});
    }
    let data:unknown;
    if(action==='demo-login'){
      if(request.userId!=='user9'||request.password!=='user9')
        return route.fulfill({status:401,contentType:'application/json',
          body:JSON.stringify({success:false,code:'INVALID_DEMO_LOGIN'})});
      data={profileId:'user9',capability:cap,paymentSessionId:sid,
        language:persistedLanguage,selectedListId:null};
    }else if(action==='demo-settings'){
      if(request.key==='language')persistedLanguage=request.value as 'en'|'bn';
      data={language:persistedLanguage,selectedListId:null,paymentSessionId:sid};
    }else if(action==='lists'||action==='people'){data=[];}
    else if(action==='open'){data={active:true};}
    else return route.fulfill({status:404,contentType:'application/json',
      body:JSON.stringify({success:false,code:'NOT_FOUND'})});
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,data})});
  });

  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user9');
  await page.getByLabel('Password',{exact:true}).fill('user9');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);

  await page.goto('/?action=account_settings');
  await page.locator('#taxpay-demo-language').selectOption('bn');
  await page.getByRole('button',{name:'সাইন আউট',exact:true}).click();
  await expect.poll(()=>failureCount).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('alert')).toContainText('আবার সাইন আউট করুন');
  await expect(page).toHaveURL(/action=account_settings/);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBe('user9');

  rejectSettingWrites=false;
  await page.getByRole('button',{name:'সাইন আউট',exact:true}).click();
  await expect(page).toHaveURL(/action=landing/);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
  expect(persistedLanguage).toBe('bn');
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user9');
  await page.getByLabel('Password',{exact:true}).fill('user9');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page.locator('.taxpay-citizen-shell')).toHaveAttribute('lang','bn');
});
