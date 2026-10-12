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
  await expect(page.getByText('স্বীকৃত কর ক্রেডিট',{exact:true})).toBeVisible();
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


test('mobile expanded dock has three destinations and a separate floating Pay action',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?action=landing');
  const dock=page.getByRole('navigation',{name:'Mobile primary navigation'});
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button')).toHaveCount(3);
  await expect(dock.getByRole('button',{name:'Pay',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,420));
  await expect(dock).toHaveCount(0);
  await expect(page.locator('.citizen-corners').getByRole('button',{name:'Home'})).toBeVisible();
  await page.evaluate(()=>window.scrollBy(0,-90));
  await expect(dock).toBeVisible();
});

test('obligations dashboard cannot assert fictional credits, demand or paid instalments',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
  await page.getByRole('button',{name:'Dashboard'}).click();
  await expect(page.getByRole('heading',{name:'Tax dashboard'})).toBeVisible();
  await expect(page.getByText('No verified eTDS deductions or deductee credits are connected.')).toBeVisible();
  await expect(page.getByText('Available for e-Return AY 2025-2026')).toHaveCount(0);
  await expect(page.getByText('BDT 47,400')).toHaveCount(0);
  await expect(page.getByText('PAID & SCROLLED')).toHaveCount(0);
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('heading',{name:'কর সারসংক্ষেপ'})).toBeVisible();
});
