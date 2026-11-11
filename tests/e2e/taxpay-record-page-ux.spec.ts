import {expect,test} from '@playwright/test';

/** User-supplied taxpayer page screenshots: preserve all real actions while
 * ensuring search, case records and payment references have one readable layout.
 * These checks operate only on the isolated fictional User1 fixture. */
for (const language of ['en','bn'] as const) {
  const tr=(en:string,bengali:string)=>language==='bn'?bengali:en;
  test('corrections and payment records use a four-column shared grid in '+language,async({page},info)=>{
    const desktop=info.project.name==='desktop-1280';
    await page.goto('/?action=corrections&demoUser=user1&lang='+language);
    const cases=page.locator('[data-record-layout="exceptions"]');
    await expect(cases).toBeVisible();
    await expect(cases.locator('.taxpay-record-list__heading')).toHaveText([
      tr('Case','বিষয়'),tr('Recorded reason','নথিভুক্ত কারণ'),tr('Status','অবস্থা'),tr('Actions','কার্যক্রম')
    ]);
    await expect(cases.getByRole('row').nth(1)).toBeVisible();
    await expect(cases.getByRole('row').nth(1).locator('[data-record-column-label]')).toHaveText([
      tr('Case','বিষয়')+':',tr('Recorded reason','নথিভুক্ত কারণ')+':',
      tr('Status','অবস্থা')+':',tr('Actions','কার্যক্রম')+':'
    ]);
    const caseActionHeight=await cases.getByRole('row').nth(1).getByRole('button').first().evaluate(
      button=>button.getBoundingClientRect().height);
    expect(caseActionHeight).toBeGreaterThanOrEqual(44);
    await page.getByRole('searchbox',{name:tr('Search case references','বিষয়ের রেফারেন্স খুঁজুন')}).fill('zz-no-matches');
    await expect(cases).toHaveCount(0);
    await page.getByRole('button',{name:tr('Clear all','সব ফিল্টার মুছুন')}).click();
    await expect(cases.getByRole('row').nth(1)).toBeVisible();
    if(desktop){
      const columns=await cases.locator('.taxpay-record-list__row').first().evaluate(
        el=>getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length
      );
      expect(columns).toBe(4);
    }
    await cases.getByRole('button',{name:new RegExp(tr('View case details for ','বিষয়ের বিস্তারিত: '))}).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button',{name:tr('Close transaction details','লেনদেনের বিস্তারিত বন্ধ করুন')}).click();

    await page.goto('/?action=certificates&demoUser=user1&lang='+language);
    await expect(page.getByTestId('tax-credit-certificates').getByRole('heading',{name:tr('Tax Credit Certificates','কর ক্রেডিট সনদ')})).toBeVisible();
    const records=page.locator('[data-record-layout="documents"]');
    await expect(records).toBeVisible();
    await expect(records.locator('.taxpay-record-list__heading')).toHaveText([
      tr('Payment','পেমেন্ট'),tr('Reference','রেফারেন্স'),tr('Amount','পরিমাণ'),tr('Actions','কার্যক্রম')
    ]);
    await expect(records.getByRole('row').nth(1)).toBeVisible();
    await expect(records.getByRole('row').nth(1).locator('[data-record-column-label]')).toHaveText([
      tr('Payment','পেমেন্ট')+':',tr('Reference','রেফারেন্স')+':',
      tr('Amount','পরিমাণ')+':',tr('Actions','কার্যক্রম')+':'
    ]);
    await page.getByRole('searchbox',{name:tr('Search payment references','পেমেন্ট রেফারেন্স খুঁজুন')}).fill('zz-no-matches');
    await expect(records).toHaveCount(0);
    await page.getByRole('button',{name:tr('Clear search','অনুসন্ধান মুছুন')}).click();
    await expect(records.getByRole('row').nth(1)).toBeVisible();
    await records.getByRole('button',{name:new RegExp(tr('View payment details for ','পেমেন্টের বিস্তারিত: '))}).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('Transactions is the single signed-in payment search in '+language,async({page},info)=>{
    await page.goto('/?action=history&demoUser=user1&lang='+language+'&trackPayment=1');
    const nav=page.getByRole('navigation',{name:tr('Activity sections','লেনদেনের বিভাগ')});
    await expect(nav.getByRole('button',{name:tr('Track payment','পেমেন্ট অনুসন্ধান')})).toHaveCount(0);
    await expect(nav.getByRole('button',{name:tr('Transactions','লেনদেনসমূহ')})).toHaveAttribute('aria-current','page');
    await expect(page.locator('.taxpayer-transaction-panel')).toBeVisible();
    await expect(page.locator('.receipt-lookup')).toHaveCount(0);
    await expect(page.getByRole('combobox',{name:tr('Assessment year','করবর্ষ')})).toBeVisible();
    await expect(page.getByRole('searchbox',{name:tr('Search transaction reference','লেনদেন রেফারেন্স খুঁজুন')})).toBeVisible();
    await page.screenshot({path:'test-results/screenshots/taxpay-unified-transactions-'+language+'-'+info.project.name+'.png',fullPage:true});
    await page.goto('/?action=taxpayer_home&demoUser=user1&lang='+language);
    await expect(page.getByTestId('demo-sql-service-panel')).toHaveCount(0);
  });

}

test('desktop ledger never duplicates mobile cards under the table after changing filters',async({page})=>{
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=ledger&demoUser=user1&lang=en');
  const ledger=page.getByTestId('event-tax-ledger');
  await expect(ledger.locator('table.taxpay-unified-table')).toBeVisible();
  await expect(ledger.locator('.taxpay-mobile-table-cards')).toBeHidden();
  for(const filter of ['Liabilities','Credits','Payment lifecycle','Corrections','Refunds']){
    await ledger.getByRole('button',{name:filter,exact:true}).click();
    await expect(ledger.locator('table.taxpay-unified-table')).toBeVisible();
    await expect(ledger.locator('.taxpay-mobile-table-cards')).toBeHidden();
  }
});


/** A single compositional frame, not individual lookalike toolbars.
 * All four independently rendered financial registers must share the same
 * surface, header, filter/disclosure, row and footer contract at every viewport.
 */
for(const viewport of [{width:1280,height:900},{width:375,height:812}]){
  test('Office register frame is shared by the four Activity/Ledger routes at '+viewport.width+'px',async({page})=>{
    await page.setViewportSize(viewport);
    const observations:{route:string;radius:string;border:string;background:string}[]=[];
    for(const route of ['history','corrections','certificates','ledger']){
      await page.goto('/?action='+route+'&demoUser=user1&lang=en');
      const frame=page.locator('.taxpay-office-register-frame').first();
      await expect(frame).toBeVisible();
      await expect(frame.locator('.taxpay-office-register__toolbar')).toHaveCount(1);
      await expect(frame.locator('.taxpay-office-register__actions input[type="search"]')).toHaveCount(1);
      await expect(frame.locator('.taxpay-office-register__footer, .taxpay-table-pagination').first()).toBeVisible();
      if(route==='history'&&viewport.width===1280){
        const geometry=await frame.locator('.taxpay-table-viewport').evaluate(element=>{
          const frameBounds=element.getBoundingClientRect();
          const firstHeader=element.querySelector('thead th:first-child')?.getBoundingClientRect();
          const firstTitle=element.querySelector('tbody tr:first-child .taxpayer-transaction-row__title')?.getBoundingClientRect();
          const lastHeader=element.querySelector('thead th:last-child')?.getBoundingClientRect();
          if(!firstHeader||!firstTitle||!lastHeader)throw new Error('Missing seven-column transaction geometry');
          return {left:frameBounds.left,right:frameBounds.right,
            firstHeader:firstHeader.left,firstTitle:firstTitle.left,lastHeader:lastHeader.right,
            overflow:element.scrollWidth-element.clientWidth};
        });
        expect(geometry.firstHeader,'Payment column must not start left of the viewport').toBeGreaterThanOrEqual(geometry.left-1);
        expect(geometry.firstTitle,'Payment title must be fully visible').toBeGreaterThanOrEqual(geometry.left-1);
        expect(geometry.lastHeader,'Actions column must not be clipped').toBeLessThanOrEqual(geometry.right+2);
        expect(geometry.overflow,'1280px desktop register must fit all seven columns').toBeLessThanOrEqual(2);
      }
      const computed=await frame.evaluate(el=>{
        const s=getComputedStyle(el);
        return {radius:s.borderTopLeftRadius,border:s.borderTopWidth,background:s.backgroundColor};
      });
      observations.push({route,...computed});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow,route+' must not overflow the '+viewport.width+'px viewport').toBeLessThanOrEqual(2);
    }
    expect(new Set(observations.map(x=>x.radius)).size).toBe(1);
    expect(new Set(observations.map(x=>x.border)).size).toBe(1);
    expect(new Set(observations.map(x=>x.background)).size).toBe(1);
  });
}
