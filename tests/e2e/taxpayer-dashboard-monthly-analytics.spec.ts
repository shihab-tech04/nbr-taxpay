import {expect,test} from '@playwright/test';

const demo='/?action=taxpayer_home&demoUser=user1';

test('Overview keeps compact metrics, saved drafts, corrections and interactive bento reports',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop bento acceptance');
  await page.setViewportSize({width:1600,height:900});
  await page.goto(demo);
  const dashboard=page.getByTestId('taxpayer-overview-bento');
  const metrics=dashboard.locator('.taxpay-bento-summary');
  const cases=dashboard.locator('#dashboard-correction-requests');
  await expect(metrics.getByRole('button')).toHaveCount(3);
  await expect(metrics.getByRole('button',{name:/Completed Payments/})).toContainText('5');
  await expect(metrics.getByRole('button',{name:/Correction Requests/})).toContainText('2');
  await expect(cases.getByTestId('dashboard-correction-request-list').locator('li')).toHaveCount(2);
  const charts=dashboard.getByTestId('dashboard-payment-analytics');
  await expect(charts.getByTestId('dashboard-service-breakdown')).toBeVisible();
  await expect(charts.getByTestId('dashboard-beneficiary-breakdown')).toBeVisible();
  await expect(charts.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'})).toHaveAttribute('aria-pressed','true');
  await expect(dashboard.getByTestId('dashboard-monthly-payments')).toHaveCount(0);
  const [metricBox,caseBox]=await Promise.all([metrics.boundingBox(),cases.boundingBox()]);
  expect(metricBox&&caseBox).toBeTruthy();
  expect(metricBox!.height,'summary remains content-sized').toBeLessThan(caseBox!.height);
  await metrics.getByRole('button',{name:/Correction Requests/}).click();
  await expect(cases).toBeFocused();
  await cases.getByRole('button',{name:/View request details for Refund inquiry/}).click();
  await expect(page.locator('.taxpay-modal')).toBeVisible();
});

test('Saved Drafts zero-state offers accessible feedback without losing the existing entry point',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Single zero-state check');
  await page.goto(demo);
  const metrics=page.getByTestId('taxpayer-overview-bento').locator('.taxpay-bento-summary');
  const drafts=metrics.getByRole('button',{name:/Saved Drafts/});
  const count=await drafts.innerText();
  await expect(drafts).toContainText(/0|—/);
  await drafts.click();
  await expect(metrics.getByRole('status')).toContainText(count.includes('0')?'No saved drafts yet':'Draft count unavailable');
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await drafts.click();
  await expect(metrics.getByRole('status')).toHaveCount(0);
});

test('changing assessment year updates the new chart totals without retaining the previous year',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Assessment-year source isolation');
  await page.goto(demo);
  const chart=page.getByTestId('dashboard-payment-analytics');
  await chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  await expect(chart.getByTestId('dashboard-service-breakdown')).toContainText('113,500');
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2024-2025');
  await expect(chart.getByTestId('dashboard-service-breakdown')).toContainText('90,000');
  await expect(chart.getByTestId('dashboard-service-breakdown')).not.toContainText('113,500');
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2023-2024');
  await expect(chart.getByTestId('dashboard-service-breakdown')).toContainText('60,000');
});

test('interactive chart cards, summary and corrections stay contained across responsive widths',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Single viewport sweep');
  test.setTimeout(90000);
  for(const width of [320,375,768,1024,1280,1600]){
    await page.setViewportSize({width,height:830});
    await page.goto(demo);
    const dashboard=page.getByTestId('taxpayer-overview-bento');
    const charts=dashboard.getByTestId('dashboard-payment-analytics');
    const metrics=dashboard.locator('.taxpay-bento-summary');
    await expect(charts.getByTestId('dashboard-service-breakdown')).toBeVisible();
    await expect(charts.getByTestId('dashboard-beneficiary-breakdown')).toBeVisible();
    await expect(metrics.getByRole('button')).toHaveCount(3);
    await expect(dashboard.locator('#dashboard-correction-requests')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),
      'horizontal overflow at '+width).toBeLessThanOrEqual(2);
    const body=await charts.boundingBox();
    expect(body,'charts exist at '+width).not.toBeNull();
    expect(body!.x+body!.width,'charts remain contained at '+width).toBeLessThanOrEqual(width+2);
  }
});

test('Bangla chart headings and source tabs remain accessible and interactive',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Single Bangla check');
  await page.goto(demo+'&lang=bn');
  const chart=page.getByTestId('dashboard-payment-analytics');
  await expect(chart.getByRole('heading',{name:'পেমেন্টের ধরন অনুযায়ী'})).toBeVisible();
  await expect(chart.getByRole('heading',{name:'উপকারভোগীর সম্পর্ক অনুযায়ী'})).toBeVisible();
  await chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'নমুনা'}).click();
  await expect(chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'নমুনা'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('taxpayer-overview-bento').locator('.taxpay-bento-summary').getByRole('button')).toHaveCount(3);
});

test('2025-2026 overview defaults to available example charts, never imaginary recorded allocations',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Dashboard screenshot source regression');
  await page.setViewportSize({width:1600,height:900});
  await page.goto(demo);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const overview=page.getByTestId('taxpayer-overview-bento');
  const analytics=overview.getByTestId('dashboard-payment-analytics');
  const sources=analytics.getByTestId('dashboard-chart-source');
  await expect(sources.getByRole('button',{name:'Examples'})).toHaveAttribute('aria-pressed','true');
  await expect(analytics.getByTestId('dashboard-service-breakdown')).toContainText('113,500');
  await expect(analytics.getByTestId('dashboard-beneficiary-breakdown')).toContainText('113,500');
  await expect(overview.getByTestId('dashboard-source-indicator')).toContainText('Example activity');
  await expect(analytics.getByTestId('dashboard-unclassified-recovery')).toContainText('Manage beneficiary tags');
  const unknown=analytics.getByTestId('dashboard-unclassified-recovery');
  await expect(unknown).toContainText('Why some spending is unclassified');
  await expect(unknown).toContainText('3 recipients without a matching saved relationship');
  await expect(unknown).toContainText('81,500');
  await expect(unknown).toContainText('2 payments without a recorded recipient');
  await expect(unknown).toContainText('32,000');
  await expect(overview.getByTestId('dashboard-correction-request-list')).not.toContainText('DEMO-REFUND-01');
  await expect(analytics).toContainText('Example payer spending for this year');
  await expect(overview.getByRole('button',{name:/Completed Payments/}).first()).toContainText('5');
  await sources.getByRole('button',{name:'Recorded'}).click();
  await expect(sources.getByRole('button',{name:'Recorded'})).toHaveAttribute('aria-pressed','true');
  await expect(analytics.getByTestId('dashboard-service-breakdown')).toContainText('No itemized recorded payments');
  await expect(analytics.getByTestId('dashboard-service-breakdown').locator('.taxpay-bento-analytics__total')).toHaveText('—');
  await expect(analytics.getByTestId('dashboard-beneficiary-breakdown').locator('.taxpay-bento-analytics__total')).toHaveText('—');
  await sources.getByRole('button',{name:'Examples'}).click();
  await expect(analytics.getByTestId('dashboard-service-breakdown')).toContainText('113,500');
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2024-2025');
  await expect(sources.getByRole('button',{name:'Examples'})).toHaveAttribute('aria-pressed','true');
  await expect(analytics.getByTestId('dashboard-service-breakdown')).toContainText('90,000');
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2026-2027');
  await expect(sources.getByRole('button',{name:'Recorded'})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
