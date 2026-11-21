import { expect, test } from '@playwright/test';
import { enterTaxPayService, openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

/** Live-approved TIN lookup: viewport geometry, keyboard, locale, and privacy.
 * Geometry is checked on rendered pixels, not source CSS or presence of 12 spans.
 * Hosted tax, payment and Office data are never written by these checks.
 */
for (const width of [320, 375, 390, 420, 480, 650, 768, 1280, 1920]) {
  test(`legacy guest TIN boxes stay usable at ${width}px`, async ({page}, info) => {
    test.skip(info.project.name !== 'desktop-1280', 'One controlled viewport matrix only');
    await page.setViewportSize({width,height:900});
    await page.goto('/?action=landing&lang=en');
    const dialog = await openLegacyTaxServiceChoice(page);
    await enterTaxPayService(dialog, 'TAX_WITH_RETURN');
    const lookup = dialog.getByTestId('shared-taxpayer-tin-lookup');
    const cells = lookup.getByTestId('taxpayer-tin-digits').locator('span');
    await expect(cells).toHaveCount(12);
    const action = lookup.getByRole('button',{name:'Search',exact:true});
    await expect(action).toBeVisible();
    await expect(action).toHaveCSS('border-top-width','1px');
    await expect(action).toHaveCSS('background-color','rgb(245, 246, 248)');

    const geometry = await lookup.evaluate(root => {
      const digitRoot = root.querySelector<HTMLElement>('[data-testid="taxpayer-tin-digits"]');
      const slots = Array.from(digitRoot?.querySelectorAll<HTMLElement>('span')??[]);
      const search = root.querySelector<HTMLElement>('button.taxpayer-tin-lookup__search');
      const digitBox = digitRoot?.getBoundingClientRect();
      const searchBox = search?.getBoundingClientRect();
      const host = root.closest<HTMLElement>('.taxpay-modal__body');
      return {
        smallestCell:Math.min(...slots.map(cell => cell.getBoundingClientRect().width)),
        digitsBottom:digitBox?.bottom??0,
        searchTop:searchBox?.top??0,
        digitsWidth:digitBox?.width??0,
        bodyOverflow:host ? host.scrollWidth-host.clientWidth : 0,
      };
    });
    if(width<=420) expect(geometry.smallestCell,'Mobile TIN cells must not collapse').toBeGreaterThanOrEqual(20);
    if(width<=650) expect(geometry.searchTop,'Search must sit below all digit slots').toBeGreaterThanOrEqual(geometry.digitsBottom-2);
    expect(geometry.bodyOverflow,'No TIN-induced modal horizontal overflow').toBeLessThanOrEqual(2);
    const input = lookup.locator('input#guest-tin');
    await input.fill('33333333333');
    await expect(action).toBeDisabled();
    await input.fill('333333333333');
    await expect(action).toBeEnabled();
    await action.click();
    const card = lookup.getByTestId('searched-taxpayer-card');
    await expect(card).toContainText('333*********');
    await expect(card).not.toContainText('333333333333');
    await expect(card.getByRole('button',{name:/copy/i})).toHaveCount(0);
    await expect(card.getByRole('button',{name:'Reveal TIN'})).toBeVisible();
  });
}

for(const locale of ['en','bn'] as const) {
  test(`All Tax Payments reuses legible mobile search and masked result (${locale})`,async ({page},info)=>{
    test.skip(info.project.name !== 'desktop-1280');
    await page.setViewportSize({width:375,height:812});
    await page.goto('/?action=landing&lang='+locale);
    await page.locator('.public-benefits__item[data-benefit="payments"]').click();
    const modal=page.getByRole('dialog',{name:locale==='bn'?'কর পরিশোধ':'Pay Tax'});
    await modal.getByRole('button',{name:locale==='bn'?'ওয়াক-ইন পেমেন্ট':'Walk-in Payment'}).click();
    const lookup=modal.getByTestId('shared-taxpayer-tin-lookup');
    const input=lookup.getByTestId('unified-tin-input');
    await input.fill('333333333333');
    const boxes=lookup.getByTestId('unified-v5-tin-blocks').locator('span');
    await expect(boxes).toHaveCount(12);
    const bottom=await lookup.getByTestId('unified-v5-tin-blocks').boundingBox();
    const search=lookup.getByRole('button',{name:locale==='bn'?'করদাতার টিআইএন অনুসন্ধান':'Search taxpayer TIN'});
    const action=await search.boundingBox();
    expect(bottom&&action).toBeTruthy();
    expect(action!.y).toBeGreaterThanOrEqual(bottom!.y+bottom!.height-2);
    await search.click();
    const result=modal.getByTestId('unified-taxpayer-search-result');
    await expect(result).toContainText('333*********');
    await expect(result.getByRole('button',{name:/copy|কপি/i})).toHaveCount(0);
    await expect(modal.getByRole('button',{name:locale==='bn'?'করদাতা যোগ করুন':'Add taxpayer'})).toBeVisible();
  });
}
