import {chooseBeneficiaryOption} from './beneficiarySearchableSelect';
import {test,expect,type Page} from '@playwright/test';

/** A self-contained signed-in UI fixture; no production taxpayer or SQL records are used. */
async function mountBeneficiaryLists(page:Page){
  const now='2026-11-01T00:00:00.000Z';
  const lists=[
    {id:'00000000-0000-4000-8000-000000000101',name:'Clients',created_at:now},
    {id:'00000000-0000-4000-8000-000000000102',name:'Family Member',created_at:now},
  ];
  const people=[
    {id:'00000000-0000-4000-8000-000000000201',list_id:lists[0].id,tin:'123456789012',display_name:'Shihab',tag:'others',relationship:null,other_label:'Neighbour',created_at:now,updated_at:now},
    {id:'00000000-0000-4000-8000-000000000202',list_id:lists[0].id,tin:'222222222222',display_name:'User2',tag:'clients',relationship:null,other_label:null,created_at:now,updated_at:now},
  ];
  await page.route('**/auth/v1/user',route=>route.fulfill({
    status:401,contentType:'application/json',body:JSON.stringify({message:'No session'})
  }));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',route=>{
    const body=route.request().postDataJSON() as {action?:string;offset?:number;limit?:number;userId?:string;password?:string};
    const demoSession={profileId:'user1',capability:'A'.repeat(43),paymentSessionId:'00000000-0000-4000-8000-000000000777',language:'en',selectedListId:null};
    if(body.action==='demo-login'&&(body.userId!=='user1'||body.password!=='user1'))
      return route.fulfill({status:401,contentType:'application/json',body:'{"success":false,"code":"INVALID_DEMO_LOGIN"}'});
    const data=body.action==='demo-login'?demoSession
      :body.action==='demo-settings'?{language:'en',selectedListId:null,paymentSessionId:demoSession.paymentSessionId}
      :body.action==='open'?{active:true}
      :body.action==='lists'?lists
      :body.action==='people'?people.slice(body.offset??0,(body.offset??0)+(body.limit??500))
      :[];
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,data})});
  });
}

