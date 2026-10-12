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
  await expect(page.getByRole('heading',{name:'My Tax Payments'})).toBeVisible();
  await expect(page.getByText('Recognized credit')).toBeVisible();
  await expect(page.getByText('Unverified', {exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tax position'})).toBeVisible();
  await expect(page.getByText('Total Payments (FY 2024-26):')).toHaveCount(0);
  await expect(page.getByText('Q1 Deposited')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
});
test('taxpayer mobile home and activity support Bangla without overflows',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('heading',{name:'আমার কর পেমেন্ট'})).toBeVisible();
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
  await page.getByText('More taxpayer services', { exact: true }).click();
  await page.getByRole('button',{name:'Dashboard'}).click();
  await expect(page.getByRole('heading',{name:'Tax dashboard'})).toBeVisible();
  await expect(page.getByText('No verified eTDS deductions or deductee credits are connected.')).toBeVisible();
  await expect(page.getByText('Available for e-Return AY 2025-2026')).toHaveCount(0);
  await expect(page.getByText('BDT 47,400')).toHaveCount(0);
  await expect(page.getByText('PAID & SCROLLED')).toHaveCount(0);
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('heading',{name:'কর সারসংক্ষেপ'})).toBeVisible();
});

test('certificate previews stay non-official, match the selected type and localize in Bengali',async({page},testInfo)=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Certificates',exact:true}).click();

  await expect(page.getByRole('heading',{name:'Certificate previews'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Annual payment summary'})).toBeVisible();
  await expect(page.getByText('No official certificate is issued from this demonstration.')).toBeVisible();
  await expect(page.getByText('Statutory certificates generated directly from Government Treasury deposit scrolls.')).toHaveCount(0);
  await expect(page.getByText('In Good Standing')).toHaveCount(0);
  await expect(page.getByText('Deputy Commissioner of Taxes')).toHaveCount(0);

  await page.getByRole('button',{name:'Withholding deposit summary',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Withholding deposit summary'})).toBeVisible();
  await expect(page.getByText('Deductee ownership')).toBeVisible();
  await expect(page.getByText('Not verified',{exact:true}).first()).toBeVisible();

  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('heading',{name:'সনদের নমুনা'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'উৎসে কর জমার সারসংক্ষেপ'})).toBeVisible();
  await expect(page.getByText('এই প্রদর্শনী থেকে কোনো সরকারি সনদ ইস্যু করা হয় না।')).toBeVisible();

  if (testInfo.project.name === 'mobile-320' || testInfo.project.name === 'desktop-1280') {
    await page.screenshot({path:`test-results/screenshots/certificate-preview-bn-${testInfo.project.name}.png`,fullPage:false});
  }
});


test('guest payment-category selection enters the matching public journey without authentication',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Understand your next tax-payment step'})).toBeVisible();
  await page.locator('main').getByRole('button',{name:/Advance Tax/}).click();
  await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toBeVisible();
  await expect(page.getByText('Selected purpose: Advance Tax')).toBeVisible();
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
});
