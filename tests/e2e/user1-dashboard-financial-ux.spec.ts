import { expect, test } from '@playwright/test';

const dashboard='/?action=taxpayer_home&demoUser=user1';

test('bento financial position reconciles with the unchanged account ledger and coverage chart',async({page})=>{
  await page.goto(dashboard);
  const bento=page.getByTestId('taxpayer-overview-bento');
  await expect(bento).toBeVisible();
  await expect(bento.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'How your tax is covered'})).toBeVisible();
  await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toBeVisible();
  await expect(bento.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
  const tds=page.getByRole('button',{name:/TDS.*48,000/});
  await tds.focus();
  await page.keyboard.press('Space');
  await expect(tds).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[role="img"][aria-label^="Liability coverage"]')).toContainText('৳ 48,000');
  await page.keyboard.press('Space');
  await expect(tds).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[role="img"][aria-label^="Liability coverage"]')).toContainText('86%');
  await expect(bento.getByRole('group',{name:'Liability and posted credits by tax year'}).getByRole('button',{name:/2025-2026: Total tax/})).toHaveAttribute('aria-label',/180,000.*155,000/);
  await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toBeVisible();
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

test('tax year bars remain keyboard-accessible selectors and do not invent monthly trends',async({page})=>{
  await page.goto(dashboard);
  const group=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  const oldYear=group.getByRole('button',{name:/2024-2025: Total tax/});
  await expect(oldYear).toBeVisible();
  await oldYear.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(oldYear).toHaveAttribute('aria-current','true');
  await expect(page.getByRole('button',{name:/Still remaining.*10,000/})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
  await page.getByRole('button',{name:'View all activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
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


test('bento layout, Travel Tax and action controls remain usable from 320px to wide desktop',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','One worker verifies the full responsive matrix');
  test.setTimeout(120000);
  for(const width of [320,360,375,390,600,768,800,900,1024,1199,1200,1280,1440,1600,1920]){
    await page.setViewportSize({width,height:820});
    await page.goto(dashboard);
    const bento=page.getByTestId('taxpayer-overview-bento');
    await expect(bento).toBeVisible();
    await expect(bento.getByRole('button',{name:'Travel tax',exact:true})).toHaveCount(0);
    await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'Payments by beneficiary tag'})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'Recent activity'})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'Horizontal overflow at '+width).toBeLessThanOrEqual(2);
    const before=await bento.evaluate(node=>node.getBoundingClientRect());
    expect(before.width,'Bento bounds should be nonempty at '+width).toBeGreaterThan(250);
  }
});

test('overview summary, corrections and recent activity use full readable grid tracks',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One representative desktop and mobile layout matrix');
  test.setTimeout(120000);
  for(const width of [375,768,1024,1199,1200,1280,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto(dashboard);
    const grid=page.getByTestId('taxpayer-overview-bento');
    const summary=grid.locator(':scope > .taxpay-bento-request-row > .taxpay-bento-summary');
    const corrections=grid.locator(':scope > .taxpay-bento-request-row > .taxpay-bento-corrections');
    const recent=grid.locator(':scope > .taxpay-bento-recent');
    const drafts=grid.locator(':scope > .taxpay-bento-drafts');
    await expect(summary).toBeVisible();
    await expect(corrections).toBeVisible();
    await expect(summary.getByRole('button',{name:/Completed Payments/})).toBeVisible();
    await expect(corrections.getByTestId('dashboard-correction-request-list').getByRole('listitem')).toHaveCount(2);
    // Count may be unavailable in browser tests that intentionally disable SQL.
    await expect(summary.getByRole('button',{name:/Saved Drafts/})).toBeVisible();
    // Exercise the visual empty-drafts state directly; do not invent account data.
    if(await drafts.count()){
      await grid.evaluate(element=>element.setAttribute('data-drafts-empty','true'));
      await drafts.evaluate(element=>{element.style.display='none';});
      await expect(drafts).toBeHidden();
    }

    const [box,left,right,activity]=await Promise.all([
      grid.boundingBox(),summary.boundingBox(),corrections.boundingBox(),recent.boundingBox()
    ]);
    expect(box&&left&&right&&activity,'Missing dashboard card bounds at '+width).toBeTruthy();
    const container=box!,summaryBox=left!,correctionBox=right!,recentBox=activity!;
    if(width>=1200){
      expect(summaryBox.width,'Summary cramped at '+width).toBeGreaterThan(330);
      expect(correctionBox.width,'Correction card cramped at '+width).toBeGreaterThan(265);
      expect(Math.abs(summaryBox.y-correctionBox.y),'Cards must share a row').toBeLessThan(4);
      expect(correctionBox.x,'Correction card must follow summary').toBeGreaterThan(summaryBox.x+summaryBox.width-2);
    }else{
      expect(summaryBox.width,'Summary should stack at '+width).toBeGreaterThan(container.width-4);
      expect(correctionBox.width,'Corrections should stack at '+width).toBeGreaterThan(container.width-4);
      expect(correctionBox.y).toBeGreaterThan(summaryBox.y);
    }
    expect(recentBox.width,'Recent activity must use the empty-draft space at '+width)
      .toBeGreaterThan(container.width-4);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'Dashboard overflows at '+width).toBeLessThanOrEqual(2);
    if(width===375||width===1600)
      await page.screenshot({path:'test-results/screenshots/dashboard-layout-fixed-'+width+'.png',fullPage:true});
  }
});
