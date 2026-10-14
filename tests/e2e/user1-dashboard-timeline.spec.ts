import { expect, test } from '@playwright/test';

const dashboard='/?action=taxpayer_home&demoUser=user1';

test('income-tax chart derives a dated June–September 2026 window from actual postings',async({page})=>{
  await page.goto(dashboard);
  const chart=page.getByRole('group',{name:/Income tax: Jun 2026/});
  await expect(chart).toBeVisible();
  await expect(page.getByText('Jun ’26–Sep ’26')).toBeVisible();
  await expect(chart.getByRole('button',{name:/Income tax, Jun 2026:.*30,000/})).toBeVisible();
  await expect(chart.getByRole('button',{name:/Income tax, Sep 2026:.*45,000/})).toBeVisible();
  await expect(chart.getByRole('button',{name:/Income tax, Jan/})).toHaveCount(0);
  await expect(chart.locator(':scope > div')).toHaveCount(4);
  await expect(page.locator('.taxpayer-travel-summary').getByText('Travel tax (separate)')).toBeVisible();
  await expect(page.getByRole('button',{name:'Review exceptions'})).toHaveCount(0);
});

test('withholding retains full year-month chronology and does not merge September 2025 with 2026',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('button',{name:'TDS / withholding'}).click();
  const chart=page.getByRole('group',{name:/TDS \/ withholding: Sep 2025/});
  await expect(chart).toBeVisible();
  await expect(page.getByText('Sep ’25–Mar ’26')).toBeVisible();
  await expect(chart.locator(':scope > div')).toHaveCount(7);
  await expect(chart.getByRole('button',{name:/TDS \/ withholding, Sep 2025:.*27,000/})).toBeVisible();
  await expect(chart.getByRole('button',{name:/TDS \/ withholding, Jan 2026:.*9,000/})).toBeVisible();
  await expect(chart.getByRole('button',{name:/TDS \/ withholding, Mar 2026:.*12,000/})).toBeVisible();
  await expect(chart.getByRole('button',{name:/TDS \/ withholding, Sep 2026/})).toHaveCount(0);
  await expect(page.getByText('৳ 48,000').first()).toBeVisible();
});

test('travel tax remains independently visible through its category, not as an income-tax credit',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('button',{name:'Travel tax',exact:true}).click();
  const chart=page.getByRole('group',{name:/Travel tax: Apr 2026/});
  await expect(chart).toBeVisible();
  await expect(chart.getByRole('button',{name:/Travel tax, Apr 2026:.*6,500/})).toBeVisible();
  await expect(chart.locator(':scope > div')).toHaveCount(1);
  await expect(chart.getByText('Apr ’26')).toBeVisible();
  await expect(page.locator('.taxpayer-dashboard-kpi').last()).toContainText('৳ 25,000');
  await expect(page.getByRole('heading',{name:'Tax coverage'})).toBeVisible();
  await expect(page.locator('.taxpayer-travel-summary')).toContainText('৳ 6,500');
});

test('assessment year changes displayed transaction months without assuming a statutory calendar range',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2024-2025');
  const chart=page.getByRole('group',{name:/Income tax: Jun 2025/});
  await expect(chart).toBeVisible();
  await expect(page.getByText('Jun ’25–Sep ’25')).toBeVisible();
  await expect(chart.getByRole('button',{name:/Income tax, Jun 2025:.*40,000/})).toBeVisible();
  await expect(chart.getByRole('button',{name:/Income tax, Sep 2025:.*30,000/})).toBeVisible();
  await page.getByRole('button',{name:'TDS / withholding'}).click();
  await expect(page.getByRole('group',{name:/TDS \/ withholding: Sep 2024/})).toBeVisible();
});

test('phone chart scroll is contained and keyboard available when months exceed the width',async({page},info)=>{
  test.skip(info.project.name!=='mobile-320','Check the narrow-phone layout');
  await page.goto(dashboard);
  await page.getByRole('button',{name:'TDS / withholding'}).click();
  const scroll=page.locator('.taxpayer-monthly-scroll');
  await expect(scroll).toHaveAttribute('tabindex','0');
  await scroll.focus();
  await expect(scroll).toBeFocused();
  const dims=await scroll.evaluate(el=>({visible:el.clientWidth,full:el.scrollWidth}));
  expect(dims.full).toBeGreaterThan(dims.visible);
  const documentOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(documentOverflow).toBeLessThanOrEqual(2);
});

test('capture 1600px desktop and 375px mobile dashboard renders for visual QA',async({page},info)=>{
  test.skip(!['desktop-1280','mobile-375'].includes(info.project.name),'Visual QA target viewports');
  const desktop=info.project.name==='desktop-1280';
  await page.setViewportSize(desktop?{width:1600,height:900}:{width:375,height:812});
  await page.goto(dashboard);
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toBeVisible();
  await page.screenshot({path:'visual-evidence/taxpayer-final-'+(desktop?'desktop-1600':'mobile-375')+'.png',fullPage:true,animations:'disabled'});
});
