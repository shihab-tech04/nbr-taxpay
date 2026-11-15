import {expect,test} from '@playwright/test';

const demo='/?action=taxpayer_home&demoUser=user1&qaScenario=1';

test('reference-aligned Overview keeps the year, ring, three KPIs, recipients and Follow-ups responsive',async({page})=>{
  test.setTimeout(120000);
  for(const width of [320,375,768,1024,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto(demo);
    const grid=page.getByTestId('taxpayer-overview-bento');
    const summary=grid.locator('.taxpay-bento-summary');
    const hero=summary.locator('.taxpay-overview-feature');
    const analytics=grid.getByTestId('dashboard-payment-analytics');
    const recipients=analytics.getByTestId('dashboard-recipient-grid');
    const relationship=recipients.getByTestId('dashboard-recipient-relationships');
    const ranking=recipients.getByTestId('dashboard-ranked-beneficiaries');
    const journey=grid.locator('.taxpay-bento-recent');
    const followups=grid.locator('.taxpay-bento-followups');
    await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
    await expect(hero.getByTestId('dashboard-overview-total')).toContainText('113,500');
    await expect(hero.locator('.taxpay-overview-feature__ring')).toBeVisible();
    await expect(hero.locator('.taxpay-overview-feature__ring-center')).toContainText('66%');
    await expect(summary.locator('.taxpay-summary-metric')).toHaveCount(3);
    await expect(summary.getByRole('button')).toHaveCount(3);
    await expect(summary.getByRole('link',{name:'View payment history'})).toBeVisible();
    await expect(hero).toHaveCSS('background-color','rgb(44, 94, 173)');
    await expect(relationship.getByRole('heading',{name:'Payment relationships'})).toBeVisible();
    await expect(relationship.locator('.taxpay-recipient-coverage__summary')).toContainText('72%');
    await expect(ranking.getByRole('heading',{name:'Top beneficiaries'})).toBeVisible();
    await expect(journey.getByRole('heading',{name:'My Tax Journey'})).toBeVisible();
    await expect(followups.getByRole('heading',{name:'Follow-ups'})).toBeVisible();
    await expect(analytics.getByTestId('dashboard-recipient-advanced')).not.toHaveAttribute('open');
    const [h,re,ra,jo,fo]=await Promise.all(
      [hero,relationship,ranking,journey,followups].map(el=>el.boundingBox()));
    expect([h,re,ra,jo,fo].every(Boolean)).toBe(true);
    if(h&&re&&ra&&jo&&fo){
      expect(h.y+h.height).toBeLessThanOrEqual(re.y+4);
      if(width>=1200){
        expect(Math.abs(re.y-ra.y)).toBeLessThan(4);
        expect(re.x+re.width).toBeLessThanOrEqual(ra.x+4);
        expect(Math.abs(jo.y-fo.y)).toBeLessThan(4);
        expect(jo.x+jo.width).toBeLessThanOrEqual(fo.x+4);
      }else{
        expect(ra.y).toBeGreaterThan(re.y);
        expect(fo.y).toBeGreaterThan(jo.y);
      }
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),
      'no horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});

test('advanced service, tags and ranking filters remain functional without extra default rows',async({page})=>{
  await page.goto(demo);
  const analytics=page.getByTestId('dashboard-payment-analytics');
  const advanced=analytics.getByTestId('dashboard-recipient-advanced');
  await expect(advanced).not.toHaveAttribute('open');
  await advanced.locator('summary').click();
  await expect(advanced).toHaveAttribute('open');
  const sources=analytics.getByTestId('dashboard-chart-source');
  await sources.getByRole('button',{name:'Examples'}).click();
  const service=analytics.getByTestId('dashboard-service-breakdown');
  const beneficiary=analytics.getByTestId('dashboard-beneficiary-breakdown');
  await expect(service).toBeVisible();
  await expect(analytics.getByTestId('dashboard-role-breakdown')).toBeVisible();
  await beneficiary.getByRole('button',{name:'Tags',exact:true}).click();
  await expect(beneficiary.getByTestId('dashboard-beneficiary-tags-chart')).toBeVisible();
  await beneficiary.getByRole('button',{name:'Top 5'}).click();
  await expect(beneficiary.getByTestId('dashboard-top-beneficiaries').locator('[data-rank]')).toHaveCount(3);
  await service.locator('[data-service="ait"]').click();
  await expect(beneficiary).toContainText('Advance Tax');
  await service.getByRole('button',{name:'Show all payment services'}).click();
  await expect(beneficiary).toContainText('113,500');
  await sources.getByRole('button',{name:'Recorded'}).click();
  await expect(service.locator('.taxpay-bento-analytics__total')).toHaveText('—');
  await expect(analytics.getByTestId('dashboard-ranked-beneficiaries')).toContainText('No identifiable third-party beneficiaries');
});

test('Follow-ups toggle retains draft controls and request details',async({page})=>{
  await page.goto(demo);
  const grid=page.getByTestId('taxpayer-overview-bento');
  const followups=grid.locator('.taxpay-bento-followups');
  const requests=followups.locator('#dashboard-correction-requests');
  const drafts=followups.locator('#taxpayer-dashboard-draft-section');
  await expect(requests).toBeVisible();
  await expect(requests.getByTestId('dashboard-correction-request-list').locator('li')).toHaveCount(2);
  await expect(drafts).toBeHidden();
  await followups.getByRole('button',{name:/Drafts/i}).click();
  await expect(drafts).toBeVisible();
  await expect(requests).toBeHidden();
  await followups.getByRole('button',{name:/Requests/i}).click();
  await expect(requests).toBeVisible();
  await requests.getByRole('button',{name:/View request details for Refund inquiry/}).click();
  await expect(page.locator('.taxpay-modal')).toBeVisible();
});

test('recorded empty state never promotes example amounts and keeps recovery actions',async({page})=>{
  for(const width of [375,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto('/?action=taxpayer_home&demoUser=user1');
    const grid=page.getByTestId('taxpayer-overview-bento');
    const analytics=grid.getByTestId('dashboard-payment-analytics');
    await expect(grid).toHaveAttribute('data-dashboard-empty','true');
    await expect(analytics).toHaveAttribute('data-chart-source','recorded');
    await expect(analytics).toHaveAttribute('data-empty','true');
    await expect(grid.getByTestId('dashboard-source-indicator')).not.toContainText('Example activity');
    await expect(grid.getByTestId('dashboard-overview-total')).toHaveText('—');
    await expect(grid.locator('.taxpay-overview-feature__ring')).toHaveCount(0);
    await expect(analytics.getByTestId('dashboard-chart-source')).toHaveCount(0);
    await expect(grid.getByTestId('dashboard-correction-request-list')).toHaveCount(0);
    await expect(grid.locator('.taxpay-bento-followups')).toBeVisible();
    await grid.locator('.taxpay-bento-followups').getByRole('button',{name:/Drafts/i}).click();
    await expect(grid.locator('.taxpay-bento-drafts')).toBeVisible();
    await expect(grid.locator('.taxpay-bento-recent')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
  await page.getByTestId('dashboard-payment-analytics').getByRole('button',{name:'View payment history'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
});

test('assessment-year selection and reload maintain source isolation',async({page})=>{
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
