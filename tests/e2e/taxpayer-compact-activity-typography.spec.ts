import {expect,test} from '@playwright/test';
import {mockPublishedBannerCms} from './mock-published-banners';

test.beforeEach(async ({page}) => { await mockPublishedBannerCms(page); });

/** Public synthetic user1 preview exercises real source-backed components.
 * The separate signed-in EN/BN contract tests authenticate the account.
 * No payment, SQL or third-party data is mutated by these tests.
 */
test('real Activity register bounds each recipient summary and preserves Details on desktop and phone',async ({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One browser checks both locales and phone geometry');
  test.setTimeout(120000);
  for(const lang of ['en','bn']){
    await page.setViewportSize({width:1280,height:900});
    await page.goto('/?action=history&demoUser=user1&scenarioYear=2025-2026&lang='+lang);
    const table=page.getByTestId('taxpayer-transaction-table');
    await expect(table).toBeVisible();
    await expect(table.locator('thead th')).toHaveCount(9);
    const recipientLists=table.locator('.taxpay-compact-cell-list');
    expect(await recipientLists.count()).toBeGreaterThan(0);
    for(const list of await recipientLists.all()) {
      expect(await list.locator('.taxpay-compact-cell-list__item').count()).toBeLessThanOrEqual(1);
    }
    const multi=table.locator('.taxpay-compact-cell-list__more').first();
    if(await multi.count()) {
      await multi.click();
    } else {
      await table.locator('tbody tr').first().locator('.taxpayer-transaction-row__action').first().click();
    }
    await expect(page.getByRole('dialog').last()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:375,height:812});
    await page.goto('/?action=history&demoUser=user1&scenarioYear=2025-2026&lang='+lang);
    const mobile=page.getByTestId('taxpayer-transaction-mobile-cards');
    await expect(mobile).toBeVisible();
    const mobileLists=mobile.locator('.taxpay-compact-cell-list');
    expect(await mobileLists.count()).toBeGreaterThan(0);
    for(const list of await mobileLists.all()) {
      expect(await list.locator('.taxpay-compact-cell-list__item').count()).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),
      'No full-page horizontal overflow on the phone').toBeLessThanOrEqual(2);
  }
});

test('same real profile components and shared transaction header use coherent 16px/400–600 roles',async ({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One source-backed preview across both locales');
  test.setTimeout(90000);
  for(const lang of ['en','bn']){
    await page.goto('/?action=account_profile&demoUser=user1&lang='+lang);
    const profile=page.getByTestId('user1-taxpayer-profile');
    await expect(profile).toBeVisible();
    const label=profile.locator('.taxpay-profile-field-label').first();
    const value=profile.locator('.taxpay-profile-field-value').first();
    const section=profile.locator('.taxpay-profile-section-heading').first();
    await expect(label).toBeVisible();
    await expect(value).toBeVisible();
    await expect(section).toBeVisible();
    const style=async (el:import('@playwright/test').Locator)=>el.evaluate(node=>{
      const s=getComputedStyle(node);return {size:parseFloat(s.fontSize),weight:Number(s.fontWeight)};
    });
    expect((await style(label)).size).toBe(16);
    expect((await style(value)).size).toBe(16);
    expect((await style(value)).weight).toBe(500);
    expect((await style(section)).weight).toBe(600);
    await page.goto('/?action=history&demoUser=user1&scenarioYear=2025-2026&lang='+lang);
    const register=page.getByTestId('taxpayer-transaction-table');
    await expect(register).toBeVisible();
    expect(await style(register.locator('thead th').first())).toEqual({size:16,weight:600});
    expect(await style(register.locator('tbody td').first())).toEqual({size:16,weight:400});
  }
});
