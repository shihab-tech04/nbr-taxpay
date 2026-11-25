import {expect,test} from '@playwright/test';
const dashboard='/?action=taxpayer_home&demoUser=user1&qaScenario=1';

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
  await expect(page.getByRole('heading',{name:'My Tax Journey'})).toBeVisible();
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
  await page.getByTestId('dashboard-payment-extra').locator('summary').click();
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
  await page.getByTestId('dashboard-payment-extra').locator('summary').click();
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
  await chart.getByTestId('dashboard-payment-extra').locator('summary').click();
  const advance=chart.getByTestId('dashboard-service-breakdown').locator('[data-service="ait"]');
  await advance.click();
  await chart.locator('.taxpay-recipient-extra > summary').click();
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
  await chart.locator('.taxpay-recipient-extra > summary').click();
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
  await chart.locator('.taxpay-recipient-extra > summary').click();
  await chart.getByTestId('dashboard-beneficiary-view').getByRole('button',{name:'Top 5'}).click();
  await expect(chart.getByTestId('dashboard-top-beneficiaries').locator('[data-rank]')).toHaveCount(3);
  await chart.getByTestId('dashboard-payment-extra').locator('summary').click();
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
  await chart.locator('.taxpay-recipient-extra > summary').click();
  const tabs=chart.getByTestId('dashboard-beneficiary-view');
  await tabs.getByRole('button',{name:'শীর্ষ ৫'}).click();
  await expect(chart.getByRole('heading',{name:'শীর্ষ উপকারভোগী'})).toBeVisible();
  await expect(chart.getByTestId('dashboard-top-beneficiaries')).toBeVisible();
  await expect(chart.getByRole('combobox',{name:'সম্পর্ক অনুযায়ী শীর্ষ উপকারভোগী ফিল্টার'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
  await tabs.getByRole('button',{name:'সম্পর্ক'}).click();
  await expect(chart.getByRole('heading',{name:'পেমেন্টের সম্পর্ক'})).toBeVisible();
});

test('returning from Top 5 clears the hidden relationship filter and restores the total',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const chart=page.getByTestId('dashboard-payment-analytics');
  await chart.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  const beneficiary=chart.getByTestId('dashboard-beneficiary-breakdown');
  await chart.locator('.taxpay-recipient-extra > summary').click();
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

test('authorized User1 with empty SQL reads never displays hardcoded payments or totals',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Scoped SQL-only account acceptance');
  await page.addInitScript(()=>{
    sessionStorage.setItem('taxpay-taxpayer-preview-user','user1');
    sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({
      profileId:'user1',capability:'A'.repeat(43),paymentSessionId:'00000000-0000-4000-8000-000000000001',
      language:'en',selectedListId:null
    }));
  });
  await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.route(url=>url.pathname==='/functions/v1/demo-story1-taxpay/payments',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,simulationOnly:true,data:{items:[],total:0}})}));
  await page.goto('/?action=taxpayer_home');
  await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2026-2027');
  const overview=page.getByTestId('taxpayer-overview-bento');
  await expect(overview.getByTestId('dashboard-source-indicator')).toContainText('Payments linked to this session');
  await expect(overview.getByTestId('dashboard-payment-analytics')).toHaveAttribute('data-chart-source','recorded');
  await expect(overview.getByTestId('dashboard-chart-source')).toHaveCount(0);
  await expect(overview).not.toContainText('113,500');
  await expect(overview).not.toContainText('Tax with return — part 2');
  await page.goto('/?action=history');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('all');
  await expect(page.getByText('No transactions yet.',{exact:true})).toBeVisible();
  await expect(page.getByTestId('user1-synthetic-workspace')).not.toContainText('DEMO-PAY-');
});

