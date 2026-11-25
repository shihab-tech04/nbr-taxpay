import { expect, test } from '@playwright/test';

const signIn = async (page: import('@playwright/test').Page, userId: string) => {
  await page.goto('/?action=taxpayer_login');
  const dialog = page.getByRole('dialog', { name: 'Sign In To Your Sohojkor Account' });
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
  // SQL service activity is not evidence of an issued challan or verified tax credit.
  await expect(panel.getByText('Based on recorded activity. Dues and tax credits are not verified.')).toBeVisible();
  await page.goto('/?action=account_profile');
  // A 13-digit fictional service reference is not an issued TIN. The same
  // approved User1 profile template must still render owner-specific metadata.
  const profile=page.getByTestId('user1-taxpayer-profile');
  await expect(page.getByRole('heading',{name:'Taxpayer profile'})).toBeVisible();
  await expect(profile).toContainText('Account: user6');
  await expect(profile.locator('[data-profile-field="tin"]')).toContainText('Not available');
  await expect(profile.getByRole('button',{name:'Copy TIN'})).toBeDisabled();
  await expect(profile.locator('[data-profile-field]')).toHaveCount(24);
  await expect(profile.getByTestId('profile-jurisdiction-card')).toBeVisible();
  await expect(profile).not.toContainText('6666666666666');
});

test('user8 begins with no saved activity or personal tax profile; user6 data stays isolated', async ({ page }) => {
  requireDisposableBackend();
  await signIn(page, 'user8');
  const panel = page.getByTestId('demo-sql-service-panel');
  await expect(panel).toHaveAttribute('data-scenario-user', 'user8');
  await expect(panel.getByText('No stored service activity is available for this account.')).toBeVisible();
  const register=panel.getByTestId('taxpay-service-record-register');
  await expect(register).toBeVisible();
  await expect(register.getByRole('searchbox',{name:'Search service records'})).toBeVisible();
  await expect(register.getByRole('combobox',{name:'Filter record status'})).toBeVisible();
  await expect(register.getByRole('combobox',{name:'Sort service records'})).toBeVisible();
  await expect(register.getByRole('table')).toHaveCount(1);
  await expect(register.getByRole('columnheader',{name:'Service',exact:true})).toBeVisible();
  await expect(register.getByRole('columnheader',{name:'Amount',exact:true})).toBeVisible();
  await expect(register.getByRole('table').locator('tbody tr')).toHaveCount(0);
  await expect(register.getByRole('button',{name:/^View record:/})).toHaveCount(0);
  for (const ref of ['SAMPLE-SRV-017','SAMPLE-SRV-023','SAMPLE-SRV-024','SAMPLE-SRV-025']) {
    await expect(panel.getByText(ref)).toHaveCount(0);
  }
  await expect(panel.getByText('Service records unavailable')).toHaveCount(0);
  await page.goto('/?action=account_profile');
  const profile=page.getByTestId('user1-taxpayer-profile');
  await expect(profile).toContainText('Account: user8');
  await expect(profile.locator('[data-profile-field="tin"]')).toContainText('Not available');
  await expect(profile.getByRole('button',{name:'Copy TIN'})).toBeDisabled();
  await expect(profile.locator('[data-profile-field]')).toHaveCount(24);
  await expect(profile.getByTestId('profile-personal-card')).toBeVisible();
  await expect(profile.getByText('Payment Exception 08')).toHaveCount(0);
  await expect(profile).not.toContainText('6666666666666');
});

test('user1 Activity keeps its approved transaction register without appended SQL sample panels', async ({ page }) => {
  requireDisposableBackend();
  await signIn(page, 'user1');
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
  // This local fixture was recorded for AY 2025–26. Select its year
  // explicitly instead of assuming the customer Overview's current-year default.
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  await page.getByRole('button',{name:'View all activity'}).click();
  const tabs = page.getByRole('navigation',{name:'Activity sections'});
  await expect(tabs.getByRole('button',{name:'Transactions'})).toHaveAttribute('aria-current','page');
  await expect(page.locator('.taxpayer-transaction-panel')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  const workspace=page.getByTestId('user1-synthetic-workspace');
  await expect(workspace.getByText(/DEMO-PAY-|DEMO-ETDS-|DEMO-REFUND-/)).toHaveCount(0);
  // A successful SQL read must either expose the recorded rows or the legitimate
  // empty state for this selected year, never fall back to bundled history.
  await expect.poll(async()=>await workspace.getByTestId('taxpayer-transaction-table').isVisible()||
    await workspace.getByText('No transactions yet.',{exact:true}).isVisible()||
    await workspace.getByRole('heading',{name:'No matching records'}).isVisible()).toBe(true);
  await expect(workspace.getByText('Recorded payments could not be verified.',{exact:true})).toHaveCount(0);
  await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
  await expect(page.getByTestId('recovered-story-payments')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Earlier saved payment records'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Tax service activity'})).toHaveCount(0);
  // The user6/user8 tests above continue covering the underlying SQL fixtures.
});
