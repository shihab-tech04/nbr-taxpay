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
  await expect(page.getByText(/Demand Notice DN-|৳ 47,400|Inspecting Joint Commissioner/)).toHaveCount(0);
  await page.goto('/?action=account_settings');
  await expect(page.getByRole('heading',{name:'Profile settings'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save preferences'})).toHaveCount(0);
  await page.goto('/?action=officer_home');
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.locator('#public-home-title')).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(0);
  await expect(page.locator('.taxpayer-account-center')).toHaveCount(0);
});

test('desktop taxpayer rail keeps profile and language above its final sign-out control',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop rail tested on 1600px');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  const bottom=rail.locator('.taxpayer-reference-rail-bottom');
  await expect(bottom.getByRole('button')).toHaveCount(3);
  await expect(bottom.getByRole('button').nth(0)).toHaveText('Profile');
  await expect(bottom.getByRole('button').nth(1)).toContainText('Language');
  await expect(bottom.getByRole('button').last()).toHaveText('Exit workspace');
  await expect(rail.getByRole('button',{name:'Help'})).toHaveCount(0);
  await expect(rail.getByRole('button',{name:'Notifications',exact:true})).toBeVisible();
  await rail.getByRole('button',{name:'Notifications'}).click();
  await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
  await expect(page.getByText('No notifications yet.')).toBeVisible();
  await rail.locator('.taxpayer-reference-brand').click();
  await expect(page.getByRole('heading',{name:'Tax payments, without the confusion'})).toBeVisible();
  // An exploratory sample role is not a signed-in account.
  await expect(page.locator('.public-home-header').getByRole('link',{name:'Login'})).toBeVisible();
  await expect(page.locator('.public-home-header').getByRole('button',{name:'Profile menu'})).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
  await rail.getByRole('button',{name:'Exit workspace'}).click();
  await expect(page.locator('#public-home-title')).toBeVisible();
});

test('a signed-in account returning to public home sees notification and profile controls, then signs out',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One desktop journey covers the shared session transition');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_login');
  await page.getByLabel('User ID').fill('user1');
  await page.getByLabel('Password',{exact:true}).fill('user1');
  await page.getByRole('dialog').getByRole('button',{name:'Sign In'}).click();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await page.locator('.taxpayer-reference-brand').click();
  await expect(page).toHaveURL(/action=landing/);
  const header=page.locator('.public-home-header');
  await expect(header.getByRole('link',{name:'Login'})).toHaveCount(0);
  await expect(header.getByRole('button',{name:'Notifications'})).toBeVisible();
  await expect(header.getByRole('button',{name:'Profile menu'})).toBeVisible();
  const guideLink=header.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'User guide'});
  await expect(guideLink).toBeVisible();
  await guideLink.click();
  await expect(page.getByRole('heading',{name:'Korbritto user guide'})).toBeVisible();
  await header.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Home'}).click();
  await expect(page.getByRole('button',{name:'Help'})).toHaveCount(0);
  await header.getByRole('button',{name:'Profile menu'}).click();
  const profileMenu=header.getByRole('navigation',{name:'Profile menu'});
  await expect(profileMenu.getByRole('button')).toHaveCount(4);
  await expect(profileMenu.getByRole('button').last()).toHaveText('Sign out');
  await profileMenu.getByRole('button',{name:'Profile',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Taxpayer profile',level:1,exact:true})).toBeVisible();

  await page.goto('/?action=landing');
  await header.getByRole('button',{name:'Profile menu'}).click();
  await profileMenu.getByRole('button',{name:'Sign out'}).click();
  await expect(header.getByRole('link',{name:'Login'})).toBeVisible();
  await expect(header.getByRole('button',{name:'Profile menu'})).toHaveCount(0);
});

test('signed-in public mobile uses the existing private-style header, shared sheet and account actions',async({page},info)=>{
  test.skip(info.project.name!=='mobile-320','One runner tests the tightest mobile layout');
  await page.goto('/?action=taxpayer_login');
  await page.getByLabel('User ID').fill('user1');
  await page.getByLabel('Password',{exact:true}).fill('user1');
  await page.getByRole('dialog').getByRole('button',{name:'Sign In'}).click();
  await page.locator('.citizen-brand').click();
  await expect(page).toHaveURL(/action=landing/);
  for(const width of [320,360,375,390]) {
    await page.setViewportSize({width,height:812});
    await page.goto('/?action=landing');
    const header=page.locator('.taxpay-public-mobile-navigation .citizen-header');
    await expect(header.getByRole('button',{name:'Notifications'})).toBeVisible();
    await expect(header.getByRole('button',{name:'Korbritto home'})).toBeVisible();
    await header.getByRole('button',{name:'Open menu'}).click();
    const menu=page.getByRole('dialog',{name:'Services & menu'});
    await expect(menu.getByRole('button',{name:'Beneficiaries'})).toBeVisible();
    await expect(menu.getByRole('button',{name:'Sign out'})).toBeVisible();
    await menu.getByRole('button',{name:'Close'}).click();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
  const bnSheet=page.getByRole('dialog',{name:'সেবা ও মেনু'});
  await expect(bnSheet.getByRole('button',{name:'সাইন আউট'})).toBeVisible();
  await bnSheet.getByRole('button',{name:'সাইন আউট'}).click();
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(0);
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
