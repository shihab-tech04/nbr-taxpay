import {expect,test} from '@playwright/test';

const demo='/?action=taxpayer_home&demoUser=user1&qaScenario=1';

test('approved V3 overview is an asymmetric bento with real task destinations',async({page})=>{
  for(const width of [320,375,1024,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto(demo);
    const grid=page.getByTestId('taxpayer-overview-bento');
    await expect(grid).toBeVisible();
    const summary=grid.locator('.taxpay-bento-summary');
    const service=grid.getByTestId('dashboard-service-breakdown');
    const roles=grid.getByTestId('dashboard-role-breakdown');
    const beneficiaries=grid.getByTestId('dashboard-beneficiary-breakdown');
    const ranking=grid.getByTestId('dashboard-ranked-beneficiaries');
    const journey=grid.locator('.taxpay-bento-recent');
    const tasks=grid.locator('.taxpay-bento-tasks');
    await expect(summary.getByRole('button')).toHaveCount(3);
    await expect(roles.getByRole('heading',{name:'Payment relationships'})).toBeVisible();
    await expect(beneficiaries.getByRole('heading',{name:'Beneficiary Breakdown'})).toBeVisible();
    await expect(ranking.getByRole('heading',{name:'Top beneficiaries'})).toBeVisible();
    await expect(journey.getByRole('heading',{name:'My Tax Journey'})).toBeVisible();
    await expect(tasks.locator('#dashboard-correction-requests')).toBeVisible();

    const [s,sv,ro,be,ra,jo,ta]=await Promise.all(
      [summary,service,roles,beneficiaries,ranking,journey,tasks].map(el=>el.boundingBox()));
    expect([s,sv,ro,be,ra,jo,ta].every(Boolean)).toBe(true);
    if(!s||!sv||!ro||!be||!ra||!jo||!ta)continue;
    expect(s.y+s.height).toBeLessThanOrEqual(Math.min(sv.y,ro.y)+3);
    expect(sv.y+sv.height).toBeLessThanOrEqual(Math.min(be.y,ra.y)+3);
    expect(be.y+be.height).toBeLessThanOrEqual(Math.min(jo.y,ta.y)+3);
    if(width>=1200){
      expect(Math.abs(sv.y-ro.y)).toBeLessThan(3);
      expect(sv.x+sv.width).toBeLessThanOrEqual(ro.x+3);
      expect(Math.abs(be.y-ra.y)).toBeLessThan(3);
      expect(be.width).toBeGreaterThan(ra.width);
      expect(Math.abs(jo.y-ta.y)).toBeLessThan(3);
      expect(jo.width).toBeGreaterThan(ta.width);
    }else{
      expect(ro.y).toBeGreaterThan(sv.y);
      expect(ra.y).toBeGreaterThan(be.y);
      expect(ta.y).toBeGreaterThan(jo.y);
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
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
  await expect(grid.getByRole('button',{name:/Saved Drafts/})).toBeVisible();
  await analytics.getByRole('button',{name:'View payment history'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
});


test('empty recorded dashboard prioritizes drafts and tasks without changing sidebar or showing fictitious charts',async({page})=>{
  for(const width of [375,1024,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto('/?action=taxpayer_home&demoUser=user1');
    const grid=page.getByTestId('taxpayer-overview-bento');
    await expect(grid).toHaveAttribute('data-dashboard-empty','true');
    const analytics=grid.getByTestId('dashboard-payment-analytics');
    await expect(analytics).toHaveAttribute('data-empty','true');
    await expect(analytics.getByTestId('dashboard-chart-source')).toHaveCount(0);
    await expect(analytics).not.toContainText('113,500');
    const draft=grid.locator('.taxpay-bento-drafts');
    const journey=grid.locator('.taxpay-bento-recent');
    const correction=grid.locator('#dashboard-correction-requests');
    for(const item of [draft,journey,correction])await expect(item).toBeVisible();
    const [d,a,j,c]=await Promise.all([draft,analytics,journey,correction].map(item=>item.boundingBox()));
    expect([d,a,j,c].every(Boolean),'all four sections visible at '+width).toBe(true);
    if(!d||!a||!j||!c)continue;
    if(width>=1200){
      expect(Math.abs(d.y-a.y),'draft and empty insight row aligned').toBeLessThan(4);
      expect(d.x+d.width).toBeLessThanOrEqual(a.x+4);
      expect(Math.abs(j.y-c.y),'journey and corrections row aligned').toBeLessThan(4);
      expect(j.x+j.width).toBeLessThanOrEqual(c.x+4);
    }else{
      expect(j.y,'journey follows continuation tasks').toBeGreaterThan(c.y);
      expect(a.y,'empty insight follows actionable sections').toBeGreaterThan(j.y);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),
      'no horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});
