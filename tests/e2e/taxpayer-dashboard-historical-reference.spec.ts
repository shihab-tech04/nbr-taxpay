import {expect,test} from '@playwright/test';
const dashboard='/?action=taxpayer_home&demoUser=user1';

test('dashboard year selector changes the original recorded payment view, never inventing tax position',async({page})=>{
  await page.goto(dashboard);
  const year=page.getByRole('combobox',{name:'Assessment year'});
  await expect(year.locator('option[value="2026-2027"]')).toHaveCount(1);
  await year.selectOption('2024-2025');
  await expect(year).toHaveValue('2024-2025');
  await expect(page).toHaveURL(/scenarioYear=2024-2025/);
  await expect(page.getByRole('heading',{name:'How your tax is covered'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(0);
});

test('recent activity links to original transaction history without duplicate service panels',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  await expect(page.getByRole('heading',{name:'Recent activity'})).toBeVisible();
  await page.getByRole('button',{name:'View all activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Earlier saved payment records'})).toHaveCount(0);
});

test('service filter is keyboard accessible and updates selected beneficiary totals',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const sources=page.getByTestId('dashboard-chart-source');
  await sources.getByRole('button',{name:'Examples'}).click();
  const services=page.getByTestId('dashboard-service-breakdown');
  const advance=services.locator('[data-service="ait"]');
  await advance.focus();
  await page.keyboard.press('Space');
  await expect(advance).toHaveAttribute('aria-pressed','true');
  const beneficiary=page.getByTestId('dashboard-beneficiary-breakdown');
  await expect(beneficiary).toContainText('Advance Tax');
  await expect(beneficiary).toContainText('32,000');
  await services.getByRole('button',{name:'Show all payment services'}).click();
  await expect(beneficiary).toContainText('113,500');
});

test('year filtering cannot promote example liabilities to official credit',async({page})=>{
  await page.goto(dashboard);
  const analytics=page.getByTestId('dashboard-payment-analytics');
  await expect(analytics.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}))
    .toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('group',{name:'Coverage details'})).toHaveCount(0);
  await expect(page.getByRole('table',{name:'Posted credit components'})).toHaveCount(0);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2023-2024');
  await analytics.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  await expect(analytics.getByTestId('dashboard-beneficiary-breakdown')).toContainText('60,000');
});

test('interactive bento cards fit a 320px mobile viewport',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto(dashboard);
  await expect(page.getByTestId('dashboard-service-breakdown')).toBeVisible();
  await expect(page.getByTestId('dashboard-beneficiary-breakdown')).toBeVisible();
  await expect(page.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});


test('Overview summary and charts use the same year/source, and unknown beneficiary tags have recovery',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const chart=page.getByTestId('dashboard-payment-analytics');
  const source=chart.getByTestId('dashboard-chart-source');
  await source.getByRole('button',{name:'Examples'}).click();
  await expect(chart).toHaveAttribute('data-chart-source','example');
  const summary=page.locator('.taxpay-bento-summary');
  await expect(summary.getByTestId('dashboard-source-indicator')).toContainText('Example activity');
  await expect(summary.locator('.taxpay-summary-metric--completed strong')).toHaveText('5');
  await expect(summary.locator('.taxpay-summary-metric--requests strong')).toHaveText('2');
  await expect(chart.getByTestId('dashboard-service-breakdown')).toContainText('113,500');
  await expect(page.locator('.taxpay-bento-recent')).not.toContainText('Professional fee withholding');
  await expect(page.locator('.taxpay-bento-recent')).toContainText('Example');
  await expect(chart.getByTestId('dashboard-unclassified-recovery')).toContainText('Manage beneficiary tags');

  // Record-only mode never silently keeps example payment counts or requests.
  await source.getByRole('button',{name:'Recorded'}).click();
  await expect(chart).toHaveAttribute('data-chart-source','recorded');
  await expect(summary.locator('.taxpay-summary-metric--completed strong')).toHaveText('0');
  await expect(summary.locator('.taxpay-summary-metric--requests strong')).toHaveText('—');
  await expect(page.locator('.taxpay-bento-recent')).toContainText('No completed payment activity');
  await source.getByRole('button',{name:'Examples'}).click();
  await expect(summary.locator('.taxpay-summary-metric--completed strong')).toHaveText('5');

  // A source-aware drilldown must match the selected service, not all tax events.
  const advance=chart.getByTestId('dashboard-service-breakdown').locator('[data-service="ait"]');
  await advance.click();
  await chart.getByRole('button',{name:'View payment records'}).click();
  await expect(page).toHaveURL(/action=history/);
  const desktopRecords=page.getByTestId('taxpayer-transaction-table');
  const mobileRecords=page.getByTestId('taxpayer-transaction-mobile-cards');
  const records=await desktopRecords.isVisible()?desktopRecords:mobileRecords;
  await expect(records).toBeVisible();
  await expect(records).toContainText('Advance income tax');
  await expect(records).not.toContainText('Tax with return — part 1');
});

