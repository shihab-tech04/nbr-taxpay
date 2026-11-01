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
  await page.locator('.citizen-account-gate').getByRole('link', { name: 'Sign in with email' }).click();
  await expect(page).toHaveURL(/action=secure_workspace/);
  await expect(page).toHaveURL(/returnTo=taxpayer_home/);
  await expect(page.getByRole('heading', { name: 'Secure Korbritto workspace' })).toBeVisible();
  await page.goto(site + '?action=taxpayer_home');
  await page.locator('.citizen-account-gate').getByRole('button', { name: 'Use User ID (sample account)' }).click();
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await expect(page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore interactive dashboard' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'User ID' }).fill('not-a-user');
  await page.getByLabel('Password', { exact: true }).fill('not-a-user');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect User ID or password');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await page.goBack();
  await expect(gate).toBeVisible();
});

test('all private deep links fail closed without an authenticated session', async ({ page }) => {
  for (const action of privateRoutes) {
    await page.goto(site + '?action=' + action + '&demoUser=user1');
    if (action === 'beneficiaries') {
      await expect(page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' }), action).toBeVisible();
    }
    await expect(page.getByTestId('beneficiaries-page'), action).toHaveCount(0);
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
  await page.locator('.citizen-account-gate').getByRole('link', { name: 'ইমেইলে সাইন ইন' }).click();
  await expect(page).toHaveURL(/action=secure_workspace/);
  await expect(page).toHaveURL(/returnTo=taxpayer_home/);
  await expect(page).toHaveURL(/lang=bn/);
  await expect(page.getByRole('heading', { name: 'নিরাপদ করবৃত্ত ওয়ার্কস্পেস' })).toBeVisible();
  await expect(page.getByText('৳ 180,000')).toHaveCount(0);
});

test('sample-account Beneficiaries retains the approved left sidebar and content area',async({page})=>{
  await page.setViewportSize({width:1600,height:900});
  await page.goto(site+'?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user1');
  await page.getByLabel('Password',{exact:true}).fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await expect(rail).toBeVisible();
  await rail.getByRole('button',{name:'Beneficiaries',exact:true}).click();
  await expect(page).toHaveURL(/action=beneficiaries/);
  await expect(rail.getByRole('button',{name:'Beneficiaries',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('heading',{name:'Beneficiaries',exact:true})).toBeVisible();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.locator('.citizen-header')).toBeHidden();
  const left=await page.locator('main').evaluate(element=>Math.round(element.getBoundingClientRect().left));
  expect(left).toBe(250);
  await page.reload();
  await expect(rail).toBeVisible();
  await expect(page.getByRole('heading',{name:'Beneficiaries',exact:true})).toBeVisible();
});

test('Beneficiaries deep link opens one login, then returns directly after User ID sign-in',async({page})=>{
  await page.goto(site+'?action=beneficiaries');
  const login=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await expect(login).toBeVisible();
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
  await expect(login.getByRole('button',{name:'Sign in with email instead'})).toBeVisible();
  await login.getByRole('textbox',{name:'User ID'}).fill('user1');
  await login.getByLabel('Password',{exact:true}).fill('wrong');
  await login.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(login.getByRole('alert')).toContainText('Incorrect User ID or password');
  await login.getByLabel('Password',{exact:true}).fill('user1');
  await login.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/action=beneficiaries/);
  await expect(login).toHaveCount(0);
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'})).toHaveCount(0);
});

test('Bengali Beneficiaries email sign-in preserves the destination and language',async({page})=>{
  await page.goto(site+'?action=beneficiaries&lang=bn');
  const login=page.getByRole('dialog',{name:/করবৃত্ত/});
  await expect(login).toBeVisible();
  await login.getByRole('button',{name:'ইমেইল দিয়ে সাইন ইন করুন'}).click();
  await expect(page).toHaveURL(/action=secure_workspace/);
  await expect(page).toHaveURL(/returnTo=beneficiaries/);
  await expect(page).toHaveURL(/lang=bn/);
  await expect(login).toHaveCount(0);
  await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
});
