import { expect, test } from '@playwright/test';

test('a User ID popup session never creates a Supabase authenticated user',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Backend isolation is viewport-independent');
  const calls:string[]=[];
  // Public user-ID previews use the demo Edge capability, never Auth. This
  // disconnected test mocks that endpoint rather than calling production.
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
    const body=route.request().postDataJSON() as {action?:string;userId?:string};
    if(body.action!=='demo-login'||body.userId!=='user2')throw Error('Unexpected demo endpoint call');
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{
      profileId:'user2',capability:'E'.repeat(43),
      paymentSessionId:'00000000-0000-4000-8000-000000000002',
      language:'en',selectedListId:null,
    }})});
  });
  page.on('request',req=>{
    if(new URL(req.url()).hostname.endsWith('.supabase.co') && /\/auth\/v1\/token/.test(req.url()))
      calls.push(req.url());
  });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user2');
  await page.getByLabel('Password',{exact:true}).fill('user2');
  await page.getByRole('button',{name:'Sign In'}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByText('User ID: user2')).toBeVisible();
  expect(calls).toEqual([]);
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('sb-')))).toEqual([]);
});

test('invalid ID and password cannot open a taxpayer profile',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One validation case');
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('administrator');
  await page.getByLabel('Password',{exact:true}).fill('administrator');
  await page.getByRole('button',{name:'Sign In'}).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect User ID or password');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await page.goto('/?action=account_profile');
  await expect(page.getByRole('heading',{name:'Profile',exact:true,level:1})).toBeVisible();
  await expect(page.getByText('User ID: administrator')).toHaveCount(0);
  expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBeNull();
});

test('TaxPay retains a separate authenticated email access screen',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One backend boundary check');
  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading',{name:'Secure Korbritto workspace'})).toBeVisible();
  await expect(page.locator('.office-auth')).toHaveCount(0);
});