for(const language of ['en','bn'] as const){
  test(`Beneficiaries matches Activity card/filter/record design in ${language} on desktop and mobile`,async({page})=>{
    await mountBeneficiaryLists(page);
    await page.goto('/?action=beneficiaries&demoUser=user1&lang='+language);
    const bn=language==='bn';
    const t=(en:string,bengali:string)=>bn?bengali:en;
    const screen=page.getByTestId('beneficiaries-page');
    await expect(screen).toBeVisible();
    // A saved-list preview must not inject an unsolicited account sign-in banner.
    // The existing entry-point/authentication flows remain unchanged elsewhere.
    await expect(screen.getByTestId('beneficiaries-account-sync')).toHaveCount(0);
    await expect(screen.getByText(t('For lists across devices, use your email account.',
      'সব ডিভাইসে একই তালিকা পেতে ইমেইল অ্যাকাউন্ট ব্যবহার করুন।'))).toHaveCount(0);
    await expect(screen.getByRole('button',{name:t('Sign in with email','ইমেইল দিয়ে সাইন ইন')})).toHaveCount(0);
    await expect(screen.getByRole('heading',{level:1,name:t('Beneficiaries','উপকারভোগী')})).toBeVisible();
    await expect(screen.getByRole('heading',{level:2,name:t('Beneficiary list','উপকারভোগীর তালিকা')})).toBeVisible();
    await screen.getByRole('button',{name:t('Filter','ফিল্টার'),exact:true}).click();
    const filters=screen.locator('.taxpayer-transaction-filters.beneficiary-directory__filters');
    await expect(filters).toBeVisible();
    const selectList=screen.getByRole('button',{name:t('Selected list','নির্বাচিত তালিকা')});
    await expect(selectList).toContainText(t('All beneficiaries','সব উপকারভোগী'));
    await selectList.click();
    await expect(page.getByRole('dialog',{name:t('Choose beneficiary list','উপকারভোগীর তালিকা বাছুন')}).getByRole('button',{name:t('All beneficiaries','সব উপকারভোগী')})).toBeVisible();
    await selectList.click();
    const search=screen.getByRole('searchbox',{name:t('Search this list','এই তালিকায় খুঁজুন')});
    await expect(search).toBeVisible();
    // The shared search is a single 44px control, not a labelled vertical
    // stack. Verify actual EN/BN rendered geometry on 320/375/desktop.
    const toolbar=screen.locator('.beneficiary-register-frame > .taxpay-office-register__toolbar');
    const field=toolbar.locator('.taxpay-record-toolbar__search');
    const filter=toolbar.getByRole('button',{name:t('Filter','ফিল্টার'),exact:true});
    const geometry=await toolbar.evaluate(el=>{
      const field=el.querySelector<HTMLElement>('.taxpay-record-toolbar__search')!;
      const input=field.querySelector('input')!;
      const icon=field.querySelector('svg')!;
      const filter=el.querySelector<HTMLElement>('.taxpay-office-filter-toggle')!;
      const label=el.querySelector<HTMLElement>('.taxpay-office-register__search-label')!;
      const rect=(node:Element)=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};};
      return {field:rect(field),input:rect(input),icon:rect(icon),filter:rect(filter),label:rect(label),toolbar:rect(el),
        inputFont:getComputedStyle(input).fontSize,inputBorder:getComputedStyle(input).borderTopWidth};
    });
    expect(geometry.label.height).toBeLessThanOrEqual(1);
    expect(geometry.field.height).toBeCloseTo(44,0);
    expect(geometry.filter.height).toBeCloseTo(44,0);
    if(page.viewportSize()!.width>=768){
      expect(Math.abs(geometry.field.y-geometry.filter.y)).toBeLessThanOrEqual(2);
      expect(geometry.field.right).toBeLessThanOrEqual(geometry.filter.x-6);
    }else{
      expect(geometry.filter.y).toBeGreaterThanOrEqual(geometry.field.y+geometry.field.height+6);
      expect(Math.abs(geometry.field.x-geometry.filter.x)).toBeLessThanOrEqual(2);
    }
    expect(geometry.field.width).toBeGreaterThanOrEqual(page.viewportSize()!.width>=1180?240:200);
    expect(Math.abs(geometry.icon.y+geometry.icon.height/2-(geometry.input.y+geometry.input.height/2))).toBeLessThanOrEqual(2);
    expect(geometry.inputFont).toBe('16px');
    expect(geometry.inputBorder).toBe('0px');
    expect(geometry.filter.right).toBeLessThanOrEqual(geometry.toolbar.right+1);
    await search.focus();
    await expect(field).toHaveCSS('outline-style','solid');
    await expect(filter).toHaveAttribute('aria-expanded','true');
    await search.fill('222222222222');
    await expect(screen.locator('.taxpay-office-register__count')).toContainText('1 / 2');
    await search.fill('');
    await expect(screen.locator('.taxpay-office-register__count')).toContainText('2');
    const directory=screen.getByTestId('beneficiary-records');
    await expect(directory).toBeVisible();
    // Same compact heading + Search + Filter layout as Transaction History.
    // The selected list belongs in the filter panel, not the toolbar.
    if(page.viewportSize()!.width>=1180){
      const toolbar=screen.locator('.beneficiary-register-frame > .taxpay-office-register__toolbar');
      const bounds=await toolbar.boundingBox();
      expect(bounds?.height,'Beneficiaries toolbar must match compact Transaction History height').toBeLessThanOrEqual(90);
      await expect(toolbar.getByRole('button',{name:t('Selected list','নির্বাচিত তালিকা')})).toHaveCount(0);
      await expect(filters.getByRole('button',{name:t('Selected list','নির্বাচিত তালিকা')})).toBeVisible();
      await expect(screen.locator('.beneficiary-register-frame > .beneficiary-directory__count')).toBeHidden();
      await expect(directory.locator('thead').getByRole('checkbox',{
        name:t('Select all visible beneficiaries','দেখানো সব উপকারভোগী নির্বাচন')})).toBeVisible();
    }
    const rows=directory.locator('table.taxpay-unified-table tbody tr:visible, ul.taxpay-mobile-table-cards:visible > li');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Shihab');
    await expect(rows.first()).toContainText('123*********');
    await expect(rows.first()).toContainText('Neighbour');
    await expect(screen.locator('.beneficiary-directory__table.taxpay-data-table')).toBeVisible();
    const theme=await screen.locator('.beneficiary-directory__table').evaluate(el=>{
      const header=el.querySelector('table.taxpay-unified-table thead th');
      const row=el.querySelector('table.taxpay-unified-table tbody tr')||el.querySelector('ul.taxpay-mobile-table-cards li');
      return {borderRadius:getComputedStyle(el).borderRadius,
        headerMinHeight:header?header.getBoundingClientRect().height:0,
        rowBackground:row?getComputedStyle(row).backgroundColor:'transparent'};
    });
    expect(theme.borderRadius).not.toBe('0px');
    // Hidden desktop <thead> has zero layout height at mobile widths.
    // Assert the shared header on desktop, and the record-card touch targets on mobile.
    if(page.viewportSize()!.width>=768)expect(theme.headerMinHeight).toBeGreaterThanOrEqual(44);
    else {
      const paymentButton=rows.first().getByRole('button',{name:t('Make payment','পেমেন্ট করুন')});
      const actionGroup=rows.first().locator('.taxpay-mobile-table-card__actions');
      const [buttonBox,groupBox]=await Promise.all([paymentButton.boundingBox(),actionGroup.boundingBox()]);
      expect(buttonBox?.height,'Mobile beneficiary actions keep a comfortable tap target').toBeGreaterThanOrEqual(48);
      expect(buttonBox&&groupBox&&buttonBox.x>=groupBox.x-1&&buttonBox.x+buttonBox.width<=groupBox.x+groupBox.width+1,
        'Mobile payment action remains inside its card').toBe(true);
      await expect(paymentButton.locator('svg')).toHaveCSS('width','20px');
    }
    expect(theme.rowBackground).not.toBe('transparent');
    const editAction=rows.first().getByRole('button',{name:t('Edit','সম্পাদনা'),exact:true});
    await expect(editAction).toBeVisible();
    if(page.viewportSize()!.width>=768){
      await expect(editAction,'Edit must be an outlined secondary action, not a text link')
        .toHaveCSS('border-top-width','1px');
    }
    await expect(rows.first().getByRole('button',{name:t('Make payment','পেমেন্ট করুন')})).toBeVisible();
    await expect(rows.first().getByRole('button',{name:t('Remove Shihab','Shihab সরান')})).toHaveCount(0);
    await expect(rows.first().locator('button')).toHaveCount(2);
    const layout=await page.evaluate(()=>{
      const wrapper=document.querySelector('[data-testid="beneficiaries-page"]');
      const desktopTable=wrapper?.querySelector('table.taxpay-unified-table');
      const header=wrapper?.querySelector('table.taxpay-unified-table thead');
      const mobileCards=wrapper?.querySelector('ul.taxpay-mobile-table-cards');
      const filters=wrapper?.querySelector('.beneficiary-directory__filters');
      if(!wrapper||!desktopTable||!header||!mobileCards||!filters)throw new Error('Directory layout missing');
      return {width:window.innerWidth,
        pageOverflow:document.documentElement.scrollWidth>window.innerWidth+1,
        rowColumns:window.innerWidth>767?desktopTable.querySelectorAll('tbody tr:first-child td').length:1,
        filterColumns:getComputedStyle(filters).gridTemplateColumns.split(' ').filter(Boolean).length,
        headingVisible:getComputedStyle(desktopTable).display!=='none',
        mobileVisible:getComputedStyle(mobileCards).display!=='none'};
    });
    expect(layout.pageOverflow).toBe(false);
    expect(layout.rowColumns).toBe(layout.width>767?2:1);
    expect(layout.headingVisible).toBe(layout.width>767);
    if(layout.width>767){
      await expect(directory.locator('table.taxpay-unified-table thead th')).toHaveText([
        t('Beneficiary','উপকারভোগী'),t('Actions','কার্যক্রম')
      ]);
      expect(layout.mobileVisible).toBe(false);
      // The approved identity is name · final tag on one line, bare TIN underneath.
      const identity=rows.first().locator('.beneficiary-directory__person');
      await expect(identity.locator('.taxpayer-transaction-row__title')).toHaveText('Shihab · Neighbour');
      await expect(identity.locator('.beneficiary-directory__tin')).toHaveText('123*********');
      await expect(identity).not.toContainText(t('TIN','টিআইএন')+': ');
      await expect(identity).not.toContainText(t('Tag / relationship','ট্যাগ / সম্পর্ক')+': ');
      // At 1280px the complete two-action column must fit
      // without a hidden horizontal-scroll remainder.
      if(layout.width>=1180){
        const overflow=await directory.locator('.taxpay-table-viewport').evaluate(el=>el.scrollWidth-el.clientWidth);
        expect(overflow,'desktop Beneficiaries actions must not be clipped').toBeLessThanOrEqual(2);
        const bounds=await rows.first().getByRole('button',{name:t('Make payment','পেমেন্ট করুন')}).boundingBox();
        const viewportBounds=await directory.locator('.taxpay-table-viewport').boundingBox();
        expect(bounds&&viewportBounds&&bounds.x+bounds.width<=viewportBounds.x+viewportBounds.width+1,
          'Make payment must remain within the visible desktop table viewport').toBe(true);
      }
    }else{
      expect(layout.mobileVisible).toBe(true);
      // Compact identity: Name · final tag; bare TIN on next line, without prefixes.
      await expect(rows.first().locator('.taxpay-mobile-table-card__title')).toContainText('Shihab · Neighbour');
      await expect(rows.first().locator('.taxpay-mobile-table-card__title')).toContainText('123*********');
      await expect(rows.first()).not.toContainText(t('TIN','টিআইএন')+': ');
      await expect(rows.first()).not.toContainText(t('Tag / relationship','ট্যাগ / সম্পর্ক')+': ');
    }
    expect(layout.filterColumns).toBe(layout.width<=1050?2:3);
    await search.fill('Neighbour');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Shihab');
    await search.fill('User2');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('User2');
    await search.fill('');
    await selectList.click();
    const chooser=page.getByRole('dialog',{name:t('Choose beneficiary list','উপকারভোগীর তালিকা বাছুন')});
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole('button',{name:t('Edit Clients','Clients সম্পাদনা')})).toBeVisible();
    await chooser.getByRole('button',{name:t('Family Member','Family Member'),exact:true}).click();
    await expect(rows).toHaveCount(0);
    await selectList.click();
    await page.getByRole('dialog',{name:t('Choose beneficiary list','উপকারভোগীর তালিকা বাছুন')})
      .getByRole('button',{name:'Clients',exact:true}).click();
    await expect(rows).toHaveCount(2);
    // Edit reuses the same mandatory classification as Add; no forced list move.
    await rows.first().getByRole('button',{name:t('Edit','সম্পাদনা'),exact:true}).click();
    const edit=page.getByRole('dialog',{name:t('Edit beneficiary','উপকারভোগী সম্পাদনা')});
    await expect(edit).toBeVisible();
    await expect(edit.getByRole('button',{name:t('Delete beneficiary','উপকারভোগী মুছুন')})).toBeVisible();
    await edit.getByRole('button',{name:t('Delete beneficiary','উপকারভোগী মুছুন')}).click();
    const deletion=page.getByRole('dialog',{name:t('Confirm beneficiary removal','উপকারভোগী সরানো নিশ্চিত করুন')});
    await expect(deletion).toBeVisible();
    await deletion.getByRole('button',{name:t('Cancel','বাতিল')}).click();
    await expect(edit).toBeVisible();
    await expect(edit.locator('#beneficiary-edit-tag')).toHaveAttribute('data-value','others');
    // The shared searchable dropdown has an understated, accessible neutral focus
    // stroke rather than the overly saturated blue ring shown in the report.
    await edit.locator('#beneficiary-edit-tag').click();
    const tagSearch=edit.locator('input[type="search"][role="combobox"][aria-autocomplete="list"]');
    await expect(tagSearch).toBeFocused();
    await expect(tagSearch).toHaveCSS('outline-color','rgb(115, 129, 150)');
    await expect(tagSearch).toHaveCSS('outline-width','2px');
    await expect(tagSearch).toHaveCSS('outline-offset','-2px');
    await tagSearch.press('Escape');
    await expect(edit.locator('#beneficiary-edit-other-label')).toHaveValue('Neighbour');
    await expect(edit.locator('#beneficiary-edit-other-label')).toHaveAttribute('maxlength','80');
    await expect(edit.locator('#beneficiary-edit-list')).toHaveAttribute('data-value','00000000-0000-4000-8000-000000000101');
    await expect(edit.getByRole('button',{name:t('Save changes','পরিবর্তন সংরক্ষণ')})).toBeDisabled();
    await chooseBeneficiaryOption(edit,'beneficiary-edit-tag','friends_family:father');
    await expect(edit.locator('#beneficiary-edit-other-label')).toHaveCount(0);
    await expect(edit.getByRole('button',{name:t('Save changes','পরিবর্তন সংরক্ষণ')})).toBeEnabled();
    await expect(edit.locator('#beneficiary-edit-list')).toHaveAttribute('data-value','00000000-0000-4000-8000-000000000101');
    await edit.getByRole('button',{name:t('Cancel','বাতিল')}).click();
    await expect(rows.first()).toContainText('Neighbour');
    await rows.first().getByRole('checkbox',{name:t('Select Shihab','Shihab নির্বাচন')}).check();
    await expect(screen.locator('.beneficiary-directory__selected-count')).toContainText('1');
    await expect(screen.getByRole('button',{name:t('Clear','মুছুন'),exact:true})).toBeVisible();
    await screen.getByRole('button',{name:t('Add beneficiary','উপকারভোগী যোগ'),exact:true}).click();
    // The existing add action now opens the single-entry modal directly.
    await chooseBeneficiaryOption(page,'beneficiary-tag','others');
    const otherInput=page.locator('#beneficiary-other-label');
    await expect(otherInput).toBeVisible();
    await expect(otherInput).toHaveAttribute('maxlength','80');
    await otherInput.fill('a'.repeat(80));
    await expect(page.getByText(t('80/80 characters','80/80 অক্ষর'))).toBeVisible();
    await chooseBeneficiaryOption(page,'beneficiary-tag','clients');
    await expect(otherInput).toHaveCount(0);
    await chooseBeneficiaryOption(page,'beneficiary-tag','others');
    await expect(otherInput).toHaveValue('');
  });
}

