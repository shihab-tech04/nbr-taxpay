import {expect,test} from '@playwright/test';
import {DEMO_USERS,DEMO_USER_IDS} from '../../src/data/demoUsers';
import {TAXPAYER_PROFILE_FIELD_ORDER} from '../../src/contracts/taxpayerProfileFieldLayout';

/** UI contract only: a mock preview capability keeps this test independent
 * of hosted SQL, Auth and any financial activity. Production ownership is
 * separately checked by the existing capability and RLS suites.
 */
async function openPreviewProfile(page:import('@playwright/test').Page,id:string,language:'en'|'bn'='en'){
  await page.goto('/?action=landing');
  await page.evaluate(({id,language})=>{
    sessionStorage.setItem('taxpay-taxpayer-preview-user',id);
    sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({
      profileId:id,capability:'P'.repeat(43),language,
      selectedListId:null,paymentSessionId:'00000000-0000-4000-8000-000000000001'
    }));
  },{id,language});
  await page.goto('/?action=account_profile');
}

test('all 30 preview accounts use the exact same User1-approved 24-field profile template',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Complete account parity matrix on desktop');
  test.setTimeout(180_000);
  const expected=TAXPAYER_PROFILE_FIELD_ORDER.map(([field])=>field);
  for(const id of DEMO_USER_IDS){
    await openPreviewProfile(page,id);
    const template=page.getByTestId('taxpayer-unified-profile-page');
    const profile=template.getByTestId('user1-taxpayer-profile');
    await expect(template.getByRole('heading',{name:'Taxpayer profile'})).toBeVisible();
    await expect(profile).toBeVisible();
    await expect(profile.getByText('Account: '+id)).toBeVisible();
    await expect(profile.locator('[data-profile-field="taxpayerName"]')).toContainText(DEMO_USERS[id].nameEn);
    expect(await profile.locator('[data-profile-field]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-profile-field'))),
      'exact same ordered fields for '+id).toEqual(expected);
    for(const card of ['profile-personal-card','profile-contact-card','profile-jurisdiction-card','profile-certificate-card']){
      await expect(profile.getByTestId(card)).toBeVisible();
    }
    if(id!=='user1'){
      await expect(profile).not.toContainText(DEMO_USERS.user1.nameEn);
      await expect(profile.locator('[data-profile-field="tin"]')).toContainText('Not available');
      await expect(profile.getByRole('button',{name:'Copy TIN'})).toBeDisabled();
    }
  }
});

test('small screens and Bengali retain the identical profile grid without overflow',async({page},info)=>{
  test.skip(!['mobile-320','mobile-375'].includes(info.project.name),'320/375 mobile layouts');
  test.setTimeout(90_000);
  for(const id of ['user1','user2','user15','user30'] as const){
    await openPreviewProfile(page,id,'bn');
    const template=page.getByTestId('taxpayer-unified-profile-page');
    const profile=template.getByTestId('user1-taxpayer-profile');
    await expect(template.getByRole('heading',{name:'করদাতা প্রোফাইল'})).toBeVisible();
    await expect(profile.getByText('অ্যাকাউন্ট: '+id)).toBeVisible();
    await expect(profile.locator('[data-profile-field="taxpayerName"]')).toContainText(DEMO_USERS[id].nameBn);
    await expect(profile.locator('[data-profile-field]')).toHaveCount(24);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),
      'no horizontal overflow: '+id).toBeLessThanOrEqual(2);
  }
});


test('unlinked demo registration uses a quiet empty state without fabricating e-TIN data',async({page},info)=>{
  test.skip(!['mobile-320','mobile-375','desktop-1280'].includes(info.project.name),'Profile empty-state parity');
  // A real capability-owned demo-registration read can legitimately have no
  // reviewed e-TIN row. The 13-digit scenario reference is not a certificate.
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
    const body=route.request().postDataJSON() as {action?:string};
    if(body?.action==='demo-registration'){
      await route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"data":null}'});
    }else await route.continue();
  });
  await openPreviewProfile(page,'user2');
  const profile=page.getByTestId('user1-taxpayer-profile');
  const notice=profile.getByTestId('registration-not-linked');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Registration record not linked');
  await expect(notice).toContainText('not an issued e-TIN');
  await expect(profile.locator('[data-profile-field="tin"]')).toContainText('Not available');
  await expect(profile.getByRole('button',{name:'Copy TIN'})).toBeDisabled();
  await expect(profile).not.toContainText('2222222222222');
  // Preserve every approved field in the template, but reveal the unverified
  // placeholders only on request, rather than repeating them across 4 cards.
  await expect(profile.locator('[data-profile-field]')).toHaveCount(24);
  const contact=profile.locator('[data-profile-field="mobileNumber"]');
  await expect(contact).toBeHidden();
  await expect(profile.getByTestId('profile-contact-card')).toContainText('No verified registration details linked.');
  await notice.getByRole('button',{name:'Show unavailable registration fields'}).click();
  await expect(contact).toBeVisible();
  await expect(contact).toContainText('Not available');
  await notice.getByRole('button',{name:'Hide unavailable registration fields'}).click();
  await expect(contact).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
