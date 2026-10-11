import {expect, test} from '@playwright/test';

test('default URL opens Office Management login rather than a payment screen', async ({page}) => {
  const hostedAuthRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname.endsWith('.supabase.co')) hostedAuthRequests.push(url.hostname);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Sign in'})).toBeVisible();
  await expect(page.getByText('TaxPay Office Login')).toBeVisible();
  await expect(page.getByRole('textbox', {name:'User ID'})).toBeDisabled();
  await expect(page.getByLabel('Password', {exact:true})).toBeDisabled();
  await expect(page.getByRole('button', {name:'Sign in', exact:true})).toBeDisabled();
  await expect(page.getByRole('button', {name:'Explore TaxPay Demo'})).toBeVisible();
  expect(hostedAuthRequests).toEqual([]);
  await page.getByRole('button', {name:'Explore TaxPay Demo'}).click();
  await expect(page.getByText('TaxPay development preview — not an official NBR gateway')).toBeVisible();
  await expect(page.getByRole('combobox', {name:'Demo role selector — not real authorization'})).toBeVisible();
  expect(hostedAuthRequests).toEqual([]);
});

test('login language control works while direct demo links remain available', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name:'বাংলা'}).click();
  await expect(page.getByRole('heading', {name:'সাইন ইন'})).toBeVisible();
  await expect(page.getByRole('button', {name:'ট্যাক্সপে ডেমো দেখুন'})).toBeVisible();
  await expect(page.getByRole('button', {name:'সাইন ইন', exact:true})).toBeDisabled();
  const rootBox = await page.locator('main').first().boundingBox();
  expect(rootBox).not.toBeNull();
  expect(rootBox!.x + rootBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 2);
  await page.goto('/?action=landing');
  await expect(page.getByText('TaxPay development preview — not an official NBR gateway')).toBeVisible();
});
