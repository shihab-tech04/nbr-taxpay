import {expect,test} from '@playwright/test';

const demo='/?action=taxpayer_home&demoUser=user1&qaScenario=1';

test('reference dashboard is recipient-first with a responsive hero and accessible follow-ups',async({page})=>{
  for(const width of [320,375,1024,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto(demo);
    const grid=page.getByTestId('taxpayer-overview-bento');
    const summary=grid.locator('.taxpay-bento-summary');
    const hero=summary.locator('.taxpay-overview-feature');
    const analytics=grid.getByTestId('dashboard-payment-analytics');
    const recipient=analytics.getByTestId('dashboard-beneficiary-breakdown');
    const ranking=analytics.getByTestId('dashboard-ranked-beneficiaries');
    const details=analytics.getByTestId('dashboard-payment-extra');
    const journey=grid.locator('.taxpay-bento-recent');
    const followups=grid.locator('.taxpay-bento-tasks');
    await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
    await expect(hero.getByRole('heading',{name:'Payments at a glance'})).toBeVisible();
    await expect(hero.getByRole('link',{name:'View payment history'})).toBeVisible();
    await expect(hero.locator('.taxpay-overview-feature__donut')).toBeVisible();
    await expect(hero).toHaveCSS('background-image','none');
    await expect(hero.locator('.taxpay-overview-feature__main')).toHaveCSS('display','grid');
    await expect(hero.locator('.taxpay-overview-feature__amount > p')).toHaveCSS('font-size','16px');
    await expect(hero.locator('.taxpay-overview-feature__amount > p')).toHaveCSS('color','rgb(237, 245, 255)');
    if(width>=1200){
      const rect=await hero.boundingBox();
      expect(rect?.height,'desktop hero must not expand to a full-page column').toBeLessThan(410);
    }
    await expect(summary.locator('.taxpay-summary-metric')).toHaveCount(3);
    await expect(recipient.getByRole('heading',{name:'Payment relationships'})).toBeVisible();
    await expect(recipient.getByTestId('dashboard-recipient-snapshot')).toBeVisible();
    await expect(ranking.getByRole('heading',{name:'Top beneficiaries'})).toBeVisible();
    await expect(details.locator('summary')).toBeVisible();
    await expect(details).not.toHaveAttribute('open');
    await expect(journey.getByRole('heading',{name:'My Tax Journey'})).toBeVisible();
    await expect(followups.getByRole('heading',{name:'Follow-ups'})).toBeVisible();
    await expect(followups.getByRole('button',{name:/Requests/})).toHaveAttribute('aria-pressed','true');
    const [a,r,jy,t]=await Promise.all([analytics,recipient,journey,followups].map(x=>x.boundingBox()));
    expect([a,r,jy,t].every(Boolean)).toBe(true);
    if(a&&r&&jy&&t){
      expect(a.y).toBeLessThan(jy.y);
      if(width>=1200)expect(Math.abs(jy.y-t.y)).toBeLessThan(4);
      else expect(t.y).toBeGreaterThan(jy.y);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),
      'no horizontal overflow at '+width).toBeLessThanOrEqual(2);
    await details.locator('summary').click();
    await expect(analytics.getByTestId('dashboard-service-breakdown')).toBeVisible();
    await expect(analytics.getByTestId('dashboard-role-breakdown')).toBeVisible();
    await details.locator('summary').click();
    const draftsTab=followups.getByRole('button',{name:/Drafts/});
    await draftsTab.click();
    await expect(draftsTab).toHaveAttribute('aria-pressed','true');
    await expect(followups.locator('.taxpay-bento-drafts')).toBeVisible();
    await expect(followups.getByTestId('dashboard-payment-drafts')).toBeVisible();
    await followups.getByRole('button',{name:/Requests/}).click();
    await expect(followups.getByRole('button',{name:/Requests/})).toHaveAttribute('aria-pressed','true');
    await expect(followups.locator('#dashboard-correction-requests')).toBeVisible();
  }
});

