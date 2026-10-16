import {expect, test} from '@playwright/test';

test('Office-style login lets user1 open the correct dashboard without a password or hosted requests', async ({page}, info) => {
  const hostedAuthRequests: string[]=[];
  page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.supabase.co')) hostedAuthRequests.push(request.url())});
  await page.goto('/?action=office_login');
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Amar Kor',exact:true})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'User ID or email'})).toBeEnabled();
  await expect(page.getByLabel('Password',{exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Back to Amar Kor'})).toBeVisible();
  await expect(page.locator('.office-auth-safe-message')).toHaveCount(0);
  expect(hostedAuthRequests).toEqual([]);
  await expect(page.locator('.login-form-card')).toBeVisible();
  if(info.project.name==='desktop-1280') {
    await expect(page.locator('.login-brand-panel .login-slide__image img')).toBeVisible();
    await expect(page.getByRole('button',{name:'Pause slideshow'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Go to slide 1'})).toBeVisible();
  } else {
    await expect(page.locator('.login-brand-panel')).toBeHidden();
  }
  await expect(page.getByRole('combobox',{name:'Appearance theme'})).toHaveCount(0);
  const root=await page.locator('.office-auth').boundingBox();
  expect(root).not.toBeNull();
  expect(root!.x + root!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 2);
  await page.getByRole('textbox',{name:'User ID or email'}).fill('user1');
  await expect(page.getByLabel('Password',{exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home&demoUser=user1/);
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  expect(hostedAuthRequests).toEqual([]);
});

test('explicit Office login keeps source carousel controls and EN/BN navigation', async ({page}, info) => {
  await page.goto('/?action=office_login');
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('heading',{name:'স্বাগতম'})).toBeVisible();
  await expect(page.getByRole('button',{name:'আমার কর-এ ফিরুন'})).toBeVisible();
  await expect(page.getByRole('button',{name:'সাইন ইন',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'EN'}).click();
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  if(info.project.name==='desktop-1280') {
    await page.getByRole('button',{name:'Pause slideshow'}).click();
    await expect(page.getByRole('button',{name:'Play slideshow'})).toBeVisible();
    await page.getByRole('button',{name:'Go to slide 2'}).click();
    await expect(page.getByRole('heading',{name:'Understand payment status'})).toBeVisible();
  }
  await page.getByRole('button',{name:'Help & User Guide'}).click();
  await expect(page.getByRole('dialog',{name:'Help & User Guide'})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});


test('root shows information hub with navigational Login and no forced Office session',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
 await expect(page.locator('.citizen-public-hero__actions').getByRole('link',{name:'Login'})).toHaveCount(0);
 await expect(page.locator('.public-home-header__tools .public-home-login-link--desktop')).toHaveAttribute('href','?action=office_login');
 await expect(page.locator('.office-auth')).toHaveCount(0);
 await expect(page.locator('.citizen-pay')).toHaveCount(0);
 if(page.viewportSize()!.width<=900){
   await page.getByRole('button',{name:'Menu'}).click();
   await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Login'}).click();
 }else{
   await page.locator('.public-home-header__tools .public-home-login-link--desktop').click();
 }
 await expect(page).toHaveURL(/action=office_login/);
 await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
 await expect(page.locator('.office-auth')).toBeVisible();
});

