import {expect,test} from '@playwright/test';
import {openTaxpayerTravelTax} from './taxpayer-travel-menu-helper';

const dashboard='/?action=taxpayer_home&demoUser=user1';

test('current assessment year is available without invented liability or monthly trend charts',async({page})=>{
  await page.goto(dashboard);
  const year=page.getByRole('combobox',{name:'Assessment year'});
  await expect(year.locator('option[value="2026-2027"]')).toHaveCount(1);
  await expect(year.locator('option[value="2025-2026"]')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Recorded payments by month'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'By payment service'})).toBeVisible();
});

test('all-year month filtering remains accessible in Activity after dashboard chart removal',async({page})=>{
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  await page.getByRole('button',{name:'View all activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await page.getByRole('button',{name:'Filter',exact:true}).click();
  await page.getByRole('combobox',{name:'Transaction category'}).selectOption('tds');
  const months=page.getByRole('combobox',{name:'Transaction month'});
  await months.selectOption('2025-09');
  await expect(page).toHaveURL(/monthFilter=2025-09/);
  await expect(page.getByText('DEMO-ETDS-SAL-01').filter({visible:true}).first()).toBeVisible();
  await months.selectOption('2026-03');
  await expect(page).toHaveURL(/monthFilter=2026-03/);
  await expect(page.getByText('DEMO-ETDS-PRO-03').filter({visible:true}).first()).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Filter',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Transaction month'})).toHaveValue('2026-03');
});

test('Travel Tax remains its separate payment journey and never appears as an official tax credit',async({page})=>{
  await page.goto(dashboard);
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-beneficiary-breakdown')).toBeVisible();
  await openTaxpayerTravelTax(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading',{name:'How your tax is covered'})).toHaveCount(0);
});

test('narrow payment-service chart is keyboard operable without horizontal overflow',async({page},info)=>{
  test.skip(info.project.name!=='mobile-320','Narrow-mobile interactive chart acceptance');
  await page.goto(dashboard);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  await page.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  const item=page.getByTestId('dashboard-service-breakdown').locator('[data-service="income"]');
  await item.focus();
  await expect(item).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(item).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

