import {test,expect,type Page} from '@playwright/test';
import {enterTaxPayService} from './pay-tax-entry-helper';

type Status='ACTIVE'|'PENDING'|'EXPIRED'|'REVOKED';
function authorization(taxpayerId:'user2'|'user3',status:Status,activeUntil:number|null=null){
  return {id:taxpayerId==='user2'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',
    payerId:'user1',taxpayerId,status,requestedAt:Date.now()-10000,codeExpiresAt:Date.now()+60000,
    consentCode:null,confirmedAt:status==='ACTIVE'?Date.now()-5000:null,activeUntil,attempts:0,revokedAt:null};
}
async function mockAuthorizations(page:Page,records:ReturnType<typeof authorization>[]|null){
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?actor=user1',route=>route.fulfill({
    status:records?200:503,contentType:'application/json',
    body:JSON.stringify(records?{success:true,data:records,simulationOnly:true}:{success:false,error:'AUTHORIZATION_READ_FAILED'})
  }));
}
/** Synthetic login has no Supabase Auth UID; its existing Beneficiaries page shares the same capability-scoped list backend. */
async function mockSavedBeneficiaries(page:Page,empty=false,shortTin=false){
  const list={id:'00000000-0000-4000-8000-000000000001',name:'Family',created_at:'2026-01-01T00:00:00Z'};
  const people=[
    {id:'00000000-0000-4000-8000-000000000002',list_id:list.id,tin:shortTin?'123456789012':'2222222222222',display_name:'Meghna Trading Ltd.',created_at:list.created_at,updated_at:list.created_at},
    {id:'00000000-0000-4000-8000-000000000003',list_id:list.id,tin:shortTin?'222222222222':'3333333333333',display_name:'Saved Taxpayer Three',created_at:list.created_at,updated_at:list.created_at}
  ];
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',route=>{
    const body=route.request().postDataJSON() as {action?:string;offset?:number;limit?:number};
    const data=body.action==='open'?{active:true}
      :body.action==='lists'?(empty?[]:[list])
      :body.action==='people'?(empty?[]:people.slice(body.offset??0,(body.offset??0)+(body.limit??500))):[];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
}
async function openSignedInPayment(page:Page,service='OTHER_TAX_PAYMENT'){
  await page.goto('/?action=taxpayer_login');
  const login=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await login.getByRole('textbox',{name:'User ID'}).fill('user1');
  await login.getByLabel('Password',{exact:true}).fill('user1');
  await login.getByRole('button',{name:'Sign In'}).click();
  await expect(login).toHaveCount(0);
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog,service,'OTHER');
  return dialog;
}

test('signed-in facilitation uses saved beneficiary list accordions and never manual taxpayer inputs',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,[]);
  const dialog=await openSignedInPayment(page);
  const picker=dialog.getByTestId('saved-beneficiary-picker');
  await expect(picker.getByRole('heading',{name:'Choose beneficiaries'})).toBeVisible();
  await expect(picker.getByRole('button',{name:'Family'})).toHaveAttribute('aria-expanded','true');
  await expect(picker).toContainText('2222222222222');
  await expect(picker).toContainText('3333333333333');
  await expect(dialog.getByTestId('authorized-taxpayer-choices')).toHaveCount(0);
  await expect(dialog.getByTestId('other-tax-taxpayer-list')).toHaveCount(0);
  await expect(dialog.locator('#guest-tin')).toHaveCount(0);
  await expect(dialog.locator('#guest-payer-name')).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Add another taxpayer'})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'Continue to purpose & amount'})).toBeDisabled();
  await picker.getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await picker.getByRole('checkbox',{name:'Select Saved Taxpayer Three'}).check();
  await expect(picker).toContainText('2 selected for this payment');
  await picker.getByRole('checkbox',{name:'Select Saved Taxpayer Three'}).uncheck();
  await expect(picker).toContainText('1 selected for this payment');
});

test('saved beneficiary without authorization proceeds to Step 2',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,[]);
  const dialog=await openSignedInPayment(page);
  await dialog.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');
});