test('populated Overview uses full-width balanced KPIs and readable charts across screen widths',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Single targeted responsive visual acceptance');
  test.setTimeout(90_000);
  for(const width of [375,768,1024,1600]){
    await page.setViewportSize({width,height:850});
    await page.goto('/?action=taxpayer_home&demoUser=user1&qaScenario=1&scenarioYear=2025-2026');
    const grid=page.getByTestId('taxpayer-overview-bento');
    const summary=grid.locator('.taxpay-bento-summary');
    const [gridBox,summaryBox]=await Promise.all([grid.boundingBox(),summary.boundingBox()]);
    expect(gridBox&&summaryBox,'summary and grid exist at '+width).toBeTruthy();
    expect(Math.abs(summaryBox!.width-gridBox!.width),'populated KPI summary spans entire dashboard at '+width).toBeLessThan(5);
    const cards=summary.locator('.taxpay-summary-metric');
    await expect(cards).toHaveCount(3);
    const boxes=await Promise.all([0,1,2].map(n=>cards.nth(n).boundingBox()));
    expect(boxes.every(Boolean)).toBeTruthy();
    if(width>=900){
      expect(boxes[1]!.y,'second KPI stacks beneath first beside the summary').toBeGreaterThan(boxes[0]!.y);
      expect(boxes[2]!.y,'third KPI stacks beneath second beside the summary').toBeGreaterThan(boxes[1]!.y);
      expect(Math.abs(boxes[0]!.width-boxes[2]!.width),'balanced stacked KPI widths').toBeLessThan(3);
    }else if(width>=600){
      expect(Math.abs(boxes[0]!.y-boxes[2]!.y),'three tablet KPI cards share a row').toBeLessThan(3);
    }else{
      expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
      expect(boxes[2]!.y).toBeGreaterThan(boxes[1]!.y);
    }
    const firstBorder=await cards.first().evaluate(el=>({
      width:getComputedStyle(el).borderLeftWidth,
      labelSize:getComputedStyle(el.querySelector('.taxpay-summary-metric__label')!).fontSize
    }));
    expect(firstBorder.width,'no legacy red 3px first-child border').toBe('1px');
    expect(Number.parseFloat(firstBorder.labelSize)).toBeGreaterThanOrEqual(14);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),
      'no horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home&demoUser=user1&qaScenario=1&scenarioYear=2025-2026');
  const grid=page.getByTestId('taxpayer-overview-bento');
  const analytics=grid.getByTestId('dashboard-payment-analytics');
  await expect(grid.locator('.taxpay-summary-metric--completed strong')).toHaveText('5');
  await expect(grid.locator('.taxpay-summary-metric--requests strong')).toHaveText('2');
  await expect(analytics.getByTestId('dashboard-service-breakdown')).toContainText('113,500');
  const beneficiary=analytics.getByTestId('dashboard-beneficiary-breakdown');
  await beneficiary.locator('.taxpay-recipient-extra > summary').click();
  await expect(beneficiary.locator('.taxpay-bento-analytics__unclassified-intro')).toBeVisible();
  await expect(beneficiary.locator('.taxpay-bento-analytics__segments')).toHaveCount(0);
  await expect(beneficiary.getByTestId('dashboard-unclassified-recovery')).toContainText('81,500');
  await expect(beneficiary.getByTestId('dashboard-unclassified-recovery')).toContainText('32,000');
  await expect(grid.locator('.taxpay-bento-recent li')).toHaveCount(5);
  const service=analytics.getByTestId('dashboard-service-breakdown');
  await analytics.getByTestId('dashboard-payment-extra').locator('summary').click();
  const serviceBox=await service.boundingBox();
  const lastBarBox=await service.locator('.taxpay-bento-analytics__bar-item').last().boundingBox();
  expect(serviceBox&&lastBarBox).toBeTruthy();
  expect(serviceBox!.y+serviceBox!.height-(lastBarBox!.y+lastBarBox!.height),
    'service bars use the height instead of leaving a large empty bottom').toBeLessThan(70);
});


test('Overview KPIs retain values and actions with proper metric-card hierarchy', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Cross-viewport visual acceptance once per build');
  for (const width of [375, 768, 1280, 1780]) {
    await page.setViewportSize({ width, height: 880 });
    await page.goto('/?action=taxpayer_home&demoUser=user1&qaScenario=1&scenarioYear=2025-2026');
    const summary = page.getByTestId('taxpayer-overview-bento').locator('.taxpay-bento-summary');
    const metrics = summary.locator('.taxpay-summary-metric');
    await expect(metrics).toHaveCount(3);
    await expect(metrics.nth(0).locator('strong')).toHaveText('5');
    await expect(metrics.nth(2).locator('strong')).toHaveText('2');
    const geometry = await metrics.evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      const label = element.querySelector('.taxpay-summary-metric__label')!.getBoundingClientRect();
      const value = element.querySelector('strong')!.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x, y: rect.y, width: rect.width,
        radius: parseFloat(style.borderTopLeftRadius),
        borders: [parseFloat(style.borderTopWidth), parseFloat(style.borderLeftWidth)],
        direction: style.flexDirection,
        labelSize: parseFloat(getComputedStyle(element.querySelector('.taxpay-summary-metric__label')!).fontSize),
        valueSize: parseFloat(getComputedStyle(element.querySelector('strong')!).fontSize),
        valueBelowLabel: value.y >= label.bottom - 1,
      };
    }));
    expect(geometry.every(card => card.radius === 16), 'consistent, not pill-shaped KPI corners').toBe(true);
    expect(geometry.every(card => card.borders.every(border => border === 1)), 'no thick status strips').toBe(true);
    expect(geometry.every(card => card.direction === 'column'), 'number is a distinct hierarchy level').toBe(true);
    expect(geometry.every(card => card.valueBelowLabel), 'values are below their labels').toBe(true);
    expect(Math.min(...geometry.map(card => card.labelSize))).toBeGreaterThanOrEqual(14);
    expect(Math.min(...geometry.map(card => card.valueSize))).toBeGreaterThanOrEqual(28);
    if (width >= 900) {
      expect(geometry[1].y).toBeGreaterThan(geometry[0].y);
      expect(geometry[2].y).toBeGreaterThan(geometry[1].y);
      expect(Math.abs(geometry[0].width - geometry[2].width)).toBeLessThan(3);
    } else if (width >= 600) {
      expect(Math.abs(geometry[0].y - geometry[2].y)).toBeLessThan(3);
    } else {
      expect(geometry[1].y).toBeGreaterThan(geometry[0].y);
      expect(geometry[2].y).toBeGreaterThan(geometry[1].y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      'no horizontal overflow at ' + width).toBeLessThanOrEqual(2);
  }
  await metricsCheck();
  async function metricsCheck() {
    await page.getByTestId('taxpayer-overview-bento')
      .locator('.taxpay-summary-metric--requests').click();
    await expect(page.locator('#dashboard-correction-requests')).toBeFocused();
  }
});
