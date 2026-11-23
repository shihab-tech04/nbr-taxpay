import {expect,test} from '@playwright/test';
import {mockPublishedBannerCms} from './mock-published-banners';

test.beforeEach(async ({page}) => { await mockPublishedBannerCms(page); });

/** Exercise the actual signed-in, owner-scoped demo account; no financial writes. */
async function signIn(page:import('@playwright/test').Page) {
  await page.goto('/?action=taxpayer_login');
  await page.locator('#taxpayer-login-user-id').fill('user1');
  await page.locator('#taxpayer-login-password').fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page.locator('.taxpay-citizen-shell.taxpay-authenticated-content')).toBeVisible();
}

test('multi-recipient activity stays in bounded rows, exposes full detail in English and Bengali',async ({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Single browser checks desktop and phone widths');
  test.setTimeout(120000);
  await signIn(page);
  for(const lang of ['en','bn']){
    await page.setViewportSize({width:1280,height:900});
    await page.goto('/?action=history&scenarioYear=2025-2026&lang='+lang);
    const table=page.getByTestId('taxpayer-transaction-table');
    await expect(table).toBeVisible();
    const batchRow=table.locator('tbody tr:has(.taxpay-compact-cell-list__more)').first();
    await expect(batchRow,'Fixture must contain a multi-beneficiary transaction').toBeVisible();
    const cell=batchRow.getByTestId('transaction-beneficiaries');
    await expect(cell.locator('.taxpay-compact-cell-list__item')).toHaveCount(1);
    const disclosure=cell.locator('.taxpay-compact-cell-list__more');
    await expect(disclosure).toBeVisible();
    expect((await batchRow.boundingBox())?.height??999).toBeLessThan(220);
    await disclosure.click();
    const modal=page.getByRole('dialog').last();
    await expect(modal).toBeVisible();
    // Expand the original transaction, never silently discard any recipient.
    await expect(modal.getByText(/payment|কর|পরিশোধ/i).first()).toBeVisible();
    await page.goto('/?action=history&scenarioYear=2025-2026&lang='+lang);
    await page.setViewportSize({width:375,height:812});
    const mobile=page.getByTestId('taxpayer-transaction-mobile-cards');
    await expect(mobile).toBeVisible();
    const compact=mobile.locator('.taxpay-compact-cell-list__more').first();
    await expect(compact).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'No phone-wide horizontal overflow').toBeLessThanOrEqual(2);
  }
});

test('actual taxpayer profile and shared register render consistent 16px values, 600-weight headings',async ({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Checks both locales using the authenticated account');
  test.setTimeout(90000);
  await signIn(page);
  for(const lang of ['en','bn']){
    await page.goto('/?action=account_profile&lang='+lang);
    const profile=page.getByTestId('user1-taxpayer-profile');
    await expect(profile).toBeVisible();
    const label=profile.locator('.taxpay-profile-field-label').first();
    const value=profile.locator('.taxpay-profile-field-value').first();
    const section=profile.locator('.taxpay-profile-section-heading').first();
    await expect(label).toBeVisible();
    await expect(value).toBeVisible();
    await expect(section).toBeVisible();
    const read=async (selector:import('@playwright/test').Locator)=>selector.evaluate(el=>{
      const s=getComputedStyle(el);return {size:parseFloat(s.fontSize),weight:Number(s.fontWeight)};
    });
    expect((await read(label)).size).toBe(16);
    expect((await read(value)).size).toBe(16);
    expect((await read(value)).weight).toBe(500);
    expect((await read(section)).weight).toBe(600);
    await page.goto('/?action=history&scenarioYear=2025-2026&lang='+lang);
    const register=page.getByTestId('taxpayer-transaction-table');
    await expect(register).toBeVisible();
    expect((await read(register.locator('thead th').first())).size).toBe(16);
    expect((await read(register.locator('thead th').first())).weight).toBe(600);
    expect((await read(register.locator('tbody td').first())).size).toBe(16);
    expect((await read(register.locator('tbody td').first())).weight).toBe(400);
  }
});
