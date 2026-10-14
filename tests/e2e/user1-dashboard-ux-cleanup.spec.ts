import { expect, test } from '@playwright/test';

const demo = '/?action=taxpayer_home&demoUser=user1';

test('dashboard presents unique content, no repeated shortcuts or duplicate evidence panels', async ({page}) => {
  await page.goto(demo);
  const workspace=page.getByTestId('user1-synthetic-workspace');
  await expect(workspace).toHaveAttribute('data-dashboard-view','true');
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveCount(1);
  await expect(page.getByText('Sample',{exact:true})).toHaveCount(0);
  await expect(page.locator('summary[aria-label="About Sample"]')).toHaveCount(0);

  for (const oldHeading of ['Assessment-year summary','Income tax and source records','Documents and support','Reconciliation health','Transaction history']) {
    await expect(workspace.getByRole('heading',{name:oldHeading,exact:true})).toHaveCount(0);
  }
  await expect(workspace.locator('.taxpayer-dashboard-header').getByRole('button',{name:'Overview'})).toHaveCount(0);
  await expect(workspace.locator('.taxpayer-dashboard-kpi')).toHaveCount(4);
  await expect(page.getByRole('heading',{name:'Tax coverage'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Needs review'})).toBeVisible();
  await expect(page.locator('.taxpayer-travel-summary').getByText('Travel tax (separate)')).toBeVisible();

  await expect(workspace.locator('.taxpayer-dashboard-kpi').first().locator(':scope > p')).toHaveCount(1);
  await expect(page.getByText('৳ 180,000').first()).toBeVisible();
  await expect(page.getByText('৳ 80,000').first()).toBeVisible();
  await expect(page.getByText('৳ 75,000').first()).toBeVisible();
  await expect(page.getByText('৳ 25,000').first()).toBeVisible();
  await page.getByRole('button',{name:'View Pending: 1'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-PEND-01').first()).toBeVisible();
});

test('KPI explanations are available by Enter, Space, Escape and touch-friendly disclosure',async({page})=>{
  await page.goto(demo);
  const liability=page.locator('summary[aria-label="About Income tax liability"]');
  await liability.focus();
  await page.keyboard.press('Enter');
  await expect(liability.locator('..')).toHaveAttribute('open','');
  await expect(page.getByText('Starting liability used for this tax year.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(liability.locator('..')).not.toHaveAttribute('open','');
  await liability.focus();
  await page.keyboard.press('Space');
  await expect(liability.locator('..')).toHaveAttribute('open','');
  await liability.click();
  await expect(liability.locator('..')).not.toHaveAttribute('open','');
  await expect(page.getByText('৳ 180,000').first()).toBeVisible();
});

test('monthly chart maintains type filtering, truthful empty months, and detailed activity drill-down',async({page})=>{
  await page.goto(demo);
  const monthly=page.getByRole('group',{name:/Income tax: Jun 2026/});
  await expect(monthly).toBeVisible();
  await expect(monthly.getByRole('button',{name:/Income tax, Jun 2026/})).toBeVisible();
  await expect(monthly.getByRole('button',{name:/Income tax, Sep 2026/})).toBeVisible();
  // January has no recorded income-tax event, so no fake zero-height bar or Tab stop.
  await expect(monthly.getByRole('button',{name:/Income tax, Jan 2026/})).toHaveCount(0);
  const travel=page.getByRole('button',{name:'Travel tax',exact:true});
  await travel.focus();
  await page.keyboard.press('Space');
  await expect(travel).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('group',{name:/Travel tax: Apr 2026/})).toBeVisible();
  await page.getByRole('button',{name:'Open transaction history'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
});

test('mobile and desktop dashboard have no duplicate panel or horizontal clipping, including open help',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Audit eight responsive sizes on one worker');
  test.setTimeout(120000);
  for(const width of [320,360,375,390,768,1024,1440,1600]){
    await page.setViewportSize({width,height:830});
    await page.goto(demo);
    const workspace=page.getByTestId('user1-synthetic-workspace');
    await expect(workspace.locator('.taxpayer-dashboard-kpi')).toHaveCount(4);
    await expect(workspace.getByRole('combobox',{name:'Assessment year'})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
    if(width>=1440){
      await expect(page.locator('.taxpay-taxpayer-reference > .citizen-footer')).toBeHidden();
      await expect(page.getByRole('complementary',{name:'Taxpayer desktop navigation'})).toBeVisible();
    }
    if(width<=390){
      const liability=page.locator('summary[aria-label="About Income tax liability"]');
      await liability.click();
      const bounds=await liability.locator('..').locator('.taxpayer-inline-help__content').boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x,'popover extends left at '+width).toBeGreaterThanOrEqual(0);
      expect(bounds!.x+bounds!.width,'popover extends right at '+width).toBeLessThanOrEqual(width+2);
    }
  }
});
