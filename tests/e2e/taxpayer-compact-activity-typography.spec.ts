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


test('desktop table retains nine fields but keeps Payment and Actions visible while scrolling',async ({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Measured at real laptop widths with EN/BN');
  for(const lang of ['en','bn'] as const){
    await page.setViewportSize({width:1024,height:820});
    await page.goto('/?action=history&demoUser=user1&scenarioYear=2025-2026&lang='+lang);
    const table=page.getByTestId('taxpayer-transaction-table');
    const viewport=page.locator('.taxpayer-transaction-panel .taxpay-table-viewport');
    await expect(viewport).toBeVisible();
    await expect(table.locator('thead th')).toHaveCount(9);
    await expect(viewport).toHaveAttribute('tabindex','0');
    const geometry=await table.evaluate(t=>{
      const viewport=t.closest('.taxpay-table-viewport')!;
      const first=t.querySelector<HTMLElement>('thead [data-column-key="payment"]')!;
      const last=t.querySelector<HTMLElement>('thead [data-column-key="actions"]')!;
      const before=t.querySelector<HTMLElement>('tbody [data-column-key="payment"]')!;
      return {
        table:t.getBoundingClientRect().width,
        viewport:viewport.getBoundingClientRect().width,
        width:viewport.scrollWidth,
        paymentPosition:getComputedStyle(first).position,
        actionPosition:getComputedStyle(last).position,
        amountPosition:getComputedStyle(t.querySelector('thead [data-column-key="amount"]')!).position,
        statusPosition:getComputedStyle(t.querySelector('thead [data-column-key="status"]')!).position,
        paymentText:before.textContent||'',
      };
    });
    expect(geometry.table,'No oversized 1440px fixed minimum').toBeLessThanOrEqual(1300);
    expect(geometry.width).toBeGreaterThan(geometry.viewport);
    expect(geometry.paymentPosition).toBe('sticky');
    expect(geometry.actionPosition).toBe('sticky');
    expect(geometry.amountPosition).toBe('sticky');
    expect(geometry.statusPosition).toBe('sticky');
    expect(geometry.paymentText,'Reference has its own column; no duplicate identity').not.toMatch(/DEMO-PAY-|[0-9a-f]{8}-[0-9a-f]{4}/i);
    await viewport.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
    const edge=await table.evaluate(t=>{
      const pane=t.closest('.taxpay-table-viewport')!.getBoundingClientRect();
      const first=t.querySelector('tbody [data-column-key="payment"]')!.getBoundingClientRect();
      const last=t.querySelector('tbody [data-column-key="actions"]')!.getBoundingClientRect();
      const amount=t.querySelector('tbody [data-column-key="amount"]')!.getBoundingClientRect();
      const status=t.querySelector('tbody [data-column-key="status"]')!.getBoundingClientRect();
      return {start:first.left,end:last.right,paneStart:pane.left,paneEnd:pane.right,
        amountStart:amount.left,amountEnd:amount.right,statusStart:status.left,statusEnd:status.right,actionStart:last.left};
    });
    expect(edge.start).toBeGreaterThanOrEqual(edge.paneStart-2);
    expect(edge.end).toBeLessThanOrEqual(edge.paneEnd+2);
    expect(edge.amountEnd).toBeLessThanOrEqual(edge.statusStart+2);
    expect(edge.statusEnd).toBeLessThanOrEqual(edge.actionStart+2);
    expect(edge.amountStart).toBeGreaterThanOrEqual(edge.paneStart);
    await expect(table.locator('tbody [data-column-key="actions"] button').first()).toBeVisible();
    await expect(page.locator('.taxpay-register-scroll-note')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))
      .toBeLessThanOrEqual(2);
  }
});
