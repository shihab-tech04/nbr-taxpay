import { expect, test } from '@playwright/test';

test('taxpayer account pages never present a synthetic identity as signed in',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','One end-to-end mobile account journey');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Profile',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Profile',exact:true,level:1})).toBeVisible();
  await expect(page.getByText('Sign-in is currently unavailable.')).toBeVisible();
  await expect(page.getByText('Demo account')).toHaveCount(0);
  await expect(page.getByText('DEMO-TIN-001',{exact:false})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Sign out'})).toHaveCount(0);
  await page.getByRole('navigation',{name:'Account pages'}).getByRole('button',{name:'Profile settings'}).click();
  await expect(page.getByRole('combobox',{name:'Interface language'})).toHaveCount(0);
  await page.getByRole('button',{name:'Open menu'}).click();
  const dialog=page.getByRole('dialog',{name:'Services & menu'});
  await dialog.getByRole('button',{name:'বাংলা'}).click();
  await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
  await expect(page.getByRole('heading',{name:'প্রোফাইল সেটিংস'})).toBeVisible();
  await page.getByRole('navigation',{name:'অ্যাকাউন্ট পৃষ্ঠা'}).getByRole('button',{name:'বিজ্ঞপ্তি'}).click();
  await expect(page.getByText(/Demand Notice|Statutory Alerts|Advance Tax 2nd Quarter/)).toHaveCount(0);
  await page.getByRole('button',{name:'মেনু খুলুন'}).click();
  await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'সাইন ইন'}).click();
  await expect(page.locator('.taxpayer-reference-secure')).toBeVisible();
});

test('profile and notification routes never expose private data to anonymous Guest or Officer',async({page})=>{
  await page.goto('/?action=account_notifications');
  await expect(page.getByRole('heading',{name:'Notifications'})).toBeVisible();
  await expect(page.getByText('Sign-in is currently unavailable.')).toBeVisible();
  await expect(page.getByText('No notifications yet.')).toHaveCount(0);
  await expect(page.getByText(/Demand Notice DN-|BDT 47,400|Inspecting Joint Commissioner/)).toHaveCount(0);
  await page.goto('/?action=account_settings');
  await expect(page.getByRole('heading',{name:'Profile settings'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save preferences'})).toHaveCount(0);
  await page.goto('/?action=officer_home');
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(0);
  await expect(page.locator('.taxpayer-account-center')).toHaveCount(0);
});

test('desktop taxpayer rail includes profile, notifications, settings and safe exit',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop rail tested on 1600px');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  for(const label of ['Profile','Notifications','Profile settings'])await expect(rail.getByRole('button',{name:label,exact:true})).toBeVisible();
  await rail.getByRole('button',{name:'Notifications'}).click();
  await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
  await expect(page.getByText('Sign-in is currently unavailable.')).toBeVisible();
  await expect(page.getByText(/Demand Notice DN-|BDT 47,400|Inspecting Joint Commissioner/)).toHaveCount(0);
  await rail.getByRole('button',{name:'Sign in'}).click();
  await expect(page.locator('.taxpayer-reference-secure')).toBeVisible();
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
