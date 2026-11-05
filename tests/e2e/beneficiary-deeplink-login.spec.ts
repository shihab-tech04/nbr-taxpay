import { expect, test } from '@playwright/test';

// The only signed-out entry for a private Beneficiaries URL is the approved
// TaxPay login modal. No second private-workspace gate may appear behind it.
test('Beneficiaries direct link requires a verified email identity and keeps the private list hidden',async({page})=>{
  await page.goto('/?action=beneficiaries');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
  const email=dialog.getByLabel('Email address',{exact:true});
  await expect(email).toBeFocused();
  await expect(dialog.getByLabel('User ID',{exact:true})).toHaveCount(0);
  await email.fill('not-an-email');
  await expect(dialog.getByRole('button',{name:'Sign In',exact:true})).toBeDisabled();
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
});

test('Beneficiaries private sign-in retains Bengali and closes cleanly',async({page})=>{
  await page.goto('/?action=beneficiaries&lang=bn');
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('ইমেইল ঠিকানা',{exact:true})).toBeVisible();
  await expect(page).toHaveURL(/lang=bn/);
  await dialog.getByRole('button',{name:'Close modal'}).click();
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
