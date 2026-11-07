import {test,expect} from '@playwright/test';

test('profile-scoped tags reconcile dashboard family/friends/clients and filter Activity',async({page})=>{
  const date='2026-11-07T00:00:00Z';
  const list={id:'00000000-0000-4000-8000-000000000101',name:'Family and clients',created_at:date};
  const people=[
    {tin:'222222222222',display_name:'User 2',tag:'friends_family',relationship:'mother',other_label:null},
    {tin:'888888888888',display_name:'User 8',tag:'friends_family',relationship:'friends',other_label:null},
    {tin:'909000000011',display_name:'Taxpayer Account 11',tag:'clients',relationship:null,other_label:null},
    {tin:'909000000019',display_name:'Taxpayer Account 19',tag:'others',relationship:null,other_label:'Vendor'},
  ].map((data,index)=>({id:'00000000-0000-4000-8000-'+String(index+200).padStart(12,'0'),list_id:list.id,created_at:date,updated_at:date,...data}));
  await page.route('**/auth/v1/user',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"No session"}'}));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',route=>{
    const body=route.request().postDataJSON() as {action?:string;offset?:number;limit?:number};
    const settings={language:'en',selectedListId:list.id,paymentSessionId:'00000000-0000-4000-8000-000000000099'};
    const data=body.action==='demo-login'?{...settings,profileId:'user1',capability:'A'.repeat(43)}
      :body.action==='demo-settings'?settings
      :body.action==='open'?{active:true}
      :body.action==='lists'?[list]
      :body.action==='people'?people.slice(body.offset??0,(body.offset??0)+(body.limit??500))
      :[];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  await page.goto('/?action=taxpayer_login');
  const login=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await login.getByRole('textbox',{name:'User ID'}).fill('user1');
  await login.getByLabel('Password',{exact:true}).fill('user1');
  await login.getByRole('button',{name:'Sign In'}).click();
  await expect(login).toHaveCount(0);
  await page.goto('/?action=taxpayer_home');
  const summary=page.getByTestId('beneficiary-spending-breakdown');
  await expect(summary).toBeVisible();
  await expect(summary.getByTestId('tagged-payment-total')).toContainText('113,500');
  await expect(summary.getByTestId('tag-spend-family')).toContainText('30,000');
  await expect(summary.getByTestId('tag-spend-friends')).toContainText('6,500');
  await expect(summary.getByTestId('tag-spend-clients')).toContainText('45,000');
  await expect(summary.getByTestId('tag-spend-others')).toContainText('0');
  await expect(summary.getByTestId('tag-spend-unassigned')).toContainText('32,000');
  await page.goto('/?action=history');
  const filter=page.getByRole('combobox',{name:'Filter transactions by beneficiary tag'});
  await expect(filter).toBeVisible();
  await filter.selectOption('friends');
  await expect(page.getByText('Records: 1')).toBeVisible();
  await expect(page.getByText('DEMO-TRAVEL-01').filter({visible:true}).first()).toBeVisible();
  await filter.selectOption('clients');
  await expect(page.getByText('Records: 1')).toBeVisible();
  await expect(page.getByText('DEMO-PAY-02').filter({visible:true}).first()).toBeVisible();
  await filter.selectOption('all');
  await expect(page.getByText('Records: 14')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
