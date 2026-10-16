import { expect, test } from '@playwright/test';

test('a User ID popup session never creates a Supabase authenticated user',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Backend isolation is viewport-independent');
  const calls:string[]=[];
  page.on('request',req=>{
    if(new URL(req.url()).hostname.endsWith('.supabase.co') && /\/auth\/v1\/token/.test(req.url()))
      calls.push(req.url());
  });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user2');
  await page.getByRole('button',{name:'Login'}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByText('User ID: user2')).toBeVisible();
  expect(calls).toEqual([]);
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('sb-')))).toEqual([]);
});

test('invalid password-free ID cannot open a taxpayer profile',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One validation case');
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('administrator');
  await page.getByRole('button',{name:'Login'}).click();
  await expect(page.getByRole('alert')).toContainText('valid User ID');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await page.goto('/?action=account_profile');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
});

test('TaxPay retains a separate authenticated email access screen',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One backend boundary check');
  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading',{name:'Secure Amar Kor workspace'})).toBeVisible();
  await expect(page.locator('.office-auth')).toHaveCount(0);
});
