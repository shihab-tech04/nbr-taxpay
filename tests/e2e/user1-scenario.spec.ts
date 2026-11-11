import {expect,test} from '@playwright/test';

async function openTaxLedger(page: import('@playwright/test').Page) {
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  if (await rail.isVisible()) await rail.getByRole('button',{name:'Tax ledger',exact:true}).click();
  else await page.getByRole('button',{name:'Tax Ledger',exact:true}).click();
}

test('user1 dashboard, payment history and ledger use one coherent synthetic balance',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Representative desktop financial reconciliation');
  const protectedRpc:string[]=[];
  page.on('request',r=>{if(r.url().includes('.supabase.co/rest/v1/rpc/'))protectedRpc.push(r.url());});
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByText('৳ 180,000').first()).toBeVisible();
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
  // Equivalent posted TDS + AIT source figures remain in the coverage breakdown.
  await expect(page.getByRole('button',{name:/TDS.*48,000/})).toBeVisible();
  await expect(page.getByRole('button',{name:/Advance tax.*32,000/})).toBeVisible();
  await expect(page.getByText('৳ 75,000').first()).toBeVisible();
  await expect(page.getByRole('button',{name:/Still remaining.*25,000/})).toBeVisible();
  await expect(page.getByText(/SYNTHETIC USER1 DATA/)).toHaveCount(0);
  await expect(page.getByText('Sample',{exact:true})).toHaveCount(0);
  await expect(page.locator('summary[aria-label="About Sample"]')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Transaction and evidence register'})).toHaveCount(0);
  await expect(page.getByTestId('beneficiary-spending-breakdown')).toBeVisible();
  await page.getByRole('button',{name:'View all activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.locator('.taxpayer-transaction-table tbody td:nth-child(2)').getByText('DEMO-PAY-02',{exact:true}).first()).toBeVisible();
  await expect(page.locator('.taxpayer-transaction-table tbody td:nth-child(2)').getByText('DEMO-PAY-PEND-01',{exact:true}).first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Sign in to make a payment'})).toHaveCount(0);
  await openTaxLedger(page);
  await expect(page.getByRole('heading',{name:'Tax ledger'})).toBeVisible();
  await expect(page.locator('table').getByText('DEMO-PAY-02')).toBeVisible();
  await expect(page.getByText('৳ 25,000').first()).toBeVisible();
  expect(protectedRpc).toEqual([]);
});

test('user1 year selection stays consistent across documents and correction screens',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Scenario year and traceability');
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2024-2025');
  await expect(page.getByText('৳ 125,000').first()).toBeVisible();
  await expect(page.getByText('৳ 10,000').first()).toBeVisible();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  if (await rail.isVisible()) {
    await rail.getByRole('button',{name:'Activity',exact:true}).click();
    await page.getByRole('navigation',{name:'Activity sections'}).getByRole('button',{name:'Receipts & certificates'}).click();
  } else {
    await page.locator('.citizen-menu-open').click();
    await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Certificates',exact:true}).click();
  }
  await expect(page).toHaveURL(/scenarioYear=2024-2025/);
  await expect(page.getByRole('heading',{name:'Receipts & payment records'})).toBeVisible();
  await expect(page.getByText('DEMO-CH-24-01').first()).toBeVisible();
  await openTaxLedger(page);
  await expect(page.locator('table').getByText('DEMO-PAY-24-01')).toBeVisible();
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
  await expect(page.getByTestId('user1-profile-tin')).toHaveText('577935451798');
  await expect(page.getByText('Taxpayer class')).toBeVisible();
  await expect(page.getByTestId('user1-taxpayer-profile').getByText('Individual',{exact:true}).first()).toBeVisible();
});

test('user1 mobile design is bilingual and has no horizontal overflow',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Mobile storybook view');
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.locator('.citizen-mobile-menu-trigger').click();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
  await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
  await expect(page.getByRole('heading',{name:'সংক্ষিপ্ত বিবরণ'})).toBeVisible();
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


test('user1 Activity retains the approved transaction table and removes redundant payment panels',async({page},info)=>{
  test.skip(!['desktop-1280','mobile-375'].includes(info.project.name),'Target desktop/mobile Activity regression');
  await page.goto('/?action=history&demoUser=user1');
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  const transactions=page.locator('.taxpayer-transaction-panel');
  await expect(transactions).toBeVisible();
  await expect(transactions.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(transactions.getByRole('searchbox',{name:'Search transaction reference'})).toBeVisible();
  await transactions.getByRole('button',{name:'Filter',exact:true}).click();
  await expect(transactions.getByRole('combobox',{name:'Transaction category'})).toBeVisible();
  await expect(transactions.getByRole('combobox',{name:'Transaction status'})).toBeVisible();
  await expect(transactions.getByRole('button',{name:'Export CSV'})).toBeVisible();
  // Neither SQL fixture details nor a second saved-history register belongs
  // underneath the one approved Activity table. Do not delete their source data.
  await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Tax service activity'})).toHaveCount(0);
  await expect(page.getByTestId('recovered-story-payments')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Earlier saved payment records'})).toHaveCount(0);
  const search=transactions.getByRole('searchbox',{name:'Search transaction reference'});
  await search.fill('DEMO-PAY-02');
  const visibleRows=info.project.name==='mobile-375'
    ? transactions.getByTestId('taxpayer-transaction-mobile-cards')
    : transactions.getByRole('table',{name:'Payment transactions'});
  if(info.project.name==='desktop-1280')
    await expect(visibleRows.locator('tbody td:nth-child(2)').getByText('DEMO-PAY-02',{exact:true}).first()).toBeVisible();
  else
    await expect(visibleRows.getByText('DEMO-PAY-02').first()).toBeVisible();
  await search.fill('not-an-existing-reference');
  await expect(transactions.getByRole('heading',{name:'No matching records'})).toBeVisible();
  await search.clear();
  await expect(transactions.getByRole('heading',{name:'No matching records'})).toHaveCount(0);
  // Pagination remains functional after removing only the appended panels.
  const pagination=transactions.getByRole('navigation',{name:'Page navigation'});
  await expect(pagination.getByRole('button',{name:'Next'})).toBeVisible();
  await pagination.getByRole('button',{name:'Next'}).click();
  await expect(pagination.getByRole('button',{name:'Page 2'})).toHaveAttribute('aria-current','page');
  await expect(pagination).toContainText('Showing 11–14 of 14 records');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
});


test('user1 unified profile displays all distinct TIN fields with no tabs, duplicates or overflow',async({page},info)=>{
  test.skip(!['desktop-1280','mobile-375'].includes(info.project.name),'Unified taxpayer profile desktop/mobile acceptance');
  await page.goto('/?action=account_profile&demoUser=user1');
  const profile=page.getByTestId('user1-taxpayer-profile');
  const content=profile.getByTestId('user1-profile-unified-content');
  await expect(profile).toBeVisible();
  await expect(content).toBeVisible();
  await expect(profile.getByRole('heading',{name:'Md. Arif Rahman'})).toBeVisible();
  await expect(profile.getByTestId('user1-profile-tin')).toHaveText('577935451798');
  await expect(profile.getByRole('tab')).toHaveCount(0);
  await expect(profile.getByRole('tablist')).toHaveCount(0);
  await expect(profile.getByRole('button',{name:'View payment activity'})).toHaveCount(0);
  await expect(content.getByTestId('user1-profile-detail-columns').locator(':scope > div')).toHaveCount(2);
  for(const section of ['Personal information','Contact and addresses','TIN registration and jurisdiction',
    'Certificate details'])
    await expect(content.getByRole('heading',{name:section,exact:true})).toHaveCount(1);
  for(const field of ['Taxpayer class','TIN classification','User type','Local taxpayer',
    'Mobile number','Email address','Registered / permanent address','Current address',
    'Taxes zone','Taxes range','District','Country','Previous TIN',
    'Certificate issue date','Certificate last updated','Issuing tax officer','Tax office address',
    'Tax office phone']){
    await expect(content.getByText(field,{exact:true})).toHaveCount(1);
  }
  await expect(content.getByText('Taxes circle',{exact:true})).toHaveCount(0);
  await expect(content.getByText('Registered name',{exact:true})).toHaveCount(0);
  await expect(content.getByText('TIN type',{exact:true})).toHaveCount(0);
  await expect(profile.getByText('TIN type',{exact:true})).toHaveCount(1);
  await expect(profile.getByText('Taxes circle',{exact:true})).toHaveCount(1);
  await expect(profile.getByText('Last account login',{exact:true})).toHaveCount(1);
  await expect(content.getByText('Last account login',{exact:true})).toHaveCount(0);
  await expect(profile.getByRole('heading',{name:'Account information'})).toHaveCount(0);
  const summary=profile.getByTestId('user1-profile-summary');
  await expect(summary.locator(':scope > div')).toHaveCount(4);
  await expect(summary).toContainText('11 Nov 2026, 11:23:40 AM');
  await expect(content).toContainText('Taxes Zone-12, Dhaka');
  await expect(content).toContainText('04 Jun 2026, 05:06:20 PM');
  await expect(content).toContainText('3/4 Purana Paltan');
  await expect(content).toContainText('email@test.com');
  await expect(profile.getByText(/Fictional sample profile|Sample TIN|Not an NBR-issued TIN/i)).toHaveCount(0);
  await expect(profile.getByText('Not available',{exact:true})).toHaveCount(0);
  await expect(profile.getByRole('button',{name:'Copy TIN'})).toBeVisible();
  await expect(profile.getByRole('button',{name:'Download profile'})).toBeVisible();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  if(await rail.isVisible())await expect(rail.getByRole('button',{name:'Activity',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.goto('/?action=account_profile&demoUser=user1&lang=bn');
  const bn=page.getByTestId('user1-profile-unified-content');
  await expect(bn).toBeVisible();
  await expect(bn.getByRole('heading',{name:'ব্যক্তিগত তথ্য'})).toBeVisible();
  await expect(bn.getByRole('heading',{name:'টিআইএন নিবন্ধন ও কর অধিক্ষেত্র'})).toBeVisible();
  await expect(bn.getByRole('heading',{name:'সনদের তথ্য'})).toBeVisible();
  await expect(bn.getByText('সনদ ইস্যুর তারিখ')).toHaveCount(1);
  await expect(page.getByTestId('user1-profile-summary').getByText('সর্বশেষ লগইন')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
test('user1 profile export contains supplied TIN fields without unnecessary copy',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Download verification');
  await page.goto('/?action=account_profile&demoUser=user1');
  const [download]=await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button',{name:'Download profile'}).click()
  ]);
  expect(download.suggestedFilename()).toBe('Korbritto-user1-profile.csv');
  const stream=await download.createReadStream();
  let text='';
  for await(const chunk of stream)text+=chunk.toString('utf8');
  expect(text).toContain('577935451798');
  expect(text).toContain('email@test.com');
  expect(text).toContain('Taxes Zone-12, Dhaka');
  expect(text).not.toContain('FICTIONAL SAMPLE');
});
