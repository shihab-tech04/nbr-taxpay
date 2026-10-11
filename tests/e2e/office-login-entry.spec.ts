import {expect, test} from '@playwright/test';

test('published root presents recovered Office Management login composition without a fake sign-in', async ({page}, info) => {
  const hostedAuthRequests: string[]=[];
  page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.supabase.co')) hostedAuthRequests.push(request.url())});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'TaxPay',exact:true})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'User ID'})).toBeDisabled();
  await expect(page.getByLabel('Password',{exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Explore TaxPay Demo'})).toBeVisible();
  await expect(page.getByText(/Real sign-in is unavailable/)).toBeVisible();
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
  await page.getByRole('button',{name:'Explore TaxPay Demo'}).click();
  await expect(page.getByText('TaxPay development preview — not an official NBR gateway')).toBeVisible();
  expect(hostedAuthRequests).toEqual([]);
});

test('Office login layout keeps source carousel controls and EN/BN navigation', async ({page}, info) => {
  await page.goto('/');
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('heading',{name:'স্বাগতম'})).toBeVisible();
  await expect(page.getByRole('button',{name:'ট্যাক্সপে ডেমো দেখুন'})).toBeVisible();
  await expect(page.getByRole('button',{name:'সাইন ইন',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'EN'}).click();
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  if(info.project.name==='desktop-1280') {
    await page.getByRole('button',{name:'Pause slideshow'}).click();
    await expect(page.getByRole('button',{name:'Play slideshow'})).toBeVisible();
    await page.getByRole('button',{name:'Go to slide 2'}).click();
    await expect(page.getByRole('heading',{name:'Understand payment status'})).toBeVisible();
  }
  await page.getByRole('button',{name:'Help & User Guide'}).click();
  await expect(page.getByRole('dialog',{name:'TaxPay development preview'})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
