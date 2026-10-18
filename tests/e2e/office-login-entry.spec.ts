import { expect, test } from '@playwright/test';

test('the former Office login deep link now opens the Amar Kor taxpayer popup', async ({page}) => {
  await page.goto('/?action=office_login');
  await expect(page.locator('#public-home-title')).toBeVisible();
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Amar Kor Account'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeVisible();
  await expect(dialog.getByLabel('Password',{exact:true})).toHaveAttribute('type','password');
  await expect(page.locator('.office-auth')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Close'}).click();
  await expect(page).toHaveURL(/action=landing/);
});

test('login popup preserves Bengali interface and returns to taxpayer dashboard', async ({page}) => {
  await page.goto('/?action=taxpayer_login&lang=bn');
  const dialog=page.getByRole('dialog',{name:'আপনার আমার কর অ্যাকাউন্টে সাইন ইন করুন'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox',{name:'ইউজার আইডি'}).fill('user4');
  await dialog.getByLabel('পাসওয়ার্ড',{exact:true}).fill('user4');
  await dialog.getByRole('button',{name:'সাইন ইন'}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page).toHaveURL(/lang=bn/);
  await expect(page.getByRole('heading',{name:'ড্যাশবোর্ড সারসংক্ষেপ'})).toBeVisible();
});
