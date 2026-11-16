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

// The approved Overview intentionally omits the old service-register panel.
// Retain real disposable-SQL fixture coverage, without reviving a different
// dashboard structure for user6 and user8.
const sqlRows = async (page: import('@playwright/test').Page,
  table: 'sim_payment_users'|'sim_tax_service_records', userId: string) => {
  const endpoint = process.env.TAXPAY_LOCAL_SUPABASE_URL!;
  const key = process.env.TAXPAY_LOCAL_SUPABASE_ANON_KEY!;
  if (!key) throw Error('Local disposable SQL publishable key missing');
  const column = table === 'sim_payment_users' ? 'id' : 'user_id';
  const response = await page.request.get(
    endpoint + '/rest/v1/' + table + '?select=*&' + column + '=eq.' + userId,
    {headers:{apikey:key,authorization:'Bearer '+key}}
  );
  expect(response.ok(), 'The selected account SQL should be readable through its approved anon fixture policy').toBeTruthy();
  return await response.json() as Array<Record<string,unknown>>;
};

test('user6 keeps the approved dashboard and its SQL advance-tax records remain account-scoped', async ({ page }) => {
  requireDisposableBackend();
  await signIn(page, 'user6');
  await expect(page.getByTestId('dashboard-unified-preview')).toHaveAttribute('data-account-id','user6');
  await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
  await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
  const profile = await sqlRows(page,'sim_payment_users','user6');
  expect(profile).toHaveLength(1);
  expect(profile[0].name_en).toBe('Advance-tax Taxpayer 06');
  const records = await sqlRows(page,'sim_tax_service_records','user6');
  const ids = records.map(row=>row.record_id);
  expect(ids).toContain('SAMPLE-SRV-017');
  expect(ids).toContain('SAMPLE-SRV-018');
  expect(ids).not.toContain('SAMPLE-SRV-023');
  expect(records.every(row=>row.user_id==='user6' && row.simulation_only===true)).toBe(true);
  await page.goto('/?action=account_profile');
  await expect(page.getByText('666**********', { exact: true })).toBeVisible();
  await expect(page.getByText('6666666666666', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Advance tax and instalment review')).toBeVisible();
});

test('user8 keeps the same dashboard while its empty SQL records are isolated from user6', async ({ page }) => {
  requireDisposableBackend();
  await signIn(page, 'user8');
  await expect(page.getByTestId('dashboard-unified-preview')).toHaveAttribute('data-account-id','user8');
  await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
  await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
  expect(await sqlRows(page,'sim_tax_service_records','user8')).toHaveLength(0);
  for (const ref of ['SAMPLE-SRV-017','SAMPLE-SRV-023','SAMPLE-SRV-024','SAMPLE-SRV-025']) {
    await expect(page.getByText(ref)).toHaveCount(0);
  }
  await page.goto('/?action=account_profile');
  await expect(page.getByText('888**********', { exact: true })).toBeVisible();
  await expect(page.getByText('8888888888888', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Payment Exception 08')).toHaveCount(0);
  await expect(page.getByText('Account type')).toBeVisible();
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
  await expect(page.locator('.taxpayer-transaction-table tbody td:nth-child(4)').getByText('DEMO-PAY-02',{exact:true}).first()).toBeVisible();
  await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
  await expect(page.getByTestId('recovered-story-payments')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Earlier saved payment records'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Tax service activity'})).toHaveCount(0);
  // The user6/user8 tests above continue covering the underlying SQL fixtures.
});
