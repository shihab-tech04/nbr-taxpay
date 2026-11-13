import { expect, test } from '@playwright/test';

for (const language of ['en','bn'] as const) {
 for (const project of ['desktop-1280','mobile-375'] as const) {
  test(`first fictional account sign-in requires the demo OTP before opening the account (${language}, ${project})`,async({page},info)=>{
   test.skip(info.project.name!==project,'First-login OTP coverage for both languages and viewport sizes');
   const bn=language==='bn';
   await page.addInitScript(()=>localStorage.removeItem('korbritto.demo-login-otp.v1:user1'));
   const authRequests:string[]=[];
   page.on('request',request=>{
     if(new URL(request.url()).pathname.includes('/auth/v1/'))authRequests.push(new URL(request.url()).pathname);
   });
   await page.goto('/?action=taxpayer_login'+(bn?'&lang=bn':''));
   const dialog=page.getByRole('dialog');
   const userId=dialog.locator('#taxpayer-login-user-id');
   const password=dialog.locator('#taxpayer-login-password');
   const submit=dialog.getByTestId('taxpayer-login-submit');

   // A typed TIN and the public demo code cannot enter the fictional login flow.
   await userId.fill('012345678901');
   await password.fill('111111');
   await submit.click();
   await expect(dialog.getByTestId('demo-otp-input')).toHaveCount(0);
   await expect(dialog.getByRole('alert')).toContainText(bn?'ইউজার আইডি বা পাসওয়ার্ড সঠিক নয়।':'Incorrect User ID or password.');

   await userId.fill('user1');
   await password.fill('user1');
   await submit.click();
   const otp=dialog.getByTestId('demo-otp-input');
   await expect(otp).toBeVisible();
   await otp.fill('000000');
   await submit.click();
   await expect(dialog.getByRole('alert')).toContainText(bn?'ডেমো কোড সঠিক নয়। 111111 লিখুন।':'Incorrect demo code. Enter 111111.');
   await expect(page.getByRole('heading',{name:bn?'সংক্ষিপ্ত বিবরণ':'Overview'})).toHaveCount(0);

   await otp.fill('111111');
   await submit.click();
   await expect(dialog.getByRole('status')).toContainText(bn?'সাইন ইন সফল হয়েছে':'Sign-in successful.');
   await expect(page.getByRole('heading',{name:bn?'সংক্ষিপ্ত বিবরণ':'Overview'})).toBeVisible();
   expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBe('user1');
   expect(await page.evaluate(()=>localStorage.getItem('korbritto.demo-login-otp.v1:user1'))).toBe('complete');
   expect(authRequests).toEqual([]);
  });
 }
}

test('all ten matching User ID and password pairs open their own account views',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','One complete user-ID routing matrix');
 const backendCalls:string[]=[];
 const authorizationActors=new Set<string>();
 page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.supabase.co'))backendCalls.push(request.url());});
 // The signed-in authorization notification polls by actor. Intercept its reads so
 // this disconnected-preview test never contacts the live fictional database.
 await page.route('**/functions/v1/demo-story1-taxpay/authorizations?actor=*',async route=>{
   const request=route.request();
   expect(request.method()).toBe('GET');
   authorizationActors.add(new URL(request.url()).searchParams.get('actor')??'');
   await route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"data":[]}'});
 });
 for(let n=1;n<=10;n++){
   await page.goto('/?action=taxpayer_login');
   await page.getByRole('textbox',{name:'User ID'}).fill('user'+n);
   await page.getByLabel('Password',{exact:true}).fill('user'+n);
   await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeEnabled();
   await page.getByRole('button',{name:'Sign In',exact:true}).click();
   await expect(page).toHaveURL(/action=taxpayer_home/);
   await expect(page).not.toHaveURL(/demoUser=/);
   await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
   expect(await page.evaluate(()=>sessionStorage.getItem('taxpay-taxpayer-preview-user'))).toBe('user'+n);
 }
 expect([...authorizationActors].sort()).toEqual(Array.from({length:10},(_,i)=>`user${i+1}`).sort());
 expect(backendCalls.every(url=>new URL(url).pathname==='/functions/v1/demo-story1-taxpay/authorizations')).toBe(true);
});

test('legacy scenario URLs never reveal fictitious accounts or trigger hosted services',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Run legacy ten-URL regression matrix');
 const backendCalls:string[]=[];
 page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.supabase.co')) backendCalls.push(request.url());});
 for(let n=1;n<=10;n++){
   await page.goto('/?action=taxpayer_home&demoUser=user'+n);
   await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
   await expect(page.getByText('Demo scenario',{exact:false})).toHaveCount(0);
   await expect(page.getByText('Example records; no taxpayer account is connected.')).toHaveCount(0);
   await expect(page.getByText('DEMO-TIN-00'+n,{exact:false})).toHaveCount(0);
   await expect(page.locator('#citizen-sample-role')).toHaveCount(0);
 }
 expect(backendCalls).toEqual([]);
});
test('legacy URL offers account access without fabricated sign-out',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','One mobile account-access journey');
 await page.goto('/?action=taxpayer_home&demoUser=user3');
 await expect(page.getByText('Demo scenario',{exact:false})).toHaveCount(0);
 await page.getByRole('button',{name:'Open menu'}).click();
 const dialog=page.getByRole('dialog',{name:'Services & menu'});
 await expect(dialog.getByRole('button',{name:'Exit demonstration account'})).toHaveCount(0);
 await dialog.getByRole('button',{name:'Sign in'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page).not.toHaveURL(/demoUser=/);
 await page.goto('/?action=landing');
 await expect(page.locator('.public-home-header__tools .public-home-login-link--desktop'))
   .toHaveAttribute('href','?action=taxpayer_login');
});

test('User 1 login keeps the bento Overview and financial sources after refresh',async({page})=>{
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user1');
  await page.getByLabel('Password',{exact:true}).fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page).not.toHaveURL(/demoUser=/);
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'What needs your attention?'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Current tax position'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'By payment service'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'By beneficiary relationship'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-chart-source')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Current tax position'})).toHaveCount(0);
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
});
