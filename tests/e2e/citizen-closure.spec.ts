import {expect,test} from '@playwright/test';

test('root loads public payment choices rather than a forced officer login',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
  await expect(page.locator('.office-auth')).toHaveCount(0);
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  await expect(page.getByRole('dialog',{name:'Select payment type'})).toBeVisible();
});
test('sample taxpayer home never invents personal ledger credit',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
  await expect(page.getByRole('heading',{name:'Your tax position'})).toBeVisible();
  await expect(page.getByText('Recognized credit')).toBeVisible();
  await expect(page.getByText('Unverified', {exact:true})).toBeVisible();
  await expect(page.getByText('Not reconciled with eReturn / NBR')).toBeVisible();
  await expect(page.getByText('Total Payments (FY 2024-26):')).toHaveCount(0);
  await expect(page.getByText('Q1 Deposited')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
});
test('taxpayer mobile home and activity support Bangla without overflows',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('heading',{name:'আপনার কর অবস্থান'})).toBeVisible();
  await expect(page.getByText('স্বীকৃত কর ক্রেডিট')).toBeVisible();
  await expect(page.getByText('যাচাই হয়নি',{exact:true})).toBeVisible();
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(322);
  await page.getByRole('button',{name:'পেমেন্ট ও লেনদেন'}).click();
  await expect(page.getByRole('heading',{name:'পেমেন্ট ও লেনদেন'})).toBeVisible();
  await expect(page.getByLabel('পেমেন্ট খুঁজুন')).toBeVisible();
  await expect(page.getByLabel('করবর্ষ')).toBeVisible();
  await expect(page.getByLabel('পেমেন্টের ধরন')).toBeVisible();
});
test('sample payment activity retains filtering and does not assert tax-credit owner',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
  await page.getByRole('button',{name:'Payments & activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByText(/do not establish who receives tax credit/)).toBeVisible();
  await page.getByLabel('Search payments').fill('THIS-REFERENCE-DOES-NOT-EXIST');
  await expect(page.getByText('No matching sample records')).toBeVisible();
  await expect(page.getByRole('button',{name:'Export sample CSV'})).toBeDisabled();
});
