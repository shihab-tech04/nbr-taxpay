import {expect,test} from '@playwright/test';

/**
 * This test runs with a disposable fake public endpoint configured only in the
 * dedicated CI step. No hosted Auth, registration data or financial writes.
 */
async function openProfile(page:import('@playwright/test').Page,language:'en'|'bn'){
  await page.goto('/?action=landing&lang='+language);
  await page.evaluate(language=>{
    sessionStorage.setItem('taxpay-taxpayer-preview-user','user2');
    sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({
      profileId:'user2',capability:'P'.repeat(43),language,
      selectedListId:null,paymentSessionId:'00000000-0000-4000-8000-000000000001'
    }));
  },language);
  await page.goto('/?action=account_profile&lang='+language);
}

test('no registration row preserves 24-field identity while hiding repetitive empty values',async({page})=>{
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
    const request=route.request().postDataJSON() as {action?:string};
    if(request?.action==='demo-registration'){
      // A valid owner can have no reviewed certificate; never fabricate a TIN.
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({success:true,data:null})});
    }else await route.continue();
  });
  await openProfile(page,'en');
  const profile=page.getByTestId('user1-taxpayer-profile');
  const notice=profile.getByTestId('registration-not-linked');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Registration record not linked');
  await expect(notice).toContainText('not an issued e-TIN');
  await expect(profile.locator('[data-profile-field="tin"]')).toContainText('Not available');
  await expect(profile.getByRole('button',{name:'Copy TIN'})).toBeDisabled();
  await expect(profile).not.toContainText('2222222222222');
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

  await openProfile(page,'bn');
  const bnProfile=page.getByTestId('user1-taxpayer-profile');
  await expect(bnProfile.getByTestId('registration-not-linked')).toContainText('নিবন্ধনের রেকর্ড সংযুক্ত নেই');
  await expect(bnProfile.locator('[data-profile-field]')).toHaveCount(24);
  await expect(bnProfile.getByRole('button',{name:'টিআইএন কপি করুন'})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
