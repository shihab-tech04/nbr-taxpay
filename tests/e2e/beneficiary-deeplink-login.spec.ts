import { expect, test } from '@playwright/test';

// The existing TaxPay modal is shared by header login and private-route entry.
test('Beneficiaries direct link restores approved User ID/password and resumes the list',async({page})=>{
  await page.goto('/?action=beneficiaries');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
  await expect(dialog.getByLabel('User ID',{exact:true})).toBeFocused();
  await expect(dialog.getByLabel('Password',{exact:true})).toBeVisible();
  await expect(dialog.getByLabel('Email address')).toHaveCount(0);
  await dialog.getByLabel('User ID',{exact:true}).fill('not-a-user');
  await dialog.getByLabel('Password',{exact:true}).fill('bad-password');
  await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Incorrect User ID or password');
  await dialog.getByLabel('User ID',{exact:true}).fill('user2');
  await dialog.getByLabel('Password',{exact:true}).fill('user2');
  await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/action=beneficiaries/);
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
});

test('Beneficiaries sign-in retains Bengali and closes to the public home',async({page})=>{
  await page.goto('/?action=beneficiaries&lang=bn');
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('ইউজার আইডি',{exact:true})).toBeVisible();
  await expect(dialog.getByLabel('পাসওয়ার্ড',{exact:true})).toBeVisible();
  await expect(page).toHaveURL(/lang=bn/);
  await dialog.getByRole('button',{name:'বন্ধ করুন'}).click();
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toHaveCount(0);
});

test('already signed-in Beneficiaries deep links never reopen login or workspace gate',async({page})=>{
  await page.goto('/?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await dialog.getByLabel('User ID',{exact:true}).fill('user1');
  await dialog.getByLabel('Password',{exact:true}).fill('user1');
  await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
  await page.goto('/?action=beneficiaries');
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
});

test('sample Beneficiaries keeps saved lists without an unsolicited email sign-in prompt',async({page})=>{
  await page.goto('/?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await dialog.getByLabel('User ID',{exact:true}).fill('user1');
  await dialog.getByLabel('Password',{exact:true}).fill('user1');
  await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
  await page.goto('/?action=beneficiaries');
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByTestId('beneficiaries-account-sync')).toHaveCount(0);
  await expect(page.getByText('For lists across devices, use your email account.')).toHaveCount(0);
  // The separate secure workspace and return destination still exist.
  await page.goto('/?action=secure_workspace&returnTo=beneficiaries');
  await expect(page).toHaveURL(/action=secure_workspace/);
  await expect(page).toHaveURL(/returnTo=beneficiaries/);
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
});
