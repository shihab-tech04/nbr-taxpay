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
async function mockSavedBeneficiaries(page:Page,empty=false){
  const list={id:'00000000-0000-4000-8000-000000000001',name:'Family',created_at:'2026-01-01T00:00:00Z'};
  const people=[
    {id:'00000000-0000-4000-8000-000000000002',list_id:list.id,tin:'2222222222222',display_name:'Meghna Trading Ltd.',created_at:list.created_at,updated_at:list.created_at},
    {id:'00000000-0000-4000-8000-000000000003',list_id:list.id,tin:'3333333333333',display_name:'Saved Taxpayer Three',created_at:list.created_at,updated_at:list.created_at}
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

test('verified active consent permits Step 2 with the original 13-digit fictional taxpayer TIN',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,[authorization('user2','ACTIVE')]);
  const dialog=await openSignedInPayment(page);
  await dialog.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByTestId('other-tax-batch')).toBeVisible();
  await expect(dialog.locator('.taxpay-modal__step-count')).toHaveText('2/4 Steps');
  await expect(dialog.getByTestId('other-tax-batch')).toContainText('2222222222222');
});
for(const state of ['PENDING','EXPIRED','REVOKED','ACTIVE_EXPIRED'] as const){
  test(state+' consent cannot authorize a saved beneficiary',async({page})=>{
    await mockSavedBeneficiaries(page);
    await mockAuthorizations(page,[authorization('user2',state==='ACTIVE_EXPIRED'?'ACTIVE':state,state==='ACTIVE_EXPIRED'?Date.now()-1000:null)]);
    const dialog=await openSignedInPayment(page);
    await dialog.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
    await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
    await expect(dialog.getByText(/not approved for payment through your account/)).toBeVisible();
    await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
  });
}
test('every selected beneficiary needs consent; a single approval cannot cover a second TIN',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,[authorization('user2','ACTIVE')]);
  const dialog=await openSignedInPayment(page);
  const picker=dialog.getByTestId('saved-beneficiary-picker');
  await picker.getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await picker.getByRole('checkbox',{name:'Select Saved Taxpayer Three'}).check();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByText(/Taxpayer 2 .* is not approved for payment/)).toBeVisible();
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
});
test('authorization read failures fail closed without exposing old authorization UI',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,null);
  const dialog=await openSignedInPayment(page);
  await dialog.getByTestId('saved-beneficiary-picker').getByRole('checkbox',{name:'Select Meghna Trading Ltd.'}).check();
  await dialog.getByRole('button',{name:'Continue to purpose & amount'}).click();
  await expect(dialog.getByText(/Authorization could not be verified/)).toBeVisible();
  await expect(dialog.getByTestId('other-tax-batch')).toHaveCount(0);
  await expect(dialog.getByTestId('authorized-taxpayer-choices')).toHaveCount(0);
});
test('single beneficiary service keeps list selection but shows radio rather than free-form entry',async({page})=>{
  await mockSavedBeneficiaries(page);await mockAuthorizations(page,[authorization('user2','ACTIVE')]);
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
