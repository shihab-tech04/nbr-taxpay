import {expect,test} from '@playwright/test';
const dashboard='/?action=taxpayer_home&demoUser=user1';

test('year chart reconciles assessment-year liability and posted credits and selects the year',async({page})=>{
  await page.goto(dashboard);
  const chart=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  await expect(chart.getByRole('button')).toHaveCount(3);
  const current=chart.getByRole('button',{name:/2025-2026: Total tax/});
  await expect(current).toHaveAttribute('aria-current','true');
  await expect(current).toHaveAttribute('aria-label',/180,000.*155,000/);
  const position=page.locator('.taxpay-bento-position');
  await expect(position).toContainText('৳ 180,000');
  await expect(position).toContainText('৳ 155,000');
  await expect(position).toContainText('৳ 25,000');
  await chart.getByRole('button',{name:/2024-2025: Total tax/}).click();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(page).toHaveURL(/scenarioYear=2024-2025/);
  await expect(position).toContainText('৳ 125,000');
  await expect(position).toContainText('৳ 115,000');
  await expect(position).toContainText('৳ 10,000');
});

test('review and recent activity preserve navigation and avoid duplicate service panels',async({page})=>{
  await page.goto(dashboard);
  await expect(page.getByRole('heading',{name:'Tax service activity'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Recent activity'})).toBeVisible();
  await page.getByRole('button',{name:'View all activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tax service activity'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Earlier saved payment records'})).toHaveCount(0);
});

test('320px year chart remains contained within the Overview without document overflow',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto(dashboard);
  const chart=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  await expect(chart).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tax trend by year'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('credit source breakdown reconciles against current tax position without duplicate credit table',async({page})=>{
  await page.goto(dashboard);
  const coverage=page.getByRole('group',{name:'Coverage details'});
  const position=page.locator('.taxpay-bento-position');
  await expect(coverage.getByRole('button',{name:/TDS.*48,000/})).toBeVisible();
  await expect(coverage.getByRole('button',{name:/Advance tax.*32,000/})).toBeVisible();
  await expect(coverage.getByRole('button',{name:/Direct payment.*75,000/})).toBeVisible();
  await expect(position).toContainText('৳ 155,000');
  await expect(position).toContainText('৳ 25,000');
  await expect(position).toContainText('৳ 6,500');
  await expect(page.getByRole('table',{name:'Posted credit components'})).toHaveCount(0);
  await page.getByRole('group',{name:'Liability and posted credits by tax year'})
    .getByRole('button',{name:/2024-2025: Total tax/}).click();
  await expect(coverage.getByRole('button',{name:/TDS.*25,000/})).toBeVisible();
  await expect(coverage.getByRole('button',{name:/Advance tax.*20,000/})).toBeVisible();
  await expect(coverage.getByRole('button',{name:/Direct payment.*70,000/})).toBeVisible();
  await expect(position).toContainText('৳ 115,000');
  await expect(position).toContainText('৳ 10,000');
});

test('credit chart, position and year bars fit the narrow mobile viewport',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto(dashboard);
  await expect(page.locator('.taxpay-bento-position')).toBeVisible();
  await expect(page.getByRole('group',{name:'Coverage details'})).toBeVisible();
  await expect(page.getByRole('group',{name:'Liability and posted credits by tax year'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
