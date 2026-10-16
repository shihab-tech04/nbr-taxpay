import { expect, test } from '@playwright/test';

const signIn = async (page: import('@playwright/test').Page, userId: string) => {
  await page.goto('/?action=taxpayer_login');
  const dialog = page.getByRole('dialog', { name: 'Sign In To Your Amar Kor Account' });
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
  await expect(page.getByText('DEMO-TIN-006', { exact: true })).toBeVisible();
  await expect(page.getByText('Advance-tax instalments')).toBeVisible();
});

test('user8 sees failed, pending, and reversed SQL examples but no user6 entries', async ({ page }) => {
  requireDisposableBackend();
  await signIn(page, 'user8');
  const panel = page.getByTestId('demo-sql-service-panel');
  await expect(panel).toHaveAttribute('data-scenario-user', 'user8');
  await expect(panel.getByRole('table').getByText('SAMPLE-SRV-023')).toBeVisible();
  await expect(panel.getByRole('table').getByText('SAMPLE-SRV-024')).toBeVisible();
  await expect(panel.getByRole('table').getByText('SAMPLE-SRV-025')).toBeVisible();
  await expect(panel.getByText('SAMPLE-SRV-017')).toHaveCount(0);
  await expect(panel.getByText('Failed', { exact: true }).first()).toBeVisible();
  await expect(panel.getByText('Reversed', { exact: true }).first()).toBeVisible();
});

test('user1 retains existing scenario plus its separate stored travel-tax example', async ({ page }) => {
  requireDisposableBackend();
  await signIn(page, 'user1');
  const panel = page.getByTestId('demo-sql-service-panel');
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  await expect(panel).toHaveAttribute('data-scenario-user', 'user1');
  await expect(panel.getByRole('table').getByText('SAMPLE-SRV-003')).toBeVisible();
  await expect(panel.getByText('SAMPLE-SRV-023')).toHaveCount(0);
});
