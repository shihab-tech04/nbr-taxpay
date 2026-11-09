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
    const body=route.request().postDataJSON() as {action?:string;offset?:number;limit?:number};
    const data=body.action==='open'?{active:true}
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
    await expect(screen.locator('.taxpay-office-register__count')).toContainText('2');
    const directory=screen.getByTestId('beneficiary-records');
    await expect(directory).toBeVisible();
    // Unlike the old release, the selected-list picker, search and filter must
    // remain on ONE toolbar row at desktop widths, without an empty bulk strip.
    if(page.viewportSize()!.width>=1180){
      const toolbar=screen.locator('.beneficiary-register-frame > .taxpay-office-register__toolbar');
      const bounds=await toolbar.boundingBox();
      const searchBounds=await search.boundingBox();
      const listBounds=await selectList.boundingBox();
      expect(bounds?.height,'Beneficiaries toolbar must match Transaction History compact height').toBeLessThanOrEqual(90);
      expect(Math.abs((searchBounds?.y??0)-(listBounds?.y??0)),
        'Selected list must align with Search and Filter, not wrap beneath them').toBeLessThan(18);
      await expect(screen.locator('.beneficiary-register-frame > .beneficiary-directory__count')).toBeHidden();
      await expect(directory.locator('thead').getByRole('checkbox',{
        name:t('Select all visible beneficiaries','দেখানো সব উপকারভোগী নির্বাচন')})).toBeVisible();
    }
    const rows=directory.locator('table.taxpay-unified-table tbody tr:visible, ul.taxpay-mobile-table-cards:visible > li');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Shihab');
    await expect(rows.first()).toContainText('123456789012');
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
    else await expect(rows.first().getByRole('button',{name:t('Make payment','পেমেন্ট করুন')})).toHaveCSS('min-height','44px');
    expect(theme.rowBackground).not.toBe('transparent');
    await expect(rows.first().getByRole('button',{name:t('Edit','সম্পাদনা'),exact:true})).toBeVisible();
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
      await expect(identity.locator('.beneficiary-directory__tin')).toHaveText('123456789012');
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
      await expect(rows.first().locator('.taxpay-mobile-table-card__title')).toContainText('123456789012');
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
    await page.getByRole('button',{name:t('Add one beneficiary','একজন উপকারভোগী যোগ')}).click();
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
