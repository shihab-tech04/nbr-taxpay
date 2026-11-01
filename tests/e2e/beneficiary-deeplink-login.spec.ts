import { expect, test } from '@playwright/test';

// The only signed-out entry for a private Beneficiaries URL is the approved
// TaxPay login modal. No second private-workspace gate may appear behind it.
test('Beneficiaries deep link opens one login modal, validates, resumes and survives refresh',async({page})=>{
  await page.goto('/?action=beneficiaries');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Use User ID (sample account)'})).toHaveCount(0);
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Sign in with email'})).toBeVisible();
  await expect(dialog.getByLabel('User ID',{exact:true})).toBeFocused();

  await dialog.getByLabel('User ID',{exact:true}).fill('invalid-user');
  await dialog.getByLabel('Password',{exact:true}).fill('invalid-pass');
  await dialog.getByRole('button',{name:'Sign In'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Incorrect User ID or password');
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await dialog.getByLabel('User ID',{exact:true}).fill('user2');
  await dialog.getByLabel('Password',{exact:true}).fill('user2');
  await dialog.getByRole('button',{name:'Sign In'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/action=beneficiaries/);
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
});

test('Beneficiaries signed-out modal closes to public home, email retains safe destination',async({page})=>{
  await page.goto('/?action=beneficiaries&lang=bn');
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'ইমেইল দিয়ে সাইন ইন'})).toBeVisible();
  await dialog.getByRole('button',{name:'ইমেইল দিয়ে সাইন ইন'}).click();
  await expect(page).toHaveURL(/action=secure_workspace/);
  await expect(page).toHaveURL(/returnTo=beneficiaries/);
  await expect(page).toHaveURL(/lang=bn/);
  await page.goto('/?action=beneficiaries');
  await page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'}).getByRole('button',{name:'Close modal'}).click();
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toHaveCount(0);
});

test('already signed-in Beneficiaries deep links never reopen login or workspace gate',async({page})=>{
  await page.goto('/?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await dialog.getByLabel('User ID',{exact:true}).fill('user1');
  await dialog.getByLabel('Password',{exact:true}).fill('user1');
  await dialog.getByRole('button',{name:'Sign In'}).click();
  await page.goto('/?action=beneficiaries');
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
});