for(const language of ['en','bn'] as const){
  test('beneficiary actions stay readable across the approved responsive widths in '+language,async({page},info)=>{
    test.skip(info.project.name!=='desktop-1280','Run the full responsive matrix once per language');
    await mountBeneficiaryLists(page);
    await page.goto('/?action=beneficiaries&demoUser=user1&lang='+language);
    const screen=page.getByTestId('beneficiaries-page');
    await expect(screen).toBeVisible();
    const searchLabel=language==='en'?'Search this list':'এই তালিকায় খুঁজুন';
    const searchPlaceholder=language==='en'?'Name or TIN':'নাম বা টিআইএন';
    for(const width of [320,375,390,768,1280,1920]){
      await page.setViewportSize({width,height:900});
      const directory=screen.getByTestId('beneficiary-records');
      const toolbar=screen.locator('.taxpay-office-register__toolbar');
      const search=toolbar.getByRole('searchbox',{name:searchLabel});
      const searchField=toolbar.locator('.taxpay-office-register__search > .taxpay-record-toolbar__search');
      await expect(toolbar.locator('.taxpay-office-register__search-label')).toHaveText(searchLabel);
      await expect(searchField).toBeVisible();
      await expect(search).toHaveAttribute('placeholder',searchPlaceholder);
      await expect(search).toHaveAttribute('title',searchPlaceholder);
      const [searchBox,toolbarBox]=await Promise.all([searchField.boundingBox(),toolbar.boundingBox()]);
      expect(searchBox&&toolbarBox&&searchBox.width>=(width<768?200:145),language+' search field width at '+width+'px').toBe(true);
      expect(searchBox&&toolbarBox&&searchBox.x>=toolbarBox.x-1&&searchBox.x+searchBox.width<=toolbarBox.x+toolbarBox.width+1,
        language+' search field stays inside the register toolbar at '+width+'px').toBe(true);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow,language+' beneficiary page must not overflow at '+width+'px').toBeLessThanOrEqual(2);
      if(width<768){
        const card=directory.locator('ul.taxpay-mobile-table-cards:visible > li').first();
        const actions=card.locator('.taxpay-mobile-table-card__actions');
        const buttons=actions.getByRole('button');
        await expect(buttons).toHaveCount(2);
        for(const button of await buttons.all()){
          const box=await button.boundingBox();
          expect(box?.height,language+' action target at '+width+'px').toBeGreaterThanOrEqual(48);
          const groupBox=await actions.boundingBox();
          expect(box&&groupBox&&box.x>=groupBox.x-1&&box.x+box.width<=groupBox.x+groupBox.width+1,
            language+' action clipping at '+width+'px').toBe(true);
        }
        await expect(actions.locator('button').nth(1).locator('svg')).toHaveCSS('width','20px');
      }else{
        const row=directory.locator('table.taxpay-unified-table tbody tr:visible').first();
        await expect(row.getByRole('button',{name:language==='en'?'Make payment':'পেমেন্ট করুন'})).toBeVisible();
        await expect(row.getByRole('button',{name:language==='en'?'Edit':'সম্পাদনা',exact:true})).toBeVisible();
      }
    }
  });
}

