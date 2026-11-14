import { expect, test } from '@playwright/test';

const site = '/nbr-taxpay/';
 
// CI validates the production bundle's auth/route boundaries, not CDN transfer.
// Keep public artwork off the real Taxpayer Storage service in repeatable tests;
// the application still uses its existing bundled fallback image on failure.
test.beforeEach(async ({ page }) => {
  await page.route(
    'https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**',
    route => route.abort('blockedbyclient'),
  );
});
const privateRoutes = ['taxpayer_home', 'dashboard', 'history', 'ledger', 'account_profile', 'account_notifications', 'account_settings', 'beneficiaries', 'services'];

test('the public TaxPay login restores the approved User ID/password modal', async ({ page }) => {
  await page.goto(site + '?action=taxpayer_login');
  const dialog = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('User ID',{exact:true})).toBeVisible();
  await expect(dialog.getByLabel('Password',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('textbox',{name:'Email address'})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Sign In',exact:true})).toBeDisabled();
  await dialog.getByLabel('User ID',{exact:true}).fill('invalid-user');
  await dialog.getByLabel('Password',{exact:true}).fill('invalid-password');
  await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Incorrect User ID or password');
});

test('query strings cannot sign in a taxpayer or reveal private Beneficiaries',async({page})=>{
  for(const route of privateRoutes){
    await page.goto(site+'?action='+route+'&demoUser=user1');
    if(route==='beneficiaries'){
      await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toBeVisible();
      await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
    }else{
      await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
    }
  }
  await page.evaluate(()=>history.replaceState({taxpayRoute:'taxpayer_home',taxpaySampleRole:'TAXPAYER_INDIVIDUAL'},'','?action=taxpayer_home'));
  await page.reload();
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
});

test('User ID login continues into the taxpayer workspace and survives refresh',async({page})=>{
  await page.goto(site+'?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await dialog.getByLabel('User ID',{exact:true}).fill('user1');
  await dialog.getByLabel('Password',{exact:true}).fill('user1');
  await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await page.goto(site+'?action=beneficiaries');
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
});

test('Bengali login retains its existing fields and language',async({page})=>{
  await page.goto(site+'?action=taxpayer_login&lang=bn');
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('ইউজার আইডি',{exact:true})).toBeVisible();
  await expect(dialog.getByLabel('পাসওয়ার্ড',{exact:true})).toBeVisible();
  await expect(page).toHaveURL(/lang=bn/);
});
