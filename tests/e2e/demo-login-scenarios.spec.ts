import { expect, test } from '@playwright/test';

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
   await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
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
   await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
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
 await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toBeVisible();
 await expect(page).not.toHaveURL(/demoUser=/);
 await page.goto('/?action=landing');
 await expect(page.locator('.public-home-header__tools .public-home-login-link--desktop'))
   .toHaveAttribute('href','?action=taxpayer_login');
});

test('User 1 login reveals both dashboard phases and retains them after refresh',async({page})=>{
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user1');
  await page.getByLabel('Password',{exact:true}).fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page).not.toHaveURL(/demoUser=/);
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Needs review'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'By assessment year'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'How your credits are made up'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Current tax position'})).toBeVisible();
  await expect(page.getByRole('table',{name:'Posted credit components'})).toContainText('৳ 155,000');
  await expect(page.getByRole('region',{name:'Current tax position'})).toContainText('৳ 25,000');
  await page.reload();
  await expect(page.getByRole('heading',{name:'How your credits are made up'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Current tax position'})).toContainText('৳ 25,000');
});

