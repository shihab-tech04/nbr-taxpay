import {expect,test} from '@playwright/test';

test('user1 dashboard, payment history and ledger use one coherent synthetic balance',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Representative desktop financial reconciliation');
  const protectedRpc:string[]=[];
  page.on('request',r=>{if(r.url().includes('.supabase.co/rest/v1/rpc/'))protectedRpc.push(r.url());});
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByText('৳ 180,000').first()).toBeVisible();
  await expect(page.getByText('৳ 80,000').first()).toBeVisible();
  await expect(page.getByText('৳ 75,000').first()).toBeVisible();
  await expect(page.getByText('৳ 25,000').first()).toBeVisible();
  await expect(page.getByText(/SYNTHETIC USER1 DATA/)).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Transaction and evidence register'})).toHaveCount(0);
  await expect(page.getByText('Travel tax (separate)')).toBeVisible();
  await page.getByRole('button',{name:'Open transaction history'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-02').first()).toBeVisible();
  await expect(page.getByText('DEMO-PAY-PEND-01').first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sign in to simulate a payment'})).toBeVisible();
  await page.getByRole('button',{name:'Ledger',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tax ledger'})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-02').first()).toBeVisible();
  await expect(page.getByText('৳ 25,000').first()).toBeVisible();
  expect(protectedRpc).toEqual([]);
});

test('user1 year selection stays consistent across documents and correction screens',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Scenario year and traceability');
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2024-2025');
  await expect(page.getByText('৳ 125,000').first()).toBeVisible();
  await expect(page.getByText('৳ 10,000').first()).toBeVisible();
  await page.locator('.citizen-menu-open').click();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Certificates',exact:true}).click();
  await expect(page).toHaveURL(/scenarioYear=2024-2025/);
  await expect(page.getByRole('heading',{name:'Certificate previews'})).toBeVisible();
  await expect(page.getByText('DEMO-CH-24-01').first()).toBeVisible();
  await page.getByRole('button',{name:'Ledger',exact:true}).click();
  await expect(page.getByText('DEMO-PAY-24-01').first()).toBeVisible();
  await expect(page.getByText('৳ 10,000').first()).toBeVisible();
});

test('user1 exceptions, profile and notifications are correlated but not government verified',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Scenario exception routes');
  await page.goto('/?action=corrections&demoUser=user1');
  await expect(page.getByRole('heading',{name:'Corrections & exceptions'})).toBeVisible();
  await expect(page.getByText('DEMO-ADJ-01').first()).toBeVisible();
  await expect(page.getByText('DEMO-REFUND-01').first()).toBeVisible();
  await page.goto('/?action=account_notifications&demoUser=user1');
  await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-PEND-01').first()).toBeVisible();
  await page.goto('/?action=account_profile&demoUser=user1');
  await expect(page.getByText('DEMO-TIN-001').first()).toBeVisible();
  await expect(page.getByText('Real TIN verified')).toBeVisible();
  await expect(page.getByText('No',{exact:true}).first()).toBeVisible();
});

test('user1 mobile design is bilingual and has no horizontal overflow',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Mobile storybook view');
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.locator('.citizen-mobile-menu-trigger').click();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
  await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
  await expect(page.getByRole('heading',{name:'ড্যাশবোর্ড সারসংক্ষেপ'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('user1 synthetic data is isolated from user2 and authenticated records',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Scenario isolation');
  await page.goto('/?action=taxpayer_home&demoUser=user2');
  await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
  await expect(page.getByText('DEMO-PAY-02',{exact:true})).toHaveCount(0);
  await page.goto('/?action=taxpayer_home');
  await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
});
