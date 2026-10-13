import { expect, test } from '@playwright/test';

test('taxpayer home presents a complete lifecycle without inventing NBR credit', async ({page}) => {
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await expect(page.getByRole('heading', {name:'My Tax Payments'})).toBeVisible();
  await expect(page.getByRole('heading', {name:'Your transaction lifecycle'})).toBeVisible();
  await expect(page.locator('.life-journey__steps > li')).toHaveCount(5);
  await expect(page.getByText('A gateway success alone does not confirm Treasury settlement or create a tax credit.')).toBeVisible();
  await expect(page.getByText('No real payment, Treasury confirmation or tax credit.',{exact:false})).toHaveCount(1);
  await expect(page.locator('.life-metric--blue .life-metric__value')).toHaveText('Unverified');
  await expect(page.locator('.life-metric--sage .life-metric__value')).toHaveText('3');
  await expect(page.locator('.life-activity__records li')).toHaveCount(3);
  await page.getByRole('button',{name:'Allocated to me', exact:true}).click();
  await expect(page.locator('.life-activity__records li')).toHaveCount(3);
  await expect(page.getByText('DEMO-TX-008')).toBeVisible();
  await page.locator('.life-year-select select').selectOption('2026-27');
  await expect(page.locator('.life-activity__records li')).toHaveCount(3);
});

test('without an authorized data source, the lifecycle dashboard fails closed', async ({page}) => {
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await expect(page.getByRole('heading',{name:'My Tax Payments'})).toBeVisible();
  await expect(page.locator('.life-metric--sage .life-metric__value')).toHaveText('—');
  await expect(page.locator('.life-metric--blue .life-metric__value')).toHaveText('Unverified');
  await expect(page.getByText('No account-backed transaction feed is available in this view.',{exact:false})).toBeVisible();
  await page.locator('.life-journey__steps button').filter({hasText:'Ledger reconciliation'}).click();
  await expect(page.getByRole('heading',{name:'Tax ledger'})).toBeVisible();
});

test('lifecycle home is usable on compact mobile layouts and in Bangla', async ({page}) => {
  for (const width of [320,375,768,1280,1600]) {
    await page.setViewportSize({width,height:820});
    await page.goto('/?action=taxpayer_home&demoUser=user1&lang=bn');
    await expect(page.getByRole('heading',{name:'আমার কর পেমেন্ট'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'আপনার লেনদেনের জীবনচক্র'})).toBeVisible();
    await expect(page.locator('.life-journey__steps > li')).toHaveCount(5);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(horizontalOverflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});
