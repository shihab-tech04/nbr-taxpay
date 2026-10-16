import { expect, test } from '@playwright/test';

test('public page does not claim real payment processing or grant account roles',async({page})=>{
 await page.goto('/?action=landing');
 await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
 await expect(page.getByText('No government payments or challans are issued here.')).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Demo role'})).toHaveCount(0);
 await expect(page.locator('.citizen-pay')).toHaveCount(0);
 await expect(page.locator('.public-home-header__tools .public-home-login-link--desktop')).toHaveAttribute('href','?action=office_login');
 await expect(page.getByRole('heading',{name:'Frequently asked questions'})).toBeVisible();
 await page.getByRole('button',{name:'বাংলা'}).click();
 await expect(page.getByRole('heading',{name:'কর পরিশোধ বুঝুন, নিজের লেনদেন জানুন।'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'সাধারণ জিজ্ঞাসা'})).toBeVisible();
 await expect(page.getByText('এখানে সরকারি পেমেন্ট বা চালান ইস্যু হয় না।')).toHaveCount(0);
});

test('unverified tax calculator never quotes fictitious slab liability', async ({page}) => {
  await page.goto('/?action=guidance');
  await expect(page.getByRole('heading',{name:'Individual income tax estimator — unavailable'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Proceed to Pay Estimated Tax'})).toHaveCount(0);
  await expect(page.getByText(/Tax calculations are unavailable until the applicable tax rules are verified/)).toBeVisible();
  if (await page.locator('.citizen-mobile-menu-trigger').isVisible()) {
    await page.getByRole('button',{name:'Open menu'}).click();
    await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
    await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
  } else {
    await page.locator('.citizen-header').getByRole('button',{name:'বাংলা'}).click();
  }
  await expect(page.getByRole('heading',{name:'ব্যক্তিগত আয়কর হিসাব — বর্তমানে বন্ধ'})).toBeVisible();
});

test('travel tax simulation cannot be presented as a real immigration challan',async ({page})=>{
  await page.goto('/?action=travel');
  await expect(page.getByText('Enter your travel details.')).toBeVisible();
  await expect(page.getByText(/Rates and exemptions are not verified/)).toBeVisible();
});

test('public mobile information menu is keyboard usable with accessible targets',async({page},info)=>{
 test.skip(info.project.name==='desktop-1280','Mobile navigation only');
 await page.goto('/?action=landing');
 const header=page.locator('.public-home-header');
 const home=header.getByRole('link',{name:/Amar Kor/});
 await expect(home).toBeVisible();
 await home.focus(); await expect(home).toBeFocused();
 const menu=header.getByRole('button',{name:'Menu'});
 await expect(menu).toBeVisible();
 const bounds=await menu.boundingBox();
 expect(bounds).not.toBeNull();
 expect(bounds!.width).toBeGreaterThanOrEqual(43.5);
 expect(bounds!.height).toBeGreaterThanOrEqual(43.5);
 await menu.click();
 await expect(header.getByRole('navigation',{name:'Primary navigation'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(header.getByRole('navigation',{name:'Primary navigation'})).toBeHidden();
 await page.getByRole('button',{name:'বাংলা'}).click();
 await expect(header.getByRole('button',{name:'মেনু'})).toBeVisible();
});

