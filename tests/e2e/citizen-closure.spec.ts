import {expect,test} from '@playwright/test';

test('root is a public information hub with one Login call to action',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Login'})).toHaveAttribute('href','https://shihab-tech04.github.io/NBR-Officemanagment-UI-V2/payments/transactions');
 await expect(page.getByRole('link',{name:'Login'})).toHaveCount(1);
 await expect(page.locator('.citizen-pay')).toHaveCount(0);
 await expect(page.locator('.office-auth')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Explore payment types'})).toBeVisible();
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
  await expect(page.getByText('Activity overview',{exact:true})).toBeVisible();
  await expect(page.getByText('Personal tax credit recognized')).toHaveCount(0);
  await page.getByLabel('Search payments').fill('THIS-REFERENCE-DOES-NOT-EXIST');
  await expect(page.getByText('No matching records')).toBeVisible();
  await expect(page.getByRole('button',{name:'Export records'})).toBeDisabled();
});


test('public mobile navigation offers information anchors but no payment initiation',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?action=landing');
 await expect(page.locator('.public-home-header')).toBeVisible();
 await expect(page.locator('.citizen-bottom-nav')).toHaveCount(0);
 await expect(page.locator('.citizen-pay')).toHaveCount(0);
 await page.getByRole('button',{name:'Menu'}).click();
 await expect(page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Payment types'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('navigation',{name:'Primary navigation'})).toBeHidden();
});

test('obligations dashboard cannot assert fictional credits, demand or paid instalments',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
  await page.getByText('More taxpayer services', { exact: true }).click();
  await page.getByRole('button',{name:'Dashboard'}).click();
  await expect(page.getByRole('heading',{name:'Tax dashboard'})).toBeVisible();
  await expect(page.getByText('No withholding records available.')).toBeVisible();
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


test('home payment categories inform visitors rather than initiating transactions',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Advance income tax'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Withholding tax'})).toBeVisible();
 await expect(page.locator('.citizen-pay')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toHaveCount(0);
 await page.goto('/?action=guest');
 await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toBeVisible();
});

