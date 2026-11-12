import {expect,test} from '@playwright/test';

test('overview summary and correction requests occupy a readable responsive row',async({page})=>{
  for(const width of [375,1024,1600]){
    await page.setViewportSize({width,height:900});
    await page.goto('/?action=taxpayer_home&demoUser=user1');
    const overview=page.getByTestId('taxpayer-overview-bento');
    await expect(overview).toBeVisible();
    const row=overview.locator('.taxpay-bento-request-row');
    const summary=row.locator('.taxpay-bento-summary');
    const corrections=row.locator('.taxpay-bento-corrections');
    await expect(summary.getByText('Completed Payments')).toBeVisible();
    await expect(summary.getByText('Saved Drafts')).toBeVisible();
    await expect(corrections.getByRole('heading',{name:'Correction Requests'})).toBeVisible();
    const [bounds,a,b]=await Promise.all([row.boundingBox(),summary.boundingBox(),corrections.boundingBox()]);
    expect(bounds&&a&&b).toBeTruthy();
    if(!bounds||!a||!b)continue;
    expect(a.width).toBeGreaterThan(230);
    expect(b.width).toBeGreaterThan(230);
    if(width>=1200){
      expect(Math.abs(a.y-b.y)).toBeLessThan(3);
      expect(a.x+a.width).toBeLessThanOrEqual(b.x+2);
      expect(b.x+b.width).toBeLessThanOrEqual(bounds.x+bounds.width+2);
    }else{
      expect(b.y).toBeGreaterThan(a.y);
    }
    const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width+2);
  }
});

test('saved drafts and recent activity each occupy full responsive width, including empty state',async({page})=>{
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  const grid=page.getByTestId('taxpayer-overview-bento');
  const drafts=grid.locator(':scope > .taxpay-bento-drafts');
  const recent=grid.locator(':scope > .taxpay-bento-recent');
  await expect(drafts.getByTestId('dashboard-payment-drafts')).toBeVisible();
  await expect(recent).toBeVisible();
  const [draftBox,recentBox,container]=await Promise.all([drafts.boundingBox(),recent.boundingBox(),grid.boundingBox()]);
  expect(draftBox&&recentBox&&container).toBeTruthy();
  if(draftBox&&recentBox&&container){
    expect(draftBox.width).toBeGreaterThan(container.width*.9);
    expect(recentBox.width).toBeGreaterThan(container.width*.9);
    expect(recentBox.y).toBeGreaterThan(draftBox.y);
  }
});
