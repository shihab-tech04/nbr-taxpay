import { expect, test } from '@playwright/test';

const site = '/nbr-taxpay/';
const privateRoutes = ['taxpayer_home', 'dashboard', 'wizard', 'history', 'payment_details', 'ledger', 'journey',
  'certificates', 'corrections', 'notifications', 'account_profile', 'account_notifications', 'account_settings', 'services'];

test('a fresh visitor cannot enter taxpayer screens using an old sample URL', async ({ page }) => {
  await page.goto(site + '?action=taxpayer_home&demoUser=user1');
  const gate = page.getByRole('heading', { name: 'Private taxpayer workspace' });
  await expect(gate).toBeVisible();
  await expect(page.getByTestId('user1-synthetic-workspace')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Explore interactive dashboard' })).toHaveCount(0);
  await page.locator('.citizen-account-gate').getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText(/Example account access: user1/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Explore interactive dashboard' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Account email address' }).fill('user1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter your account email address');
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await page.goBack();
  await expect(gate).toBeVisible();
});

test('all private deep links fail closed without an authenticated session', async ({ page }) => {
  for (const action of privateRoutes) {
    await page.goto(site + '?action=' + action + '&demoUser=user1');
    await expect(page.getByRole('heading', { name: 'Private taxpayer workspace' }), action).toBeVisible();
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
  await page.locator('.citizen-account-gate').getByRole('button', { name: 'সাইন ইন' }).click();
  await expect(page).toHaveURL(/action=taxpayer_login/);
  await expect(page).toHaveURL(/lang=bn/);
  await expect(page.getByRole('heading', { name: 'স্বাগতম' })).toBeVisible();
  await expect(page.getByText('৳ 180,000')).toHaveCount(0);
});

test('legacy Office Management routes and the old Office login action cannot enter TaxPay screens', async ({page}) => {
  for (const action of ['office_login','officer_home','taxpayer_360','payment_search','correction_queue',
    'case_management','incident_investigation','offline_evidence','audit_trail','intelligence','monitoring']) {
    await page.goto(site + '?action=' + action + '&demoUser=user1');
    await expect(page).toHaveURL(/action=landing/);
    await expect(page.getByRole('heading', {name:'Understand tax payments. Stay in control.'})).toBeVisible();
    await expect(page.locator('.office-auth')).toHaveCount(0);
    await expect(page.getByRole('heading', {name:/Universal Cross-Treasury Payment Search/})).toHaveCount(0);
  }
});

test('published receipt and travel links use official services without synthetic records or passport collection', async ({page}) => {
  await page.goto(site + '?action=verify');
  const challan = page.getByRole('link', {name:'Open iBAS++ challan services'});
  await expect(challan).toHaveAttribute('href', 'https://ibas.finance.gov.bd/portal/eservices');
  await expect(page.getByRole('textbox', {name:/Challan, token or transaction reference/})).toHaveCount(0);
  await expect(page.getByText(/AC-2025-09-DEMO-REF/)).toHaveCount(0);
  await page.goto(site + '?action=travel');
  const travelTax = page.getByRole('link', {name:'Open Sonali Bank Travel Tax'});
  await expect(travelTax).toHaveAttribute('href', 'https://billpay.sonalibank.com.bd/nbrTravelTax/Collection/Create');
  await expect(page.getByLabel(/Passport number/)).toHaveCount(0);
  await expect(page.getByText(/Sample rate|Illustrative total|Sample reference/)).toHaveCount(0);
});
