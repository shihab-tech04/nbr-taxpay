import {expect,test,type Page} from '@playwright/test';

/** All rows are synthetic, scope-limited test fixtures. No real taxpayer data. */
async function mockNotificationRegisters(page:Page){
  await page.addInitScript(()=>sessionStorage.setItem('taxpay-taxpayer-preview-user','user1'));
  await page.route('**/rest/v1/rpc/demo_story1_demo_history',async route=>{
    const rows=[{id:'p1',transactionId:'txn-user1-001',payer:'user1',state:'SIMULATED',
      createdAt:'2026-10-24T10:00:00Z',simulationOnly:true,totalMinor:234567,
      reviewStatus:'PENDING_OFFICER',allocations:[],events:[]}];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?**',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      success:true,data:[{id:'a1',payerId:'user1',taxpayerId:'user2',status:'ACTIVE',
        requestedAt:1793277508000}]
    })});
  });
}

for(const language of ['en','bn'] as const){
  test('notification registers preserve actions, filters, amounts and mobile containment in '+language,async({page},info)=>{
    await mockNotificationRegisters(page);
    await page.goto('/?action=notifications&lang='+language);
    const records=page.locator('table.taxpay-unified-table');
    await expect(records).toHaveCount(2);
    await expect(records.first().locator('tbody tr')).toHaveCount(1);
    await expect(records.last().locator('tbody tr')).toHaveCount(1);
    await expect(records.first().locator('thead th')).toHaveText(
      language==='bn'?['অনুমোদন','অবস্থা','অনুরোধের সময়','কার্যক্রম']
        :['Authorization','Status','Requested','Actions']);
    await expect(records.last().locator('thead th')).toHaveText(
      language==='bn'?['পেমেন্ট','রেফারেন্স','পরিমাণ','অবস্থা']
        :['Payment','Reference','Amount','Status']);
    await expect(page.getByText('৳2,345.67')).toBeVisible();
    await expect(records.first().getByRole('button',{name:language==='bn'?'অনুমোদন দেখুন':'Review authorization'})).toBeVisible();

    const authSearch=page.getByRole('searchbox',{name:language==='bn'?'অনুমোদন খুঁজুন':'Search authorizations'});
    await authSearch.fill('no-match-999');
    await expect(records).toHaveCount(1);
    await page.getByRole('button',{name:language==='bn'?'ফিল্টার মুছুন':'Clear filters'}).click();
    await expect(records).toHaveCount(2);

    const paymentSearch=page.getByRole('searchbox',{name:language==='bn'?'পেমেন্টের হালনাগাদ খুঁজুন':'Search payment updates'});
    await paymentSearch.fill('no-match-999');
    await expect(records).toHaveCount(1);
    await page.getByRole('button',{name:language==='bn'?'অনুসন্ধান মুছুন':'Clear search'}).click();
    await expect(records).toHaveCount(2);

    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    const desktop=info.project.name==='desktop-1280';
    if(desktop){
      await expect(records.first()).toBeVisible();
      await expect(records.first().locator('tbody tr td')).toHaveCount(4);
    }else{
      await expect(records.first()).toBeHidden();
      const cards=page.locator('.taxpay-mobile-table-cards:visible');
      await expect(cards).toHaveCount(2);
      await expect(cards.first().locator('li')).toHaveCount(1);
    }
  });
}
