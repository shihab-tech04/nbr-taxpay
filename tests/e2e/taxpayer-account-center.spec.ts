import { expect, test } from '@playwright/test';

test('sample taxpayer can navigate a fictional profile and personal settings without impersonating a login',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','One end-to-end responsive sample journey');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Profile',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Profile',exact:true,level:1})).toBeVisible();
  await expect(page.getByText('Account details')).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign out'})).toHaveCount(0);
  await page.getByRole('navigation',{name:'Account pages'}).getByRole('button',{name:'Profile settings'}).click();
  await expect(page.getByRole('combobox',{name:'Interface language'})).toBeVisible();
  await page.getByRole('combobox',{name:'Interface language'}).selectOption('bn');
  await expect(page.getByRole('heading',{name:'প্রোফাইল সেটিংস'})).toBeVisible();
  await page.getByRole('navigation',{name:'অ্যাকাউন্ট পৃষ্ঠা'}).getByRole('button',{name:'বিজ্ঞপ্তি'}).click();
  await expect(page.getByText('এখনো কোনো বিজ্ঞপ্তি নেই।')).toBeVisible();
  await expect(page.getByText(/Demand Notice|Statutory Alerts|Advance Tax 2nd Quarter/)).toHaveCount(0);
  await page.getByRole('button',{name:'ওয়ার্কস্পেস থেকে বের হন'}).click();
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(0);
});

test('profile and notification routes protect private data; legacy Office links return to public TaxPay',async({page})=>{
  await page.goto('/?action=account_notifications');
  await expect(page.getByRole('heading',{name:'Notifications'})).toBeVisible();
  await expect(page.getByText('Sign-in is currently unavailable.')).toBeVisible();
  await expect(page.getByText('No notifications yet.')).toBeVisible();
  await expect(page.getByText(/Demand Notice DN-|BDT 47,400|Inspecting Joint Commissioner/)).toHaveCount(0);
  await page.goto('/?action=account_settings');
  await expect(page.getByRole('heading',{name:'Profile settings'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save preferences'})).toHaveCount(0);
  await page.goto('/?action=officer_home');
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(0);
  await expect(page.locator('.taxpayer-account-center')).toHaveCount(0);
});

test('desktop taxpayer rail includes profile, notifications, settings and safe exit',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop rail tested on 1600px');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  const accountGroup=rail.locator('.taxpayer-reference-account');
  await expect(accountGroup.locator('summary')).toBeVisible();
  await accountGroup.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(accountGroup).toHaveAttribute('open','');
  for(const label of ['Profile','Profile settings'])await expect(accountGroup.getByRole('button',{name:label,exact:true})).toBeVisible();
  await expect(rail.getByRole('button',{name:'Notifications',exact:true})).toBeVisible();
  await rail.getByRole('button',{name:'Notifications'}).click();
  await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
  await expect(page.getByText('No notifications yet.')).toBeVisible();
  await rail.getByRole('button',{name:'Exit workspace'}).click();
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
});

test('account UI retains no horizontal overflow at six mobile and desktop widths',async({page},info)=>{
  test.skip(info.project.name!=='mobile-320','One worker drives the exact viewport matrix');
  for(const width of [320,360,375,390,768,1280]){
    await page.setViewportSize({width,height:812});
    await page.goto('/?action=account_settings');
    await expect(page.getByRole('heading',{name:'Profile settings'})).toBeVisible();
    const delta=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(delta,'account settings overflow at '+width).toBeLessThanOrEqual(2);
    await page.screenshot({path:'test-results/screenshots/taxpayer-account-settings-'+width+'.png',fullPage:false});
  }
});