test('beneficiary charts retain real source isolation, tags, top five and history actions',async({page})=>{
  await page.setViewportSize({width:1600,height:900});
  await page.goto(demo);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const analytics=page.getByTestId('dashboard-payment-analytics');
  const sources=analytics.getByTestId('dashboard-chart-source');
  await sources.getByRole('button',{name:'Examples'}).click();
  const breakdown=analytics.getByTestId('dashboard-beneficiary-breakdown');
  await breakdown.locator('.taxpay-recipient-extra > summary').click();
  await breakdown.getByRole('button',{name:'Tags',exact:true}).click();
  await expect(analytics.getByTestId('dashboard-beneficiary-tags-chart')).toBeVisible();
  await breakdown.getByRole('button',{name:'Top 5'}).click();
  await expect(breakdown.getByTestId('dashboard-top-beneficiaries')).toBeVisible();
  await expect(analytics.getByTestId('dashboard-ranked-beneficiaries')).toBeVisible();
  await sources.getByRole('button',{name:'Recorded'}).click();
  await expect(analytics.getByTestId('dashboard-role-breakdown')).toContainText('No payer allocations');
  await expect(analytics.getByTestId('dashboard-ranked-beneficiaries')).toContainText('No identifiable third-party beneficiaries');
  await expect(analytics.getByTestId('dashboard-service-breakdown').locator('.taxpay-bento-analytics__total')).toHaveText('—');
});

test('public account overview never falls back to fictional totals, even when selected year lacks data',async({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  const grid=page.getByTestId('taxpayer-overview-bento');
  const analytics=grid.getByTestId('dashboard-payment-analytics');
  await expect(analytics).toHaveAttribute('data-chart-source','recorded');
  await expect(analytics.getByTestId('dashboard-chart-source')).toHaveCount(0);
  await expect(analytics).toContainText('No itemized account payments');
  await expect(grid.getByTestId('dashboard-source-indicator')).not.toContainText('Example activity');
  await expect(grid.getByTestId('dashboard-correction-request-list')).toHaveCount(0);
  await expect(grid.getByRole('button',{name:/Completed Payments/})).not.toContainText('5');
  await expect(analytics).not.toContainText('113,500');
  await expect(grid.getByRole('heading',{name:'My Tax Journey'})).toBeVisible();
  await expect(grid.getByTestId('dashboard-overview-total')).toHaveText('—');
  await expect(grid.locator('.taxpay-overview-feature__services')).toHaveCount(0);
  await expect(grid.getByRole('button',{name:/Saved Drafts/})).toBeVisible();
  await analytics.getByRole('button',{name:'View payment history'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
});


test('empty recorded dashboard keeps zero values honest and follow-up tabs usable',async({page})=>{
  for(const width of [375,1024,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto('/?action=taxpayer_home&demoUser=user1');
    const grid=page.getByTestId('taxpayer-overview-bento');
    const analytics=grid.getByTestId('dashboard-payment-analytics');
    const summary=grid.locator('.taxpay-bento-summary');
    const recent=grid.locator('.taxpay-bento-recent');
    const tasks=grid.locator('.taxpay-bento-tasks');
    await expect(grid).toHaveAttribute('data-dashboard-empty','true');
    await expect(analytics).toHaveAttribute('data-empty','true');
    await expect(grid.getByTestId('dashboard-overview-total')).toHaveText('—');
    await expect(analytics).not.toContainText('113,500');
    await expect(tasks.getByRole('heading',{name:'Follow-ups'})).toBeVisible();
    const [s,a,j,t]=await Promise.all([summary,analytics,recent,tasks].map(x=>x.boundingBox()));
    expect([s,a,j,t].every(Boolean)).toBe(true);
    if(s&&a&&j&&t){
      expect(s.y+s.height).toBeLessThanOrEqual(j.y+4);
      if(width>=1200)expect(Math.abs(j.y-t.y)).toBeLessThan(4);
      else expect(t.y).toBeGreaterThan(j.y);
      expect(a.y).toBeGreaterThanOrEqual(t.y);
    }
    const draftsTab=tasks.getByRole('button',{name:/Drafts/});
    await draftsTab.click();
    await expect(draftsTab).toHaveAttribute('aria-pressed','true');
    await expect(tasks.locator('.taxpay-bento-drafts')).toBeVisible();
    await expect(tasks.getByTestId('dashboard-payment-drafts')).toBeVisible();
    await tasks.getByRole('button',{name:/Requests/}).click();
    await expect(tasks.getByRole('button',{name:/Requests/})).toHaveAttribute('aria-pressed','true');
    await expect(tasks.locator('#dashboard-correction-requests')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
});

test('public overview opens the current assessment year and preserves explicit year selection',async({page})=>{
  for(const width of [375,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto('/?action=taxpayer_home&demoUser=user1');
    const year=page.getByRole('combobox',{name:'Assessment year'});
    await expect(year).toHaveValue('2026-2027');
    await year.selectOption('2025-2026');
    await expect(year).toHaveValue('2025-2026');
    await page.reload();
    await expect(year).toHaveValue('2025-2026');
    await page.goto('/?action=taxpayer_home&demoUser=user1');
    await expect(year).toHaveValue('2026-2027');
    await expect(page.getByTestId('dashboard-chart-source')).toHaveCount(0);
  }
});
