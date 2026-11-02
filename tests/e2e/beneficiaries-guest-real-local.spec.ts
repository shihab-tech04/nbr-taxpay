import {test,expect} from '@playwright/test';

// Saved beneficiaries belong to a verified TaxPay account, not an anonymous
// browser capability. The private route protects the screen before data loads.
test('signed-out Beneficiaries deep links require verified taxpayer sign-in',async({page})=>{
  for(const language of ['en','bn'] as const){
    const suffix=language==='bn'?'&lang=bn':'';
    await page.goto('/?action=beneficiaries'+suffix);
    const modal=page.locator('.taxpay-modal.taxpayer-login-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByRole('heading',{name:language==='bn'?'করদাতার ব্যক্তিগত তথ্য':'Private taxpayer workspace'})).toHaveCount(0);
    const email=modal.getByRole('button',{name:language==='bn'?'ইমেইল দিয়ে সাইন ইন':'Sign in with email'});
    await expect(email).toBeVisible();
    await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
    await expect(page.locator('.taxpayer-reference-rail')).toHaveCount(0);
    await expect(page.getByRole('navigation',{name:language==='bn'?'প্রধান নেভিগেশন':'Main navigation'}).getByRole('button',{name:language==='bn'?'উপকারভোগী':'Beneficiaries'})).toHaveCount(0);
    await email.click();
    await expect(page).toHaveURL(/action=secure_workspace/);
    await expect(page).toHaveURL(/returnTo=beneficiaries/);
  }
});
