import {test,expect,type Page} from '@playwright/test';

/** A self-contained signed-in UI fixture; no production taxpayer or SQL records are used. */
async function mountBeneficiaryLists(page:Page){
  const now='2026-11-01T00:00:00.000Z';
  const lists=[
    {id:'00000000-0000-4000-8000-000000000101',name:'Clients',created_at:now},
    {id:'00000000-0000-4000-8000-000000000102',name:'Family Member',created_at:now},
  ];
  const people=[
    {id:'00000000-0000-4000-8000-000000000201',list_id:lists[0].id,tin:'123456789012',display_name:'Shihab',created_at:now,updated_at:now},
    {id:'00000000-0000-4000-8000-000000000202',list_id:lists[0].id,tin:'222222222222',display_name:'User2',created_at:now,updated_at:now},
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
    expect(layout.rowColumns).toBe(layout.width<=700?1:2);
    expect(layout.headingVisible).toBe(layout.width>700);
    expect(layout.filterColumns).toBe(layout.width<=850?1:2);
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
    await rows.first().getByRole('checkbox',{name:t('Select Shihab','Shihab নির্বাচন')}).check();
    await expect(screen.locator('.beneficiary-directory__selected-count')).toContainText('1');
    await expect(screen.getByRole('button',{name:t('Clear','মুছুন'),exact:true})).toBeVisible();
  });
}
