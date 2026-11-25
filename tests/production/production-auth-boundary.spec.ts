import { expect, test } from '@playwright/test';

// CI route/auth checks must not download large live CMS artworks; app fallback stays intact.
test.beforeEach(async ({ page }) => {
  await page.route(
    'https://eyqhoavnitkrajvyqvxn.supabase.co/storage/v1/object/public/**',
    route => route.abort('blockedbyclient'),
  );
});

const site = '/nbr-taxpay/';
const privateRoutes = ['taxpayer_home', 'dashboard', 'history', 'ledger', 'account_profile', 'account_notifications', 'account_settings', 'beneficiaries', 'services'];

test('the public TaxPay login restores the approved User ID/password modal', async ({ page }) => {
  await page.goto(site + '?action=taxpayer_login');
  const dialog = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
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
    await expect(page.locator('#public-home-title')).toBeVisible();
    await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
    await expect(page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'})).toBeVisible();
    await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
    await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
  }
  await page.evaluate(()=>history.replaceState({taxpayRoute:'taxpayer_home',taxpaySampleRole:'TAXPAYER_INDIVIDUAL'},'','?action=taxpayer_home'));
  await page.reload();
  await expect(page.locator('#public-home-title')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'})).toBeVisible();
});

test('User ID login continues into the taxpayer workspace and survives refresh',async({page})=>{
  await page.goto(site+'?action=taxpayer_login');
  const dialog=page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'});
  await dialog.getByLabel('User ID',{exact:true}).fill('user1');
  await dialog.getByLabel('Password',{exact:true}).fill('user1');
  await dialog.getByRole('button',{name:'Sign In',exact:true}).click();
  const demoOtp=dialog.getByTestId('demo-otp-input');
  await expect(demoOtp).toBeVisible();
  await demoOtp.fill('111111');
  await dialog.getByTestId('taxpayer-login-submit').click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  // Confirm the approved private dashboard heading in the account's saved EN/BN language.
  await expect(page.locator('.taxpayer-dashboard-header').getByRole('heading',{
    name:/^(?:Overview|Your tax overview|সংক্ষিপ্ত বিবরণ|আপনার করের সারসংক্ষেপ)$/
  })).toBeVisible();
  await page.goto(site+'?action=beneficiaries');
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Sign In To Your Sohojkor Account'})).toHaveCount(0);
  // Wait for the actual saved-list readback, then enforce the approved cap.
  // Below-cap dialog coverage is also exercised by disposable owner tests.
  const capacity=page.getByTestId('beneficiary-group-capacity');
  await expect(capacity).toBeVisible();
  const capacityText=(await capacity.innerText()).replace(/[০-৯]/g,d=>String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const count=capacityText.match(/^(\d+)\/5(?:\s|$)/);
  expect(count,'Loaded group count must be present').not.toBeNull();
  const createButton=page.getByRole('button',{name:/^(?:Create list|তালিকা তৈরি)$/});
  const createList=page.getByRole('dialog',{name:/^(?:Create list|তালিকা তৈরি)$/});
  if(Number(count![1])>=5){
    await expect(createButton).toBeDisabled();
    await expect(capacity).toContainText(/Maximum five saved groups|সর্বোচ্চ পাঁচটি সংরক্ষিত গ্রুপ/);
    await expect(createList).toHaveCount(0);
  }else{
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await expect(createList).toBeVisible();
    await createList.getByRole('button',{name:/^(?:Cancel|বাতিল)$/}).click();
    await expect(createList).toHaveCount(0);
  }
  await page.getByRole('button',{name:/^(?:Add beneficiary|উপকারভোগী যোগ)$/}).click();
  const beneficiaryEntry=page.getByRole('dialog',{name:/^(?:Beneficiary entry|উপকারভোগী যোগ)$/});
  await expect(beneficiaryEntry).toBeVisible();
  await beneficiaryEntry.getByRole('button',{name:/^(?:Cancel|বাতিল)$/}).click();
  await expect(beneficiaryEntry).toHaveCount(0);
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