test('User1 loads beneficiary tags for overview and Activity, not Profile or Settings',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Representative account navigation regression');
  let addressBookReads=0;
  page.on('request',request=>{
    if(!request.url().includes('/functions/v1/taxpay-guest-beneficiaries'))return;
    try {
      const body=request.postDataJSON() as {action?:string};
      if(body.action==='people')addressBookReads++;
    }catch {/* Ignore unrelated requests. */}
  });
  await mountBeneficiaryLists(page);
  // Establish the server-issued fictional profile capability. A demoUser query
  // parameter alone is never authentication and must not authorize reads.
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user1');
  await page.getByLabel('Password',{exact:true}).fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect.poll(()=>addressBookReads).toBeGreaterThan(0);
  const initialOverviewReads=addressBookReads;

  await page.goto('/?action=account_profile');
  await expect(page.getByTestId('user1-taxpayer-profile')).toBeVisible();
  expect(addressBookReads,'Profile should not fetch beneficiary records').toBe(initialOverviewReads);

  await page.goto('/?action=history');
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect.poll(()=>addressBookReads).toBeGreaterThan(initialOverviewReads);
  const historyReads=addressBookReads;

  await page.goto('/?action=account_settings&demoUser=user1');
  await expect(page.getByTestId('user1-synthetic-workspace')).toBeVisible();
  expect(addressBookReads,'Settings should not fetch beneficiary records').toBe(historyReads);

  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect.poll(()=>addressBookReads).toBeGreaterThan(historyReads);
});

