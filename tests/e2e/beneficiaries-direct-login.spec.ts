import {expect,test} from '@playwright/test';

test('signed-out Beneficiaries deep link opens approved login, rejects invalid ID, and resumes saved lists',async({page})=>{
  await page.goto('/?action=beneficiaries');
  const login=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await expect(login).toBeVisible();
  await expect(login.locator('.taxpay-modal__footer').getByRole('button',{name:'Sign In'})).toBeDisabled();
  await expect(page.locator('.citizen-account-gate')).toHaveCount(0);
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toHaveCount(1);
  await login.getByRole('textbox',{name:'User ID'}).fill('user2');
  await login.getByLabel('Password',{exact:true}).fill('incorrect');
  await login.getByRole('button',{name:'Sign In'}).click();
  await expect(login.getByRole('alert')).toContainText('Incorrect User ID or password');
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await login.getByLabel('Password',{exact:true}).fill('user2');
  await login.getByRole('button',{name:'Sign In'}).click();
  await expect(page).toHaveURL(/action=beneficiaries/);
  await expect(login).toHaveCount(0);
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Beneficiaries',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.locator('.citizen-account-gate')).toHaveCount(0);
});

test('Bengali direct link preserves language, email return, modal close and accessible mobile fit',async({page})=>{
  await page.goto('/?action=beneficiaries&lang=bn');
  const login=page.getByRole('dialog',{name:/করবৃত্ত/});
  await expect(login).toBeVisible();
  await expect(login.getByRole('button',{name:'ইমেইল দিয়ে সাইন ইন করুন'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await login.getByRole('button',{name:'ইমেইল দিয়ে সাইন ইন করুন'}).click();
  await expect(login).toHaveCount(0);
  await expect(page).toHaveURL(/action=secure_workspace/);
  await expect(page).toHaveURL(/returnTo=beneficiaries/);
  await expect(page).toHaveURL(/lang=bn/);

  await page.goto('/?action=beneficiaries&lang=bn');
  const nextLogin=page.getByRole('dialog',{name:/করবৃত্ত/});
  await expect(nextLogin).toBeVisible();
  await nextLogin.locator('.taxpay-modal__close').click();
  await expect(page).toHaveURL(/action=landing/);
  await expect(nextLogin).toHaveCount(0);
});
