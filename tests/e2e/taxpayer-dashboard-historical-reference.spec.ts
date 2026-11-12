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
  const records=page.getByTestId('taxpayer-transaction-table');
  await expect(records).toBeVisible();
  await expect(records).toContainText('Advance income tax');
  await expect(records).not.toContainText('Tax with return — part 1');
});
