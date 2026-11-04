import { expect, test } from '@playwright/test';

const signIn = async (page: import('@playwright/test').Page, userId: string) => {
  await page.goto('/?action=taxpayer_login');
  const dialog = page.getByRole('dialog', { name: 'Sign In To Your Korbritto Account' });
  await dialog.getByRole('textbox', { name: 'User ID' }).fill(userId);
  await dialog.getByLabel('Password', { exact: true }).fill(userId);
  await dialog.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
};

const requireDisposableBackend = () => {
  const api = process.env.TAXPAY_LOCAL_SUPABASE_URL;
  if (!api || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api)) {
    throw Error('A disposable local Supabase project is required');
  }
};

test('user6 sees stored advance-tax installments and matching SQL profile', async ({ page }) => {
  requireDisposableBackend();
  await signIn(page, 'user6');
  const panel = page.getByTestId('demo-sql-service-panel');
  await expect(panel).toHaveAttribute('data-scenario-user', 'user6');
  await expect(panel.getByText('Advance-tax Taxpayer 06')).toBeVisible();
  await expect(panel.getByRole('table').getByText('SAMPLE-SRV-017')).toBeVisible();
  await expect(panel.getByRole('table').getByText('SAMPLE-SRV-018')).toBeVisible();
  await expect(panel.getByText('SAMPLE-SRV-023')).toHaveCount(0);
  await expect(panel.getByText('Service records unavailable')).toHaveCount(0);
  await expect(page.getByText('Government challan: Not available')).toBeVisible();
  await page.goto('/?action=account_profile');
  await expect(page.getByText('6666666666666', { exact: true })).toBeVisible();
  await expect(page.getByText('Advance tax and instalment review')).toBeVisible();
});

test('user8 begins with no saved activity or personal tax profile; user6 data stays isolated', async ({ page }) => {
  requireDisposableBackend();
  await signIn(page, 'user8');
  const panel = page.getByTestId('demo-sql-service-panel');
  await expect(panel).toHaveAttribute('data-scenario-user', 'user8');
  await expect(panel.getByText('No stored service activity is available for this account.')).toBeVisible();
  await expect(panel.getByRole('table')).toHaveCount(0);
  for (const ref of ['SAMPLE-SRV-017','SAMPLE-SRV-023','SAMPLE-SRV-024','SAMPLE-SRV-025']) {
    await expect(panel.getByText(ref)).toHaveCount(0);
  }
  await expect(panel.getByText('Service records unavailable')).toHaveCount(0);
  await page.goto('/?action=account_profile');
  await expect(page.getByText('8888888888888', { exact: true })).toBeVisible();
  await expect(page.getByText('Payment Exception 08')).toHaveCount(0);
  await expect(page.getByText('Account type')).toBeVisible();
});

test('user1 retains existing scenario plus its separate stored travel-tax example', async ({ page }) => {
  requireDisposableBackend();
  await signIn(page, 'user1');
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  // SQL-backed service records remain accessible on Dashboard, not inserted
  // into Transactions or the payment-reference lookup.
  const panel = page.getByTestId('demo-sql-service-panel');
  await expect(panel).toHaveAttribute('data-scenario-user', 'user1');
  const register = panel.getByTestId('taxpay-service-record-register');
  await expect(register.getByRole('table').getByText('SAMPLE-SRV-003')).toBeVisible();
  await expect(panel.getByText('SAMPLE-SRV-023')).toHaveCount(0);

  const search = register.getByRole('searchbox',{name:'Search service records'});
  await search.fill('SAMPLE-SRV-003');
  await expect(register.getByRole('table').getByText('SAMPLE-SRV-003')).toBeVisible();
  await search.fill('not-an-existing-reference');
  await expect(register.getByText('No service records match your search and filters.')).toBeVisible();
  await register.getByRole('button',{name:'Clear filters'}).click();
  await register.getByRole('combobox',{name:'Sort service records'}).selectOption('oldest');
  await expect(register.getByRole('table').getByText('SAMPLE-SRV-003')).toBeVisible();
  await register.getByRole('combobox',{name:'Filter record status'}).selectOption('SIMULATED');
  await expect(register.getByRole('table').getByText('SAMPLE-SRV-003')).toBeVisible();
  await register.getByRole('button',{name:'Clear filters'}).click();

  await page.getByRole('button',{name:'Open transaction history'}).click();
  await expect(page.locator('.taxpayer-transaction-panel')).toBeVisible();
  await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
});
