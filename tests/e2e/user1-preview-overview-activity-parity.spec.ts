import {expect,test} from '@playwright/test';

/**
 * A production-style fictional user1 preview session uses the same immutable
 * scenario records as Activity. No localhost QA flag or source toggle is needed.
 * This fixture grants no Supabase Auth entitlement and makes no financial write.
 */
test('authorized user1 preview reconciles Overview with Activity without a source switch',async({page})=>{
  await page.addInitScript(()=>{
    sessionStorage.setItem('taxpay-taxpayer-preview-user','user1');
    sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({
      profileId:'user1',
      capability:'A'.repeat(43),
      paymentSessionId:'00000000-0000-4000-8000-000000000001',
      language:'en',
      selectedListId:null
    }));
  });
  await page.route('**/auth/v1/user',route=>route.fulfill({
    status:401,contentType:'application/json',body:'{"message":"No application Auth session"}'
  }));
  await page.goto('/?action=taxpayer_home');
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2025-2026');
  const overview=page.getByTestId('taxpayer-overview-bento');
  await expect(overview.getByTestId('dashboard-source-indicator')).toContainText('simulated');
  await expect(overview.locator('.taxpay-summary-metric--completed strong')).toHaveText('5');
  await expect(overview.locator('.taxpay-summary-metric--requests strong')).toHaveText('2');
  await expect(overview.getByTestId('dashboard-correction-request-list').getByRole('listitem')).toHaveCount(2);
  const chart=overview.getByTestId('dashboard-payment-analytics');
  await expect(chart).toHaveAttribute('data-chart-source','example');
  await expect(chart.getByTestId('dashboard-service-breakdown')).toContainText('113,500');
  await expect(chart).toContainText('Simulated Activity preview');
  await expect(chart.getByTestId('dashboard-chart-source')).toHaveCount(0);
  await expect(overview.getByRole('heading',{name:'My Tax Journey'})).toBeVisible();
  await expect(overview.locator('.taxpay-bento-recent')).toContainText('Tax with return — part 2');

  // The same year and source navigate to the original Activity transactions.
  await overview.locator('.taxpay-summary-metric--completed').click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByTestId('user1-synthetic-workspace')).toContainText('DEMO-PAY-01');
  await expect(page.getByTestId('user1-synthetic-workspace')).toContainText('DEMO-PAY-02');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2025-2026');

  // Changing the selected year updates the same preview projection and never
  // treats pending/failed/withheld transactions as completed payments.
  await page.goto('/?action=taxpayer_home&scenarioYear=2024-2025');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(page.getByTestId('taxpayer-overview-bento')
    .locator('.taxpay-summary-metric--completed strong')).toHaveText('3');
  await expect(page.getByTestId('taxpayer-overview-bento')
    .locator('.taxpay-summary-metric--requests strong')).toHaveText('0');
});
