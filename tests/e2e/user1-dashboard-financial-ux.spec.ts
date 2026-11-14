import { expect, test } from '@playwright/test';

const dashboard='/?action=taxpayer_home&demoUser=user1';

test('bento analytics never display unverified tax-liability charts and separate recorded payments from examples',async({page})=>{
  await page.goto(dashboard);
  const bento=page.getByTestId('taxpayer-overview-bento');
  await expect(bento.getByRole('heading',{name:'How your tax is covered'})).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(0);
  const analytics=bento.getByTestId('dashboard-payment-analytics');
  await expect(analytics).toBeVisible();
  const sources=analytics.getByTestId('dashboard-chart-source');
  // The available illustrated payment history must be visible by default.
  // The account-backed view stays explicit, reversible and never combines sources.
  await expect(sources.getByRole('button',{name:'Examples'})).toHaveAttribute('aria-pressed','true');
  await sources.getByRole('button',{name:'Recorded'}).click();
  await expect(sources.getByRole('button',{name:'Recorded'})).toHaveAttribute('aria-pressed','true');
  await expect(analytics.getByTestId('dashboard-service-breakdown')).toContainText('No itemized recorded payments');
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  await sources.getByRole('button',{name:'Examples'}).click();
  await expect(sources.getByRole('button',{name:'Examples'})).toHaveAttribute('aria-pressed','true');
  const chart=analytics.getByTestId('dashboard-service-breakdown');
  await expect(chart.locator('[data-service="income"]')).toBeVisible();
  await chart.locator('[data-service="income"]').click();
  await expect(chart.locator('[data-service="income"]')).toHaveAttribute('aria-pressed','true');
  await expect(analytics.getByTestId('dashboard-beneficiary-breakdown')).toContainText('Tax with Return');
  await chart.getByRole('button',{name:'Show all payment services'}).click();
  await expect(analytics.getByTestId('dashboard-beneficiary-breakdown')).toContainText('All payment services');
});

test('dashboard shows the three requested counters with working destinations',async({page})=>{
  await page.goto(dashboard);
  const summary=page.getByTestId('taxpayer-overview-bento').locator('.taxpay-bento-hero__status');
  await expect(summary.getByRole('button',{name:/Completed Payments/})).toBeVisible();
  await expect(summary.getByRole('button',{name:/Saved Drafts/})).toBeVisible();
  await expect(summary.getByRole('button',{name:/Correction Requests/})).toBeVisible();
  await summary.getByRole('button',{name:/Completed Payments/}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await page.goto(dashboard);
  await page.getByTestId('taxpayer-overview-bento').locator('.taxpay-bento-hero__status')
    .getByRole('button',{name:/Correction Requests/}).click();
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByTestId('dashboard-correction-request-list').getByRole('listitem')).toHaveCount(2);
});

test('interactive service bars and beneficiary categories support keyboard and selected-year filters',async({page})=>{
  await page.goto(dashboard);
  const sources=page.getByTestId('dashboard-chart-source');
  await sources.getByRole('button',{name:'Examples'}).click();
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const chart=page.getByTestId('dashboard-service-breakdown');
  const income=chart.locator('[data-service="income"]');
  await income.focus();
  await page.keyboard.press('Enter');
  await expect(income).toHaveAttribute('aria-pressed','true');
  const tags=page.getByTestId('dashboard-beneficiary-breakdown');
  const unknown=tags.locator('[data-tag="unassigned"]');
  await expect(unknown).toBeVisible();
  await unknown.focus();
  await page.keyboard.press('Space');
  await expect(unknown).toHaveAttribute('aria-pressed','true');
  await expect(tags.getByTestId('dashboard-selected-tag')).toBeVisible();
  await page.getByRole('button',{name:'View all activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2025-2026');
});

test('desktop navigation consolidates duplicate Overview/Tax summary and groups account routes',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop-only rail');
  await page.setViewportSize({width:1600,height:900});
  await page.goto(dashboard);
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await expect(rail).toBeVisible();
  await expect(rail.getByRole('button',{name:'Overview',exact:true})).toHaveCount(1);
  await expect(rail.getByRole('button',{name:'Tax summary'})).toHaveCount(0);
  await expect(rail.locator('.taxpayer-reference-links > button')).toHaveCount(6);
  const account=rail.locator('.taxpayer-reference-rail-bottom');
  await expect(rail.locator('.taxpayer-reference-account')).toHaveCount(0);
  await expect(account.getByRole('button',{name:'Profile',exact:true})).toBeVisible();
  await expect(account.getByRole('button',{name:'Profile settings'})).toHaveCount(0);
  await expect(account.getByRole('button')).toHaveCount(3);
  await expect(account.getByRole('button',{name:'Account access'})).toHaveCount(0);
  await expect(account.getByRole('button',{name:'Help',exact:true})).toHaveCount(0);
  await expect(account.getByRole('button').last()).toContainText('Exit workspace');
  await expect(rail.getByRole('button',{name:'Payment services',exact:true})).toHaveCount(0);
});


test('interactive bento charts and existing payment actions remain responsive from 320px to wide desktop',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','One worker verifies responsive breakpoints');
  test.setTimeout(120000);
  for(const width of [320,360,375,390,600,768,800,900,1024,1199,1200,1280,1440,1600,1920]){
    await page.setViewportSize({width,height:820});
    await page.goto(dashboard);
    const bento=page.getByTestId('taxpayer-overview-bento');
    await expect(bento).toBeVisible();
    await expect(bento.getByRole('button',{name:'Travel tax',exact:true})).toHaveCount(0);
    await expect(bento.getByRole('heading',{name:'By payment service'})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'By beneficiary relationship'})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'Recent activity'})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'Horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});

test('bento sections remain readable, and saved work remains ahead of analytics',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One representative desktop/mobile matrix');
  for(const width of [375,768,1024,1199,1200,1280,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto(dashboard);
    const grid=page.getByTestId('taxpayer-overview-bento');
    const summary=grid.locator('.taxpay-bento-request-row .taxpay-bento-summary');
    const correction=grid.locator('.taxpay-bento-request-row .taxpay-bento-corrections');
    const activity=grid.locator('.taxpay-bento-recent');
    const analytics=grid.getByTestId('dashboard-payment-analytics');
    const bounds=await Promise.all([summary.boundingBox(),correction.boundingBox(),activity.boundingBox(),analytics.boundingBox()]);
    expect(bounds.every(Boolean),'Every requested dashboard section renders at '+width).toBeTruthy();
    expect(bounds[0]!.y,'Summary before analytics').toBeLessThan(bounds[3]!.y);
    expect(bounds[2]!.y,'Recent activity before charts').toBeLessThan(bounds[3]!.y);
    if(width>=1200){
      expect(Math.abs(bounds[0]!.y-bounds[1]!.y)).toBeLessThan(4);
    }else expect(bounds[1]!.y).toBeGreaterThan(bounds[0]!.y);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'No horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});

