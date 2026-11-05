import { expect, test } from '@playwright/test';

const site = '/nbr-taxpay/';
const privateRoutes = ['taxpayer_home', 'dashboard', 'history', 'ledger', 'account_profile', 'account_notifications', 'account_settings', 'beneficiaries', 'services'];

test('a fresh visitor cannot enter taxpayer screens using an old sample URL', async ({ page }) => {
  await page.goto(site + '?action=taxpayer_home&demoUser=user1');
  const gate = page.getByRole('heading', { name: 'Private taxpayer workspace' });
  await expect(gate).toBeVisible();
  await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Explore interactive dashboard' })).toHaveCount(0);
  await page.locator('.citizen-account-gate').getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/action=taxpayer_login/);
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeVisible();
  await expect(dialog.getByLabel('Password',{exact:true})).toHaveAttribute('type','password');
  await expect(dialog.getByRole('textbox',{name:'Email address'})).toHaveCount(0);
  await dialog.getByRole('textbox',{name:'User ID'}).fill('not-a-user');
  await dialog.getByLabel('Password',{exact:true}).fill('not-a-user');
  await dialog.getByRole('button',{name:'Sign In'}).click();
  await expect(dialog.getByRole('alert')).toContainText('Incorrect User ID or password');

});

test('all private deep links fail closed without an authenticated session', async ({ page }) => {
  for (const action of privateRoutes) {
    await page.goto(site + '?action=' + action + '&demoUser=user1');
    if(action==='beneficiaries'){
      // Private Beneficiaries use the approved login modal, not the generic gate.
      await expect(page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toHaveCount(0);
      await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
    }else{
      await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' }), action).toBeVisible();
    }
    await expect(page.getByTestId('user1-synthetic-workspace'), action).toHaveCount(0);
  }
  // An attacker-supplied browser-history role is not an authentication event.
  await page.evaluate(() => {
    history.replaceState({ taxpayRoute: 'taxpayer_home', taxpaySampleRole: 'TAXPAYER_INDIVIDUAL' }, '', '?action=taxpayer_home');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toBeVisible();
});

test('Bengali sign-in entry keeps the selected language without sample financial data', async ({ page }) => {
  await page.goto(site + '?action=taxpayer_home&demoUser=user1&lang=bn');
  await expect(page.getByRole('heading', { name: 'করদাতার ব্যক্তিগত তথ্য' })).toBeVisible();
  await page.locator('.citizen-account-gate').getByRole('button',{name:'সাইন ইন'}).click();
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await expect(page).toHaveURL(/lang=bn/);
  await expect(page.getByRole('dialog',{name:'আপনার করবৃত্ত অ্যাকাউন্টে সাইন ইন করুন'}).getByRole('textbox',{name:'ইউজার আইডি'})).toBeVisible();
  await expect(page.getByText('৳ 180,000')).toHaveCount(0);

});

test('published login requires a backed account and never restores a local preview session',async({page})=>{
  await page.goto(site+'?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await expect(dialog.getByRole('textbox',{name:'User ID'})).toBeVisible();
  await expect(dialog.getByLabel('Password',{exact:true})).toBeVisible();
  await page.evaluate(()=>sessionStorage.setItem('taxpay-taxpayer-preview-user','user1'));
  await page.goto(site+'?action=beneficiaries');
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'}).getByRole('textbox',{name:'User ID'})).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
});
