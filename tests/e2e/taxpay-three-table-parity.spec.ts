import {expect,test,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';

/** Same record model: four-column activity and beneficiaries; ten-column ledger.
 * Verify computed visual tokens and capture real rendered EN/BN desktop/mobile
 * screenshots, not merely the presence of shared CSS class names.
 */
async function beneficiaryFixture(page:Page){
  const timestamp='2026-11-01T00:00:00Z';
  await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',route=>{
    const action=(route.request().postDataJSON() as {action?:string}).action;
    const data=action==='open'?{active:true}:action==='lists'
      ?[{id:'00000000-0000-4000-8000-000000000101',name:'Clients',created_at:timestamp}]
      :action==='people'?[{id:'00000000-0000-4000-8000-000000000201',
        list_id:'00000000-0000-4000-8000-000000000101',tin:'012345678901',
        display_name:'Visible Beneficiary',tag:'clients',relationship:null,other_label:null,
        created_at:timestamp,updated_at:timestamp}]:[];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
}
for(const language of ['en','bn'] as const){
  test('three screenshot-reported tables use matching rendered tokens in '+language,async({page},info)=>{
    const desktop=info.project.name==='desktop-1280';
    const observations: {view:string;background:string;fontSize:string;color:string;borderRadius:string,rowHeight:number}[]=[];
    for(const view of ['ledger','history','beneficiaries'] as const){
      if(view==='beneficiaries')await beneficiaryFixture(page);
      await page.goto('/?action='+view+'&demoUser=user1&lang='+language);
      const root=view==='ledger'
        ?page.getByTestId('event-tax-ledger')
        :view==='history'?page.locator('.taxpayer-transaction-panel')
        :page.getByTestId('beneficiary-records');
      await expect(root).toBeVisible();
      const header=desktop?(view==='ledger'||view==='beneficiaries'
        ?root.locator('table.taxpay-unified-table thead th').first()
        :root.locator('.taxpay-record-list__columns'))
        :null;
      const row=desktop?(view==='ledger'||view==='beneficiaries'
        ?root.locator('table.taxpay-unified-table tbody tr').first()
        :root.locator('.taxpay-record-list__row').first())
        :(view==='ledger'||view==='beneficiaries'
          ?root.locator('.taxpay-mobile-table-card').first()
          :root.locator('.taxpay-record-list__row').first());
      await expect(row).toBeVisible();
      if(view==='history'){
        await expect(row.locator('[data-record-column-label]')).toHaveCount(4);
        await expect(row.locator('[data-record-column-label]').first()).toContainText(language==='bn'?'পেমেন্ট':'Payment');
      }
      if(view==='beneficiaries'&&desktop)await expect(row.locator('td')).toHaveCount(4);
      if(view==='beneficiaries'&&!desktop)await expect(row).toContainText(language==='bn'?'টিআইএন':'TIN');
      if(!desktop&&view==='ledger'){
        const nested=await row.locator('button').first().evaluate(element=>({
          borderTopWidth:getComputedStyle(element).borderTopWidth,
          paddingLeft:getComputedStyle(element).paddingLeft,
          minHeight:element.getBoundingClientRect().height
        }));
        expect(nested.borderTopWidth,'mobile ledger must not double-border a card').toBe('0px');
        expect(nested.paddingLeft,'mobile ledger must not double-inset a card').toBe('0px');
        expect(nested.minHeight).toBeGreaterThanOrEqual(44);
        const panel=await root.locator('.taxpay-ledger-records').evaluate(element=>({
          borderTopWidth:getComputedStyle(element).borderTopWidth,
          background:getComputedStyle(element).backgroundColor,
          viewportBorder:getComputedStyle(element.querySelector('.taxpay-table-viewport')!).borderTopWidth
        }));
        expect(panel.borderTopWidth,'mobile ledger list should not double-wrap cards').toBe('0px');
        expect(panel.viewportBorder,'mobile ledger viewport should not frame cards').toBe('0px');
      }
      if(header)await expect(header).toBeVisible();
      if(view==='ledger') {
        const ledgerMobileList=root.locator('.taxpay-mobile-table-cards');
        const ledgerDesktopTable=root.locator('table.taxpay-unified-table');
        if(desktop){
          await expect(ledgerMobileList).toBeHidden();
          await expect(ledgerDesktopTable).toBeVisible();
        } else {
          await expect(ledgerMobileList).toBeVisible();
          await expect(ledgerDesktopTable).toBeHidden();
        }
      }
      if(view==='beneficiaries'&&!desktop){
        const filters=page.locator('.beneficiary-directory__filters');
        const list=filters.locator('.beneficiary-directory__list-filter');
        const tag=filters.locator('.beneficiary-directory__tag-filter');
        const search=filters.locator('.beneficiary-directory__search-filter');
        const [listBox,tagBox,searchBox]=await Promise.all([list.boundingBox(),tag.boundingBox(),search.boundingBox()]);
        if(!listBox||!tagBox||!searchBox)throw Error('Missing beneficiary mobile filters');
        expect(Math.abs(tagBox.y-searchBox.y),'Tag and Search share a row').toBeLessThanOrEqual(3);
        expect(listBox.y+listBox.height,'Selected list precedes Tag and Search').toBeLessThanOrEqual(tagBox.y);
        expect(searchBox.width,'Search is usable at 375px').toBeGreaterThan(120);
        await tag.locator('select').selectOption('friends_family');
        const relationship=filters.locator('.beneficiary-directory__relationship-filter');
        await expect(relationship).toBeVisible();
        const relationBox=await relationship.boundingBox();
        if(!relationBox)throw Error('Relationship filter is missing');
        expect(relationBox.y,'Relationship follows Tag/Search row').toBeGreaterThan(tagBox.y+tagBox.height-2);
        await tag.locator('select').selectOption('all');
        await expect(relationship).toHaveCount(0);
      }
      const style=await page.evaluate(({view,desktop})=>{
        const scope=view==='ledger'
          ?document.querySelector('[data-testid="event-tax-ledger"]')
          :view==='history'?document.querySelector('.taxpayer-transaction-panel')
          :document.querySelector('[data-testid="beneficiary-records"]');
        const semantic=view==='ledger'||view==='beneficiaries';
        const head=desktop?(semantic
          ?scope?.querySelector('table.taxpay-unified-table thead th')
          :scope?.querySelector('.taxpay-record-list__columns')):null;
        const record=desktop?(semantic
          ?scope?.querySelector('table.taxpay-unified-table tbody tr')
          :scope?.querySelector('.taxpay-record-list__row'))
          :semantic?scope?.querySelector('.taxpay-mobile-table-card')
          :scope?.querySelector('.taxpay-record-list__row');
        if(!record||(desktop&&!head))throw Error('Missing rendered '+view+' grid');
        const h=head?getComputedStyle(head):null;
        const r=getComputedStyle(record);
        return {
          background:h?.backgroundColor??r.backgroundColor,
          fontSize:h?.fontSize??r.fontSize,
          color:h?.color??r.color,
          borderRadius:desktop?'desktop':r.borderTopLeftRadius,
          rowHeight:record.getBoundingClientRect().height,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
        };
      },{view,desktop});
      expect(style.overflow,view+' horizontal overflow').toBeLessThanOrEqual(2);
      const textSize=await row.evaluate(element=>{
        const cell=element.matches('tr')?element.querySelector('td'):element;
        return parseFloat(getComputedStyle(cell??element).fontSize);
      });
      expect(textSize,view+' primary record typography').toBeGreaterThanOrEqual(16);
      if(desktop)expect(style.rowHeight,view+' row rhythm').toBeGreaterThanOrEqual(76);
      else expect(style.borderRadius,view+' card corners').not.toBe('0px');
      observations.push({view,background:style.background,fontSize:style.fontSize,
        color:style.color,borderRadius:style.borderRadius,rowHeight:style.rowHeight});
      // Capture the actual table rows, not just the top of a long mobile page.
      await row.scrollIntoViewIfNeeded();
      const output='test-results/screenshots';
      mkdirSync(output,{recursive:true});
      await page.screenshot({path:output+'/taxpay-unified-'+view+'-'+language+'-'+info.project.name+'.png',
        fullPage:false,animations:'disabled'});
    }
    if(desktop){
      expect(new Set(observations.map(o=>o.background)).size,'Header background parity').toBe(1);
      expect(new Set(observations.map(o=>o.fontSize)).size,'Header typography parity').toBe(1);
      expect(new Set(observations.map(o=>o.color)).size,'Header text-color parity').toBe(1);
    }else{
      expect(new Set(observations.map(o=>o.borderRadius)).size,'Mobile card radius parity').toBe(1);
    }
  });
}


/** Screenshots of real notification rows complete the same three-table visual evidence. */
for(const language of ['en','bn'] as const){
  test('notification record rows share the same four-column header and mobile card contract in '+language,async({page},info)=>{
    await page.addInitScript(()=>sessionStorage.setItem('taxpay-taxpayer-preview-user','user1'));
    await page.route('**/rest/v1/rpc/demo_story1_demo_history',async route=>{
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
        {id:'p1',transactionId:'txn-user1-001',payer:'user1',state:'SIMULATED',
         createdAt:'2026-10-24T10:00:00Z',simulationOnly:true,totalMinor:234567,
         reviewStatus:'PENDING_OFFICER',allocations:[],events:[]}
      ])});
    });
    await page.route('**/functions/v1/demo-story1-taxpay/authorizations?**',async route=>{
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[
        {id:'a1',payerId:'user1',taxpayerId:'user2',status:'ACTIVE',requestedAt:1793277508000}
      ]})});
    });
    await page.goto('/?action=notifications&lang='+language);
    const tables=page.locator('table.taxpay-unified-table');
    await expect(tables).toHaveCount(2);
    const desktop=info.project.name==='desktop-1280';
    const expectedHead=language==='bn'?['অনুমোদন','অবস্থা','অনুরোধের সময়','কার্যক্রম']
       :['Authorization','Status','Requested','Actions'];
    await expect(tables.first().locator('thead th')).toHaveText(expectedHead);
    await expect(tables.first().locator('tbody tr td')).toHaveCount(4);
    const row=desktop?tables.first().locator('tbody tr').first()
      :page.locator('ul.taxpay-mobile-table-cards:visible > li').first();
    await expect(row).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    if(desktop){
      await expect(tables.first()).toBeVisible();
      expect(await row.evaluate(element=>element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(76);
    } else {
      await expect(tables.first()).toBeHidden();
      await expect(page.locator('ul.taxpay-mobile-table-cards:visible')).toHaveCount(2);
    }
    await row.scrollIntoViewIfNeeded();
    mkdirSync('test-results/screenshots',{recursive:true});
    await page.screenshot({path:'test-results/screenshots/taxpay-unified-notifications-'+language+'-'+info.project.name+'.png',
      fullPage:false,animations:'disabled'});
  });
}

