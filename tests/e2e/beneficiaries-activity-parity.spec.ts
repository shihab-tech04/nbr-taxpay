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
    const filters=screen.locator('.taxpayer-transaction-filters.beneficiary-directory__filters');
    await expect(filters).toBeVisible();
    const selectList=filters.getByRole('button',{name:t('Selected list','নির্বাচিত তালিকা')});
    await expect(selectList).toContainText('Clients');
    const search=filters.getByRole('searchbox',{name:t('Search this list','এই তালিকায় খুঁজুন')});
    await expect(search).toBeVisible();
    await expect(screen.locator('.beneficiary-directory__count')).toContainText('2');
    const directory=screen.getByTestId('beneficiary-records');
    await expect(directory).toBeVisible();
    const rows=directory.getByRole('listitem');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Shihab');
    await expect(rows.first()).toContainText('123456789012');
    await expect(rows.first()).toContainText(t('Others · Neighbour','অন্যান্য · Neighbour'));
    await expect(screen.locator('.beneficiary-directory__table.taxpay-data-table')).toBeVisible();
    const theme=await screen.locator('.beneficiary-directory__table').evaluate(el=>{
      const header=el.querySelector('.beneficiary-directory__columns');
      const row=el.querySelector('.beneficiary-directory__row');
      return {borderRadius:getComputedStyle(el).borderRadius,
        headerMinHeight:header?parseFloat(getComputedStyle(header).minHeight):0,
        rowBackground:row?getComputedStyle(row).backgroundColor:'transparent'};
    });
    expect(theme.borderRadius).not.toBe('0px');
    expect(theme.headerMinHeight).toBeGreaterThanOrEqual(44);
    expect(theme.rowBackground).not.toBe('transparent');
    await expect(rows.first().getByRole('button',{name:t('Edit','সম্পাদনা'),exact:true})).toBeVisible();
    await expect(rows.first().getByRole('button',{name:t('Pay Tax for Others','অন্যের কর পরিশোধ')})).toBeVisible();
    await expect(rows.first().getByRole('button',{name:t('Remove Shihab','Shihab সরান')})).toBeVisible();
    const layout=await page.evaluate(()=>{
      const wrapper=document.querySelector('[data-testid="beneficiaries-page"]');
      const panel=wrapper?.querySelector('.beneficiary-directory__row');
      const heading=wrapper?.querySelector('.beneficiary-directory__columns');
      const filters=wrapper?.querySelector('.beneficiary-directory__filters');
      if(!wrapper||!panel||!heading||!filters)throw new Error('Directory layout missing');
      return {width:window.innerWidth,
        pageOverflow:document.documentElement.scrollWidth>window.innerWidth+1,
        rowColumns:getComputedStyle(panel).gridTemplateColumns.split(' ').filter(Boolean).length,
        filterColumns:getComputedStyle(filters).gridTemplateColumns.split(' ').filter(Boolean).length,
        headingVisible:getComputedStyle(heading).display!=='none'};
    });
    expect(layout.pageOverflow).toBe(false);
    expect(layout.rowColumns).toBe(layout.width<=800?1:4);
    expect(layout.headingVisible).toBe(layout.width>800);
    // A user-facing table must expose the actual four columns on desktop,
    // and keep TIN/tag understandable after the header becomes a mobile card.
    if(layout.width>800){
      await expect(directory.locator('.taxpay-record-list__heading')).toHaveText([
        t('Beneficiary','উপকারভোগী'),t('TIN','টিআইএন'),
        t('Tag / relationship','ট্যাগ / সম্পর্ক'),t('Actions','কার্যক্রম')
      ]);
      await expect(rows.first().locator('.beneficiary-directory__mobile-label').first()).toBeHidden();
    }else{
      await expect(directory.locator('.taxpay-record-list__columns')).toBeHidden();
      await expect(rows.first().locator('.beneficiary-directory__mobile-label')).toHaveText([
        t('TIN','টিআইএন')+': ',t('Tag','ট্যাগ')+': '
      ]);
    }
    expect(layout.filterColumns).toBe(layout.width<=700?1:layout.width<=1050?2:3);
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
    await expect(edit.locator('#beneficiary-edit-tag')).toHaveValue('others');
    await expect(edit.locator('#beneficiary-edit-other-label')).toHaveValue('Neighbour');
    await expect(edit.locator('#beneficiary-edit-other-label')).toHaveAttribute('maxlength','80');
    await expect(edit.locator('#beneficiary-edit-list')).toHaveValue('00000000-0000-4000-8000-000000000101');
    await expect(edit.getByRole('button',{name:t('Save changes','পরিবর্তন সংরক্ষণ')})).toBeDisabled();
    await edit.locator('#beneficiary-edit-tag').selectOption('friends_family');
    await expect(edit.locator('#beneficiary-edit-other-label')).toHaveCount(0);
    await expect(edit.getByRole('button',{name:t('Save changes','পরিবর্তন সংরক্ষণ')})).toBeDisabled();
    await edit.locator('#beneficiary-edit-relationship').selectOption('father');
    await expect(edit.getByRole('button',{name:t('Save changes','পরিবর্তন সংরক্ষণ')})).toBeEnabled();
    await expect(edit.locator('#beneficiary-edit-list')).toHaveValue('00000000-0000-4000-8000-000000000101');
    await edit.getByRole('button',{name:t('Cancel','বাতিল')}).click();
    await expect(rows.first()).toContainText(t('Others · Neighbour','অন্যান্য · Neighbour'));
    await rows.first().getByRole('checkbox',{name:t('Select Shihab','Shihab নির্বাচন')}).check();
    await expect(screen.locator('.beneficiary-directory__selected-count')).toContainText('1');
    await expect(screen.getByRole('button',{name:t('Clear','মুছুন'),exact:true})).toBeVisible();
    await screen.getByRole('button',{name:t('Add beneficiary','উপকারভোগী যোগ'),exact:true}).click();
    await page.getByRole('button',{name:t('Add one beneficiary','একজন উপকারভোগী যোগ')}).click();
    await page.locator('#beneficiary-tag').selectOption('others');
    const otherInput=page.locator('#beneficiary-other-label');
    await expect(otherInput).toBeVisible();
    await expect(otherInput).toHaveAttribute('maxlength','80');
    await otherInput.fill('a'.repeat(80));
    await expect(page.getByText(t('80/80 characters','80/80 অক্ষর'))).toBeVisible();
    await page.locator('#beneficiary-tag').selectOption('clients');
    await expect(otherInput).toHaveCount(0);
    await page.locator('#beneficiary-tag').selectOption('others');
    await expect(otherInput).toHaveValue('');
  });
}
