import {expect,test} from '@playwright/test';

const dashboard='/?action=taxpayer_home&demoUser=user1';

test('HTML reference: selected-year liability/credits table reconciles and selects the year',async({page})=>{
  await page.goto(dashboard);
  const region=page.getByRole('region',{name:'Assessment-year tax position'});
  const table=region.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(4);
  const current=table.getByRole('row').filter({has:page.getByRole('button',{name:'2025-2026'})});
  await expect(current).toContainText('৳ 180,000');
  await expect(current).toContainText('৳ 80,000');
  await expect(current).toContainText('৳ 75,000');
  await expect(current).toContainText('৳ 25,000');
  await table.getByRole('button',{name:'2024-2025'}).click();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(page).toHaveURL(/scenarioYear=2024-2025/);
  await expect(page.getByText('৳ 10,000').first()).toBeVisible();
});

test('review and recent activity preserve navigation and avoid duplicate service panels',async({page})=>{
  await page.goto(dashboard);
  await expect(page.getByRole('heading',{name:'Tax service activity'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Recent activity'})).toBeVisible();
  await page.getByRole('button',{name:'View all activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tax service activity'})).toBeVisible();
});

test('320px dashboard keeps year table contained in a scrolling region',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto(dashboard);
  await expect(page.getByRole('heading',{name:'By assessment year'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test('v11 credit composition and current position reconcile to posted yearly records',async({page})=>{
  await page.goto(dashboard);
  const credits=page.getByRole('table',{name:'Posted credit components'});
  await expect(page.getByRole('heading',{name:'How your credits are made up'})).toBeVisible();
  await expect(page.getByRole('img',{name:/Posted credit composition/})).toBeVisible();
  await expect(credits).toContainText('৳ 48,000');
  await expect(credits).toContainText('৳ 32,000');
  await expect(credits).toContainText('৳ 75,000');
  await expect(credits).toContainText('৳ 155,000');
  const position=page.getByRole('region',{name:'Current tax position'});
  await expect(position).toContainText('৳ 180,000');
  await expect(position).toContainText('৳ 25,000');
  await expect(position).toContainText('৳ 6,500');
  await expect(position).toContainText('Refund inquiries are not approved refunds');
  await page.getByRole('region',{name:'Assessment-year tax position'}).getByRole('button',{name:'2024-2025'}).click();
  await expect(credits).toContainText('৳ 25,000');
  await expect(credits).toContainText('৳ 20,000');
  await expect(credits).toContainText('৳ 70,000');
  await expect(credits).toContainText('৳ 115,000');
  await expect(position).toContainText('৳ 125,000');
  await expect(position).toContainText('৳ 10,000');
});

test('v11 credit composition fits 320px and retains source-first financial status',async({page})=>{
  await page.setViewportSize({width:320,height:800});
  await page.goto(dashboard);
  await expect(page.getByRole('heading',{name:'Current tax position'})).toBeVisible();
  await expect(page.getByRole('table',{name:'Posted credit components'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