for(const language of ['en','bn'] as const){
  test('signed-in preview Transactions keeps four columns and complete details in '+language,async({page},info)=>{
    await page.addInitScript(()=>sessionStorage.setItem('taxpay-taxpayer-preview-user','user2'));
    await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
    await page.route('**/rest/v1/rpc/demo_story1_demo_history',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify([{
        id:'EXAMPLE-USER2-1',transactionId:'00000000-0000-4000-8000-000000000121',
        payer:'user2',state:'SIMULATED',createdAt:'2026-10-24T10:00:00Z',
        simulationOnly:true,totalMinor:5000,reviewStatus:'PENDING_OFFICER',
        allocations:[
          {id:'a1',lineNo:1,beneficiary:'user2',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:1500},
          {id:'a2',lineNo:2,beneficiary:'user3',category:'ADVANCE_TAX',assessmentYear:'2025-26',amountMinor:3500}
        ],events:[{id:1,action:'CREATED',note:'Payment record saved',occurredAt:'2026-10-24T10:00:00Z'}]
      }])
    }));
    await page.route('**/functions/v1/demo-story1-taxpay/authorizations?**',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[]})
    }));
    await page.goto('/?action=history&lang='+language);
    const panel=page.getByTestId('signed-in-payment-activity');
    await expect(panel).toBeVisible();
    const desktop=info.project.name==='desktop-1280';
    const table=panel.getByTestId('signed-in-payment-activity-table');
    const cards=panel.getByTestId('signed-in-payment-activity-cards');
    const expand=language==='bn'?'বরাদ্দ দেখুন':'View allocations';
    if(desktop){
      await expect(table).toBeVisible();
      await expect(table.locator('thead th')).toHaveCount(4);
      await expect(table.locator('tbody tr')).toHaveCount(1);
      await expect(cards).toBeHidden();
      await table.getByText(expand).click();
      await expect(table.getByText('৳35.00',{exact:true})).toBeVisible();
      await table.locator('tbody td').first().click();
    }else{
      await expect(table).toBeHidden();
      await expect(cards).toBeVisible();
      await expect(cards.locator('li')).toHaveCount(1);
      await expect(cards.getByText(language==='bn'?'মোট: ৳50.00':'Total: ৳50.00',{exact:true})).toBeVisible();
      await cards.getByText(expand).click();
      await expect(cards.getByText('৳35.00',{exact:true})).toBeVisible();
      await cards.getByRole('button',{name:language==='bn'?'বিস্তারিত দেখুন':'View details'}).click();
    }
    const modal=page.getByRole('dialog',{name:language==='bn'?'পেমেন্টের বিবরণ':'Payment details'});
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('EXAMPLE-USER2-1');
    await expect(modal).toContainText('user3');
    await expect(modal).toContainText('CREATED');
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
}
