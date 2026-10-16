import {expect,test} from '@playwright/test';

const backend='https://nbr-taxpay-test.invalid';
const payer={
  id:'00000000-0000-4000-8000-000000000071',
  email:'account-owner@example.invalid',
  aud:'authenticated', role:'authenticated',
  app_metadata:{provider:'email',providers:['email']},
  user_metadata:{},created_at:'2026-01-01T00:00:00.000Z'
};
const now=()=>Math.floor(Date.now()/1000);
const response=(body:unknown,status=200)=>({status,contentType:'application/json',headers:{
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods':'GET, POST, OPTIONS'
},body:JSON.stringify(body)});

test('password login uses real Auth request, enters personal dashboard and allows sign out',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Auth protocol is viewport-independent');
  // The fixed desktop sidebar appears at >=1440px; narrower screens use the menu.
  await page.setViewportSize({width:1600,height:900});
  const requests:string[]=[];
  await page.route(`${backend}/**`,async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='OPTIONS')return route.fulfill(response({}));
    if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='password'){
      requests.push('password');
      expect(request.postDataJSON()).toMatchObject({email:payer.email,password:'a-test-password'});
      const exp=now()+3600;
      const accessToken=`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({sub:payer.id,aud:'authenticated',role:'authenticated',exp}))}.synthetic-test-signature`;
      return route.fulfill(response({access_token:accessToken,token_type:'bearer',expires_in:3600,expires_at:exp,refresh_token:'synthetic-refresh',user:payer}));
    }
    if(url.pathname==='/auth/v1/user')return route.fulfill(response(payer));
    if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
    if(request.method()==='GET')return route.fulfill(response([]));
    return route.fulfill(response({message:'Unexpected test operation'},403));
  });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('checkbox',{name:'Remember me'}).uncheck();
  await page.getByRole('textbox',{name:'User ID or email'}).fill(payer.email);
  await page.getByLabel('Password',{exact:true}).fill('a-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Sign out'})).toBeVisible();
  const storage=await page.evaluate(key=>({local:localStorage.getItem(key),session:sessionStorage.getItem(key)}),'sb-nbr-taxpay-test-auth-token');
  expect(storage.local).toBeNull();
  expect(storage.session).toContain('access_token');
  expect(requests).toEqual(['password']);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Sign out'})).toBeVisible();
  await page.locator('.taxpayer-reference-rail').getByRole('button',{name:'Sign out'}).click();
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  await expect(page).not.toHaveURL(/demoUser=/);
});

test('an expired stored session cannot restore private taxpayer screens',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Session expiry is viewport-independent');
  const expiredAt=now()-3600;
  const expiredToken=`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({sub:payer.id,aud:'authenticated',role:'authenticated',exp:expiredAt}))}.synthetic-test-signature`;
  await page.addInitScript(({storageKey,session})=>{
    localStorage.setItem(storageKey,JSON.stringify(session));
  },{
    storageKey:'sb-nbr-taxpay-test-auth-token',
    session:{access_token:expiredToken,token_type:'bearer',expires_in:3600,expires_at:expiredAt,refresh_token:'expired-synthetic-refresh',user:payer}
  });
  let refreshAttempted=false;
  await page.route(`${backend}/**`,async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='OPTIONS')return route.fulfill(response({}));
    if(url.pathname==='/auth/v1/token'&&url.searchParams.get('grant_type')==='refresh_token'){
      refreshAttempted=true;
      return route.fulfill(response({code:'invalid_grant',msg:'Refresh token expired'},400));
    }
    if(url.pathname==='/auth/v1/user')return route.fulfill(response({message:'Session expired'},401));
    return route.fulfill(response({message:'Unexpected expired-session operation'},401));
  });
  await page.goto('/?action=taxpayer_home');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toHaveCount(0);
  expect(refreshAttempted).toBe(true);
  expect(await page.evaluate(key=>localStorage.getItem(key),'sb-nbr-taxpay-test-auth-token')).toBeNull();
});

test('incorrect password shows an actionable error without granting a dashboard',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Auth protocol is viewport-independent');
  let attempted=false;
  await page.route(`${backend}/auth/v1/token**`,async route=>{
    attempted=true;
    await route.fulfill(response({code:'invalid_credentials',msg:'Invalid login credentials'},400));
  });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID or email'}).fill('unknown@example.invalid');
  await page.getByLabel('Password',{exact:true}).fill('not-correct');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Check your email and password');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  expect(attempted).toBe(true);
});

test('forgot-password sends a reset link back to the GitHub Pages login route',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Auth protocol is viewport-independent');
  let redirect='';
  await page.route(`${backend}/auth/v1/recover**`,async route=>{
    redirect=new URL(route.request().url()).searchParams.get('redirect_to')??'';
    await route.fulfill(response({}));
  });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID or email'}).fill('owner@example.invalid');
  await page.getByRole('button',{name:'Forgot password?'}).click();
  await expect(page.getByRole('status')).toContainText('password reset instructions');
  expect(redirect).toContain('action=taxpayer_login');
  expect(redirect).toContain('reset=1');
});