test('signed-in Activity shows new payments across assessment years immediately and after reload',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Exercise desktop and mobile in one owner-scoped test');
  await mountBeneficiaryLists(page);
  const capability='A'.repeat(43);
  const make=(id:string,createdAt:string,assessmentYear:string,amountMinor:number)=>({
    id,service:'OTHER_TAX_PAYMENT',amountMinor,status:'SIMULATED_SUCCESS',createdAt,
    details:{assessmentYear,payerId:'user1',payerName:'Fictional account',taxpayerName:'Fictional account',taxpayerTin:'111111111111',payerMode:'SELF',lines:[]}
  });
  const old=make('00000000-0000-4000-8000-000000000901','2026-11-24T05:39:00Z','2025-26',4000);
  const recent=make('00000000-0000-4000-8000-000000000902','2026-11-24T05:40:00Z','2026-27',452000);
  const newest=make('00000000-0000-4000-8000-000000000903','2026-11-24T05:47:00Z','2026-27',6500);
  let payments=[recent,old];
  let readFailure=false;
  await page.route(url=>url.pathname==='/functions/v1/demo-story1-taxpay/payments'||url.pathname.startsWith('/functions/v1/demo-story1-taxpay/payments/'),async route=>{
    if(route.request().method()!=='GET'||route.request().headers()['x-taxpay-guest-capability']!==capability)
      return route.fulfill({status:403,contentType:'application/json',body:'{}'});
    if(readFailure)return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    const url=new URL(route.request().url());
    const payment=payments.find(item=>url.pathname.endsWith('/'+item.id));
    const data=url.pathname.endsWith('/payments')
      ?{items:payments.map(({details,...summary})=>summary),total:payments.length}
      :payment?{id:payment.id,status:payment.status,createdAt:payment.createdAt,
        data:{origin:'TAXPAY_UI',service:payment.service,amountMinor:payment.amountMinor,details:payment.details}}:null;
    return route.fulfill({status:data?200:404,contentType:'application/json',
      body:JSON.stringify({success:Boolean(data),simulationOnly:true,data})});
  });
  await page.goto('/?action=taxpayer_login');
  await page.getByRole('textbox',{name:'User ID'}).fill('user1');
  await page.getByLabel('Password',{exact:true}).fill('user1');
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await page.goto('/?action=history');
  const year=page.getByRole('combobox',{name:'Assessment year'});
  const table=page.getByTestId('taxpayer-transaction-table');
  const first=table.locator('tbody tr').first();
  await expect(year).toHaveValue('all');
  await expect(first.locator('td:nth-child(4)')).toContainText(recent.id);
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.getByText(/DEMO-/)).toHaveCount(0);
  // Deliver the exact invalidation event produced after an acknowledged source
  // write. Use mocked read responses only: no hosted payment mutation.
  payments=[newest,recent,old];
  await page.evaluate(()=>window.dispatchEvent(new Event('taxpay:story-payments-recovered')));
  await expect(first.locator('td:nth-child(4)')).toContainText(newest.id);
  await expect(first).toContainText('65.00');
  await expect(table.locator('tbody tr')).toHaveCount(3);
  // Read failure must not silently reveal fixtures or claim a legitimate empty account.
  await year.selectOption('2025-2026');
  await expect(first.locator('td:nth-child(4)')).toContainText(old.id);
  await expect(table.getByText(newest.id,{exact:true})).toHaveCount(0);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await page.reload();
  await expect(year).toHaveValue('2025-2026');
  await year.selectOption('all');
  await expect(first.locator('td:nth-child(4)')).toContainText(newest.id);
  await page.reload();
  await expect(year).toHaveValue('all');
  await expect(first.locator('td:nth-child(4)')).toContainText(newest.id);
  await page.setViewportSize({width:375,height:812});
  const cards=page.getByTestId('taxpayer-transaction-mobile-cards');
  await expect(cards.locator(':scope > li').first()).toContainText(newest.id);
  await expect(cards.locator(':scope > li')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.goto('/?action=journey');
  await expect(page.getByTestId('taxpay-payment-journey')).toContainText(newest.id);
  await expect(page.getByTestId('taxpay-payment-journey')).not.toContainText('DEMO-PAY-');
  await page.goto('/?action=history');
  await expect(page.getByTestId('user1-synthetic-workspace')).toHaveAttribute('data-payment-source-state','ready');
  readFailure=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('taxpay:story-payments-recovered')));
  await expect(page.getByTestId('user1-synthetic-workspace')).toHaveAttribute('data-payment-source-state','error');
  await expect(page.locator('.taxpayer-transaction-panel').getByRole('alert').filter({hasText:'Recorded payments could not be verified.'})).toBeVisible();
  await expect(page.getByText('No transactions yet.',{exact:true})).toHaveCount(0);
  await expect(page.getByTestId('taxpayer-transaction-table')).toHaveCount(0);
  readFailure=false;
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByTestId('taxpayer-transaction-mobile-cards').locator(':scope > li').first()).toContainText(newest.id);
  payments=[];
  await page.goto('/?action=history');
  await expect(page.getByText('No transactions yet.',{exact:true})).toBeVisible();
  await expect(page.getByTestId('taxpayer-transaction-table')).toHaveCount(0);
});


