import {expect,test} from '@playwright/test';

const dashboard='/?action=taxpayer_home&demoUser=user1';

test('year comparison shows only actual assessment years, without a monthly dashboard chart',async({page})=>{
  await page.goto(dashboard);
  const chart=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  await expect(chart).toBeVisible();
  await expect(chart.getByRole('button')).toHaveCount(3);
  await expect(chart.getByRole('button',{name:/2025-2026: Total tax.*180,000/})).toBeVisible();
  await expect(chart.getByRole('button',{name:/2024-2025: Total tax.*125,000/})).toBeVisible();
  await expect(chart.getByRole('button',{name:/2023-2024: Total tax.*90,000/})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
});

test('all-year month filtering remains accessible in Activity after dashboard chart removal',async({page})=>{
  await page.goto(dashboard);
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

test('Travel Tax remains nested under Pay Tax without an unverified assessment balance',async({page})=>{
  await page.setViewportSize({width:1600,height:900});
  await page.goto(dashboard);
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await rail.getByRole('button',{name:'Pay Tax menu'}).click();
  await rail.getByRole('button',{name:'Travel Tax',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('narrow year chart is keyboard operable and does not cause page overflow',async({page},info)=>{
  test.skip(info.project.name!=='mobile-320','Narrow-mobile year chart acceptance');
  await page.goto(dashboard);
  const chart=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  const year=chart.getByRole('button',{name:/2024-2025: Total tax/});
  await year.focus();
  await expect(year).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(year).toHaveAttribute('aria-current','true');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
