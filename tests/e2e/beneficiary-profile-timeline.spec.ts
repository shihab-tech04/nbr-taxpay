import {test,expect} from '@playwright/test';

/** Owned preview capability, no production account data or financial writes. */
test('beneficiary profile shows only this payer’s allocations, filters and returns to the unchanged list',async({page})=>{
  const now='2026-11-09T10:00:00.000Z';
  const list={id:'00000000-0000-4000-8000-000000000101',name:'Saved family',created_at:now};
  const person={id:'00000000-0000-4000-8000-000000000201',list_id:list.id,tin:'222222222222',
    display_name:'User Two',tag:'friends_family',relationship:'brother',other_label:null,created_at:now,updated_at:now};
  const settings={language:'en',selectedListId:list.id,paymentSessionId:'00000000-0000-4000-8000-000000000099'};
  const record={
    id:'record-1',transactionId:'record-1',payer:'user1',state:'SIMULATED',createdAt:now,
    simulationOnly:true,totalMinor:3000000,reviewStatus:'APPROVER_CLOSED',events:[],
    allocations:[
      {id:'a',lineNo:1,beneficiary:'user2',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:1200000},
      {id:'b',lineNo:2,beneficiary:'user3',category:'PENALTY',assessmentYear:'2026-27',amountMinor:1500000},
      {id:'c',lineNo:3,beneficiary:'user2',category:'OTHER_TAX_PAYMENT',assessmentYear:'2025-26',amountMinor:300000}
    ]
  };
  await page.route('**/auth/v1/user',route=>route.fulfill({
    status:401,contentType:'application/json',body:JSON.stringify({message:'No session'})
  }));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',route=>{
    const body=route.request().postDataJSON() as {action?:string;offset?:number;limit?:number};
    const data=body.action==='demo-login'?{...settings,profileId:'user1',capability:'A'.repeat(43)}
      :body.action==='demo-settings'?settings
      :body.action==='open'?{active:true}
      :body.action==='lists'?[list]
      :body.action==='people'?[person].slice(body.offset??0,(body.offset??0)+(body.limit??500))
      :[];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/payments?**',route=>
    route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,data:{items:[],total:0}})}));
  await page.route('**/functions/v1/demo-story1-taxpay/profile-history?**',route=>
    route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,simulationOnly:true,data:[record]})}));
  await page.goto('/?action=taxpayer_login');
  const login=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await login.getByRole('textbox',{name:'User ID'}).fill('user1');
  await login.getByLabel('Password',{exact:true}).fill('user1');
  await login.getByRole('button',{name:'Sign In'}).click();
  await expect(login).toHaveCount(0);
  await page.goto('/?action=beneficiaries');
  const listScreen=page.getByTestId('beneficiaries-page');
  await expect(listScreen).toBeVisible();
  await listScreen.getByRole('link',{name:'Open profile for User Two'}).click();
  const profile=page.getByTestId('beneficiary-profile');
  await expect(profile).toBeVisible();
  await expect(profile.getByRole('heading',{name:'User Two'})).toBeVisible();
  await expect(profile.getByText('222222222222')).toBeVisible();
  await expect(profile.getByText('৳ 15,000',{exact:true})).toBeVisible();
  await expect(profile.locator('ol li').getByText('Advance tax',{exact:true})).toBeVisible();
  await expect(profile.locator('ol li').getByText('Other tax payment',{exact:true})).toBeVisible();
  await expect(profile.locator('ol li').getByText('Penalty',{exact:true})).toHaveCount(0);
  await expect(profile.locator('ol li').getByText('record-1')).toHaveCount(2);
  const timeline=profile.getByTestId('beneficiary-chronological-timeline');
  await expect(timeline).toBeVisible();
  await expect(timeline).toHaveCSS('border-left-width','2px');
  await expect(timeline.locator('time')).toHaveCount(2);
  await profile.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-26');
  await expect(profile.locator('ol li').getByText('Advance tax',{exact:true})).toHaveCount(0);
  await expect(profile.locator('ol li').getByText('Other tax payment',{exact:true})).toBeVisible();
  await profile.getByRole('button',{name:'Back to beneficiaries'}).click();
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
  await expect(listScreen.getByRole('button',{name:'Edit',exact:true})).toBeVisible();
  await expect(listScreen.getByRole('button',{name:'Make payment'})).toBeVisible();
  await expect(listScreen.getByRole('link',{name:'Open profile for User Two'})).toBeVisible();

  // The same saved beneficiary must be reachable from the Activity register.
  await page.goto('/?action=history');
  const register=page.locator('.taxpayer-transaction-panel');
  await register.getByRole('button',{name:'Filter',exact:true}).click();
  await register.getByRole('combobox',{name:'Filter transactions by beneficiary'}).selectOption('222222222222');
  const activityRow=register.getByTestId('taxpayer-transaction-table').locator('tbody tr');
  await expect(activityRow).toHaveCount(1);
  await expect(activityRow.first().getByText('User Two')).toBeVisible();
  await activityRow.first().getByRole('button',{name:'Open beneficiary profile for User Two'}).click();
  await expect(page.getByTestId('beneficiary-profile')).toBeVisible();
  await expect(page.getByTestId('beneficiary-chronological-timeline')).toBeVisible();
  await page.getByRole('button',{name:'Back to activity'}).click();
  await expect(page.getByRole('heading',{name:'Transaction history'})).toBeVisible();
});