// Establish the account capability by the actual login journey; demoUser URLs
// are not authorization. Test row, profile and bulk shortcuts against the same
// reusable editor. No payment submission is performed.
for(const entry of ['row','profile','bulk'] as const){
  test('signed-in beneficiary '+entry+' opens the unified Taxpayer Information editor',async({page})=>{
    await mountBeneficiaryLists(page);
    await page.goto('/?action=taxpayer_login');
    await page.getByRole('textbox',{name:'User ID'}).fill('user1');
    await page.getByLabel('Password',{exact:true}).fill('user1');
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page).toHaveURL(/action=taxpayer_home/);
    await page.goto('/?action=beneficiaries');
    const screen=page.getByTestId('beneficiaries-page');
    const rows=screen.getByTestId('beneficiary-records').locator('table.taxpay-unified-table tbody tr:visible, ul.taxpay-mobile-table-cards:visible > li');
    await expect(rows).toHaveCount(2);
    const recipient=rows.filter({hasText:'User2'});
    if(entry==='profile'){
      await recipient.getByRole('link',{name:'Open profile for User2'}).click();
      await page.getByTestId('beneficiary-profile').getByRole('button',{name:'Make payment',exact:true}).click();
    }else if(entry==='bulk'){
      await rows.filter({hasText:'Shihab'}).getByRole('checkbox',{name:'Select Shihab'}).check();
      await recipient.getByRole('checkbox',{name:'Select User2'}).check();
      await screen.getByRole('button',{name:'Pay Tax for Others'}).click();
    }else await recipient.getByRole('button',{name:'Make payment',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Pay Tax',exact:true});
    await expect(dialog).toHaveClass(/taxpay-v5-locked/);
    await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
    await expect(dialog.locator('.taxpay-modal__subtitle')).toHaveText('Signed-in Payment');
    await expect(dialog.locator('[data-payer-relationship], [data-payment-entry]')).toHaveCount(0);
    const workspace=dialog.getByTestId('unified-taxpayer-workspace');
    await expect(workspace).toBeVisible();
    await expect(workspace.getByTestId('unified-taxpayer-count')).toHaveText(entry==='bulk'?'2':'1');
    await expect(workspace.locator('.unified-taxpayer-workspace__person').filter({hasText:'User2'})).toHaveCount(1);
    await expect(workspace.getByTestId('unified-account-own').getByRole('checkbox')).not.toBeChecked();
    await expect(workspace.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select User2'})).toBeChecked();
    if(entry==='bulk'){
      await expect(workspace.locator('.unified-taxpayer-workspace__person').filter({hasText:'Shihab'})).toHaveCount(1);
      await expect(workspace.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Shihab'})).toBeChecked();
    }else{
      await expect(dialog.getByRole('button',{name:'Continue to Payment Head'})).toBeEnabled();
      await dialog.getByRole('button',{name:'Continue to Payment Head'}).click();
      await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Payment Head');
      await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
    }
  });
}
