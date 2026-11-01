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