test('Top five ranked beneficiaries show actual recipients and link to filtered payment history',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const chart=page.getByTestId('dashboard-payment-analytics');
  await chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  const tabs=chart.getByTestId('dashboard-beneficiary-view');
  await tabs.getByRole('button',{name:'Top 5'}).click();
  await expect(tabs.getByRole('button',{name:'Top 5'})).toHaveAttribute('aria-pressed','true');
  const top=chart.getByTestId('dashboard-top-beneficiaries');
  await expect(top.locator('[data-rank]')).toHaveCount(3);
  await expect(top.locator('[data-rank="1"]')).toContainText('45,000');
  await expect(top.locator('[data-rank="2"]')).toContainText('30,000');
  await expect(top.locator('[data-rank="3"]')).toContainText('6,500');
  await expect(chart.getByTestId('dashboard-unranked-amount')).toContainText('32,000');
  await top.locator('[data-rank="1"]').click();
  await expect(page).toHaveURL(/action=history/);
  const desktop=page.getByTestId('taxpayer-transaction-table');
  const mobile=page.getByTestId('taxpayer-transaction-mobile-cards');
  const history=await desktop.isVisible()?desktop:mobile;
  await expect(history).toContainText('Tax with return — part 2');
  await expect(history).not.toContainText('Tax with return — part 1');
});

test('Top five honors service and relationship filters without inventing beneficiaries',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const chart=page.getByTestId('dashboard-payment-analytics');
  await chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  await chart.getByTestId('dashboard-beneficiary-view').getByRole('button',{name:'Top 5'}).click();
  await expect(chart.getByTestId('dashboard-top-beneficiaries').locator('[data-rank]')).toHaveCount(3);
  await chart.getByTestId('dashboard-service-breakdown').locator('[data-service="ait"]').click();
  await expect(chart.getByText('No identified beneficiaries match this selection.')).toBeVisible();
  await expect(chart.getByTestId('dashboard-unranked-amount')).toContainText('32,000');
  await chart.getByRole('button',{name:'Show all payment services'}).click();
  const relationship=chart.getByRole('combobox',{name:'Filter top beneficiaries by relationship'});
  await relationship.selectOption('family');
  await expect(chart.getByText('No identified beneficiaries match this selection.')).toBeVisible();
  await relationship.selectOption('all');
  await expect(chart.getByTestId('dashboard-top-beneficiaries').locator('[data-rank]')).toHaveCount(3);
  await chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'Recorded'}).click();
  await expect(chart.getByTestId('dashboard-top-beneficiaries')).toHaveCount(0);
  await chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  await expect(chart.getByTestId('dashboard-top-beneficiaries').locator('[data-rank]')).toHaveCount(3);
});

test('Top five chart stays accessible at 320px with Bengali labels',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto(dashboard+'&lang=bn');
  const chart=page.getByTestId('dashboard-payment-analytics');
  await chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'নমুনা'}).click();
  const tabs=chart.getByTestId('dashboard-beneficiary-view');
  await tabs.getByRole('button',{name:'শীর্ষ ৫'}).click();
  await expect(chart.getByRole('heading',{name:'শীর্ষ উপকারভোগী'})).toBeVisible();
  await expect(chart.getByTestId('dashboard-top-beneficiaries')).toBeVisible();
  await expect(chart.getByRole('combobox',{name:'সম্পর্ক অনুযায়ী শীর্ষ উপকারভোগী ফিল্টার'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
  await tabs.getByRole('button',{name:'সম্পর্ক'}).click();
  await expect(chart.getByRole('heading',{name:'উপকারভোগীর সম্পর্ক অনুযায়ী'})).toBeVisible();
});

test('returning from Top 5 clears the hidden relationship filter and restores the total',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const chart=page.getByTestId('dashboard-payment-analytics');
  await chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  const beneficiary=chart.getByTestId('dashboard-beneficiary-breakdown');
  const toggle=chart.getByTestId('dashboard-beneficiary-view');
  await toggle.getByRole('button',{name:'Top 5'}).click();
  await beneficiary.getByRole('combobox',{name:'Filter top beneficiaries by relationship'}).selectOption('family');
  await expect(beneficiary.locator('.taxpay-bento-analytics__total')).toHaveText('৳ 0');
  await expect(beneficiary.getByTestId('dashboard-reset-filters')).toBeVisible();
  await toggle.getByRole('button',{name:'Relationships'}).click();
  await expect(beneficiary.locator('.taxpay-bento-analytics__total')).toContainText('113,500');
  await expect(beneficiary.getByTestId('dashboard-reset-filters')).toHaveCount(0);
  await expect(beneficiary.getByRole('button',{name:/Unclassified/})).toContainText('113,500');
  await toggle.getByRole('button',{name:'Top 5'}).click();
  await expect(beneficiary.getByRole('combobox',{name:'Filter top beneficiaries by relationship'})).toHaveValue('all');
});