for(const state of ['PENDING','EXPIRED','REVOKED','ACTIVE_EXPIRED'] as const){
  test(state+' approval state does not block saved beneficiary payment',async({page})=>{
    await mockSavedBeneficiaries(page);
    await mockAuthorizations(page,[authorization('user2',state==='ACTIVE_EXPIRED'?'ACTIVE':state,state==='ACTIVE_EXPIRED'?Date.now()-1000:null)]);
    const dialog=await openSignedInPayment(page);
    await dialog.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
    await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
    await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
    await expect(dialog.getByText(/not approved for payment through your account/)).toHaveCount(0);
  });
}
test('two selected saved beneficiaries proceed without separate consent',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,[]);
  const dialog=await openSignedInPayment(page);
  const picker=dialog.getByTestId('saved-beneficiary-picker');
  await picker.getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await picker.getByRole('checkbox',{name:'Select Saved Taxpayer Three'}).check();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  const batch=dialog.getByTestId('other-tax-batch');
  await expect(batch).toBeVisible();
  const taxpayerTabs = batch.getByTestId('other-tax-taxpayer-tabs');
  await expect(taxpayerTabs.getByRole('button', { name: /2222222222222/ })).toBeVisible();
  await expect(taxpayerTabs.getByRole('button', { name: /3333333333333/ })).toBeVisible();
});
test('approval service outage cannot block a saved beneficiary',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,null);
  const dialog=await openSignedInPayment(page);
  await dialog.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
});
test('optional NBR reference does not block a valid saved 12-digit TIN',async({page})=>{
  await mockSavedBeneficiaries(page,false,true);await mockAuthorizations(page,null);
  const dialog=await openSignedInPayment(page);
  await dialog.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await dialog.locator('#guest-notice-ref').fill('PN-2026-000392');
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
});
test('a beneficiary removed from saved lists cannot continue',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,null);
  const dialog=await openSignedInPayment(page);
  await dialog.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',route=>{
    const body=route.request().postDataJSON() as {action?:string};
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({success:true,data:body.action==='open'?{active:true}:[]})});
  });
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByText(/no longer in your saved lists/)).toBeVisible();
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
});
test('saved-list read failures remain blocking even without beneficiary approval',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,null);
  const dialog=await openSignedInPayment(page);
  await dialog.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',route=>
    route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,error:'BENEFICIARIES_UNAVAILABLE'})}));
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByText(/Saved beneficiaries could not be verified/)).toBeVisible();
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
});
test('single beneficiary service keeps list selection but shows radio rather than free-form entry',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,null);
  const dialog=await openSignedInPayment(page,'TAX_WITH_RETURN');
  const picker=dialog.getByTestId('saved-beneficiary-picker');
  await expect(picker.getByRole('radio',{name:'Select Meghna Trading Ltd.'})).toBeVisible();
  await picker.getByRole('radio',{name:'Select Meghna Trading Ltd.'}).check();
  await expect(dialog.locator('#guest-tin')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');
});
test('empty beneficiary lists direct signed-in payers to the dedicated management page',async({page})=>{
  await mockSavedBeneficiaries(page,true);await mockAuthorizations(page,[]);
  const dialog=await openSignedInPayment(page);
  const picker=dialog.getByTestId('saved-beneficiary-picker');
  await expect(picker).toContainText('No beneficiary lists yet');
  await expect(dialog.getByRole('button',{name:'Continue to purpose & amount'})).toBeDisabled();
  await picker.getByRole('button',{name:'Create your first list'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('beneficiaries-page')).toBeVisible();
});
test('guest input remains editable and limited to twelve digits',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Pay Tax',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(dialog,'OTHER_TAX_PAYMENT','OTHER');
  const tin=dialog.locator('#guest-tin');
  await expect(tin).toHaveAttribute('maxlength','12');
  await tin.fill('1234567890123');
  await expect(tin).toHaveValue('123456789012');
  await tin.fill('1234');
  await dialog.locator('#guest-payer-name').fill('Sample payer');
  await dialog.locator('#guest-phone').fill('01712345678');
  await expect(dialog.getByRole('button',{name:'Continue to purpose & amount'})).toBeDisabled();
});

test('signed-in facilitated payments save one record per selected taxpayer item', async ({ page }) => {
  await mockSavedBeneficiaries(page);
  await mockAuthorizations(page, null);
  const submitted: Array<Record<string, any>> = [];
  await page.route('**/functions/v1/demo-story1-taxpay/payments', async route => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, id: `00000000-0000-4000-8000-${String(400 + submitted.length).padStart(12, '0')}`,
      status: 'SIMULATED_SUCCESS', mirrored: true, simulationOnly: true,
    }) });
  });
  const dialog = await openSignedInPayment(page);
  const picker=dialog.getByTestId('saved-beneficiary-picker');
  await picker.getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await picker.getByRole('checkbox',{name:'Select Saved Taxpayer Three'}).check();
  await dialog.getByRole('button', { name: 'Continue to purpose & amount' }).click();
  const batch = dialog.getByTestId('other-tax-batch');
  await batch.locator('[data-head-group="Advance Tax"] summary').click();
  await batch.getByRole('checkbox', { name: /Select 68A/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('15');
  await batch.getByTestId('other-tax-taxpayer-tabs').getByRole('button').nth(1).click();
  await batch.getByRole('checkbox', { name: /Select 68B/ }).check();
  await batch.getByTestId('other-tax-line').locator('input[id^="other-tax-amount"]').fill('35');
  await dialog.getByRole('button', { name: 'Continue to payment channel' }).click();
  await dialog.getByRole('button', { name: 'Pay online' }).click();
  await dialog.getByRole('button', { name: 'Mobile banking' }).click();
  await dialog.getByRole('radio', { name: 'bKash' }).check();
  await dialog.getByRole('checkbox', { name: /I confirm each taxpayer TIN/ }).check();
  await dialog.getByRole('button', { name: /Pay ৳ 50/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Payment record saved' })).toBeVisible({ timeout: 15000 });
  expect(submitted.map(record => record.details.taxpayerTin)).toEqual(['2222222222222', '3333333333333']);
  expect(submitted.map(record => record.amountMinor)).toEqual([1500, 3500]);
  await expect(dialog.getByTestId('other-tax-batch-result')).toHaveCount(2);
});
