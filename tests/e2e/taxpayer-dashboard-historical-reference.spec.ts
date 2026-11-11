import {expect,test} from '@playwright/test';
const dashboard='/?action=taxpayer_home&demoUser=user1';

test('year comparison remains selectable while the external assessment row is hidden',async({page})=>{
  await page.goto(dashboard);
  const chart=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  await expect(chart.getByRole('button')).toHaveCount(3);
  const current=chart.getByRole('button',{name:/2025-2026: Total tax/});
  await expect(current).toHaveAttribute('aria-current','true');
  await expect(current).toHaveAttribute('aria-label',/180,000.*155,000/);
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
  await chart.getByRole('button',{name:/2024-2025: Total tax/}).click();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(page).toHaveURL(/scenarioYear=2024-2025/);
  await expect(chart.getByRole('button',{name:/2024-2025: Total tax/})).toHaveAttribute('aria-label',/125,000.*115,000/);
  await expect(page.getByTestId('dashboard-correction-requests')).toBeVisible();
});

test('recent activity preserves navigation and avoids duplicate service panels',async({page})=>{
  await page.goto(dashboard);
  await expect(page.getByRole('heading',{name:'Tax service activity'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Recent activity'})).toBeVisible();
  await page.getByRole('button',{name:'View all activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Earlier saved payment records'})).toHaveCount(0);
});

test('320px comparison chart stays within Overview after first-row removal',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto(dashboard);
  await expect(page.getByRole('group',{name:'Liability and posted credits by tax year'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tax trend by year'})).toBeVisible();
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('sample coverage details remain reconciled within analytics, but never become official credit totals',async({page})=>{
  await page.goto(dashboard);
  const coverage=page.getByRole('group',{name:'Coverage details'});
  await expect(coverage.getByRole('button',{name:/TDS.*48,000/})).toBeVisible();
  await expect(coverage.getByRole('button',{name:/Advance tax.*32,000/})).toBeVisible();
  await expect(coverage.getByRole('button',{name:/Direct payment.*75,000/})).toBeVisible();
  await expect(page.getByRole('table',{name:'Posted credit components'})).toHaveCount(0);
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
  await page.getByRole('group',{name:'Liability and posted credits by tax year'})
    .getByRole('button',{name:/2024-2025: Total tax/}).click();
  await expect(coverage.getByRole('button',{name:/TDS.*25,000/})).toBeVisible();
  await expect(coverage.getByRole('button',{name:/Advance tax.*20,000/})).toBeVisible();
  await expect(coverage.getByRole('button',{name:/Direct payment.*70,000/})).toBeVisible();
});

test('coverage and year bars fit narrow mobile viewport with correction entry accessible',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto(dashboard);
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(page.getByRole('group',{name:'Coverage details'})).toBeVisible();
  await expect(page.getByRole('group',{name:'Liability and posted credits by tax year'})).toBeVisible();
  await expect(page.getByTestId('dashboard-correction-requests')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
