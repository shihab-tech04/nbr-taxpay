import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';
import {expect,test,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';

/** Same shared record model: four-column activity, two-column beneficiaries and ten-column ledger.
 * Verify computed visual tokens and capture real rendered EN/BN desktop/mobile
 * screenshots, not merely the presence of shared CSS class names.
 */
/** Visual-only test fixture. Production requires a backend-issued capability;
 * a synthetic local value here never grants SQL or payment permissions.
 */
async function installSyntheticPreviewFixture(page:Page,userId:'user1'|'user2',language:'en'|'bn'){
  await page.addInitScript(({id,lang})=>{
    sessionStorage.setItem('taxpay-taxpayer-preview-user',id);
    sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({
      profileId:id,
      capability:'A'.repeat(43),
      paymentSessionId:'00000000-0000-4000-8000-000000000099',
      selectedListId:null,
      language:lang
    }));
  },{id:userId,lang:language});
}

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
      const header=desktop?root.locator('table.taxpay-unified-table thead th').first():null;
      const row=desktop?root.locator('table.taxpay-unified-table tbody tr').first()
        :root.locator('.taxpay-mobile-table-card').first();
      await expect(row).toBeVisible();
      if(view==='history'&&desktop){
        await expect(root.getByTestId('taxpayer-transaction-table').locator('thead th')).toHaveCount(7);
        await expect(row.locator('td')).toHaveCount(7);
      }
      if(view==='history'&&!desktop){
        await expect(root.getByTestId('taxpayer-transaction-mobile-cards')).toBeVisible();
        await expect(row.getByRole('button',{name:/বিস্তারিত:|Details for/})).toBeVisible();
      }
      if(view==='beneficiaries'&&desktop){
        await expect(row.locator('td')).toHaveCount(2);
        await expect(row.locator('.beneficiary-directory__person .taxpayer-transaction-row__title'))
          .toHaveText('Visible Beneficiary · '+(language==='bn'?'ক্লায়েন্ট':'Clients'));
        await expect(row.locator('.beneficiary-directory__person .beneficiary-directory__tin'))
          .toHaveText('012345678901');
      }
      if(view==='beneficiaries'&&!desktop){
        await page.getByRole('button',{name:language==='en'?'Filter':'ফিল্টার',exact:true}).click();
        const context=page.locator('.beneficiary-directory__filters .beneficiary-directory__list-filter');
        const search=page.locator('.taxpay-office-register__actions .taxpay-record-toolbar__search');
        await expect(context.getByRole('button',{name:language==='en'?'Selected list':'নির্বাচিত তালিকা'})).toBeVisible();
        await expect(search.getByRole('searchbox')).toBeVisible();
        const [listBox,searchBox]=await Promise.all([context.boundingBox(),search.boundingBox()]);
        if(!listBox||!searchBox)throw Error('Missing list switch or shared search');
        expect(searchBox.width,'Search is usable at 375px').toBeGreaterThan(120);
        const filters=page.locator('.beneficiary-directory__filters');
        const tag=filters.locator('.beneficiary-directory__tag-filter');
        await expect(tag).toBeVisible();
        // The approved combined Tag + Relationship is still one grouped searchable selector.
        await chooseBeneficiaryOption(page,'beneficiary-filter-tag','friends_family:father');
        await expect(tag.locator('#beneficiary-filter-tag')).toHaveAttribute('data-value','friends_family:father');
        await expect(filters.locator('.beneficiary-directory__relationship-filter')).toHaveCount(0);
        await chooseBeneficiaryOption(page,'beneficiary-filter-tag','all');
        await expect(tag.locator('#beneficiary-filter-tag')).toHaveAttribute('data-value','all');
      }
      const style=await page.evaluate(({view,desktop})=>{
        const scope=view==='ledger'
          ?document.querySelector('[data-testid="event-tax-ledger"]')
          :view==='history'?document.querySelector('.taxpayer-transaction-panel')
          :document.querySelector('[data-testid="beneficiary-records"]');
        const head=desktop?scope?.querySelector('table.taxpay-unified-table thead th'):null;
        const record=desktop?scope?.querySelector('table.taxpay-unified-table tbody tr')
          :scope?.querySelector('.taxpay-mobile-table-card');
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
      if(desktop)expect(style.rowHeight,view+' row rhythm').toBeGreaterThanOrEqual(view==='history'?64:76);
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
    await installSyntheticPreviewFixture(page,'user1',language);
    await page.route('**/functions/v1/demo-story1-taxpay/profile-history?**',async route=>{
      const view=new URL(route.request().url()).searchParams.get('view');
      const rows=[
        {id:'p1',transactionId:'txn-user1-001',payer:'user1',state:'SIMULATED',
         createdAt:'2026-10-24T10:00:00Z',simulationOnly:true,totalMinor:234567,
         reviewStatus:'PENDING_OFFICER',allocations:[],events:[]}
      ];
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        success:true,simulationOnly:true,data:view==='payer'?rows:[]
      })});
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
  test('signed-in preview Transactions shows Convay columns and complete details in '+language,async({page},info)=>{
    await installSyntheticPreviewFixture(page,'user2',language);
    await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
    await page.route('**/functions/v1/demo-story1-taxpay/profile-history?**',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify({success:true,simulationOnly:true,data:[{
        id:'EXAMPLE-USER2-1',transactionId:'00000000-0000-4000-8000-000000000121',
        payer:'user2',state:'SIMULATED',createdAt:'2026-10-24T10:00:00Z',
        simulationOnly:true,totalMinor:5000,reviewStatus:'PENDING_OFFICER',
        allocations:[
          {id:'a1',lineNo:1,beneficiary:'user2',category:'TAX_WITH_RETURN',assessmentYear:'2026-27',amountMinor:1500},
          {id:'a2',lineNo:2,beneficiary:'user3',category:'ADVANCE_TAX',assessmentYear:'2025-26',amountMinor:3500}
        ],events:[{id:1,action:'CREATED',note:'Payment record saved',occurredAt:'2026-10-24T10:00:00Z'}]
      }]})
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
      await expect(table.locator('thead th')).toHaveText(language==='bn'
        ? ['রেফারেন্স','তারিখ','প্রদানকারী','বরাদ্দ','পরিমাণ','অবস্থা','কার্যক্রম']
        : ['Reference','Date','Payer','Allocations','Amount','Status','Actions']);
      await expect(table.locator('tbody tr')).toHaveCount(1);
      await expect(cards).toBeHidden();
      await table.getByText(expand).click();
      await expect(table.getByText('৳35.00',{exact:true})).toBeVisible();
      await table.locator('tbody td').first().click();
    }else{
      await expect(table).toBeHidden();
      await expect(cards).toBeVisible();
      await expect(cards.locator(':scope > li')).toHaveCount(1);
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


test('Office-style record workspaces fill laptop width without hiding transaction columns',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop laptop register geometry');
  for(const view of ['beneficiaries','history','ledger'] as const){
    if(view==='beneficiaries')await beneficiaryFixture(page);
    await page.goto('/?action='+view+'&demoUser=user1&lang=en');
    const workspace=page.locator('[data-taxpay-register-page="true"]').first();
    await expect(workspace).toBeVisible();
    const dimensions=await workspace.evaluate(element=>({
      width:element.getBoundingClientRect().width,
      right:element.getBoundingClientRect().right,
      screenWidth:window.innerWidth
    }));
    expect(dimensions.width,view+' must use available desktop workspace').toBeGreaterThan(940);
    expect(dimensions.right,view+' stays within viewport').toBeLessThanOrEqual(dimensions.screenWidth+1);
    if(view==='beneficiaries'){
      const actionCell=page.getByTestId('beneficiary-records').locator('tbody tr').first().locator('td:nth-child(2)');
      const buttons=actionCell.getByRole('button');
      await expect(buttons).toHaveCount(2);
      const tops=await buttons.evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().top)));
      expect(Math.max(...tops)-Math.min(...tops),'Beneficiary actions should fit one desktop row').toBeLessThanOrEqual(8);
    }
    if(view==='history'){
      const table=page.locator('.taxpayer-transaction-panel table.taxpayer-transaction-table');
      await expect(table.locator('thead th')).toHaveCount(7);
      for(const header of await table.locator('thead th').all())await expect(header).toBeVisible();
      const meta=page.locator('.taxpayer-transaction-panel .taxpayer-transaction-compact-meta').first();
      await expect(meta).toBeHidden();
      const viewport=page.locator('.taxpayer-transaction-panel .taxpay-table-viewport');
      const action=table.locator('tbody tr').first().locator('td:last-child button');
      const [windowBox,actionBox]=await Promise.all([viewport.boundingBox(),action.boundingBox()]);
      expect(windowBox).not.toBeNull();expect(actionBox).not.toBeNull();
      expect(actionBox!.x+actionBox!.width,'Transaction actions stay on-screen without horizontal scrolling')
        .toBeLessThanOrEqual(windowBox!.x+windowBox!.width+2);
    }
    const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(horizontalOverflow,view+' must not overflow document').toBeLessThanOrEqual(2);
  }
});
