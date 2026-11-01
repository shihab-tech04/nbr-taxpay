import {test,expect} from '@playwright/test';

// Saved beneficiaries belong to a verified TaxPay account, not an anonymous
// browser capability. The private route protects the screen before data loads.
test('signed-out Beneficiaries deep links require verified taxpayer sign-in',async({page})=>{
  for(const language of ['en','bn'] as const){
    const suffix=language==='bn'?'&lang=bn':'';
    await page.goto('/?action=beneficiaries'+suffix);
    await expect(page.getByRole('heading',{name:language==='bn'?'উপকারভোগী দেখতে সাইন ইন করুন':'Sign in to manage beneficiaries'})).toBeVisible();
    await expect(page.getByRole('textbox',{name:language==='bn'?'ইমেইল ঠিকানা':'Email address'})).toBeVisible();
    await expect(page.getByRole('button',{name:language==='bn'?'সাইন-ইন লিংক পাঠান':'Email sign-in link'})).toBeDisabled();
    await expect(page.getByRole('button',{name:'Use User ID (sample account)'})).toHaveCount(0);
    await expect(page.getByTestId('beneficiaries-page')).toHaveCount(0);
    await expect(page.locator('.taxpayer-reference-rail')).toHaveCount(0);
    await expect(page.getByRole('navigation',{name:language==='bn'?'প্রধান নেভিগেশন':'Main navigation'}).getByRole('button',{name:language==='bn'?'উপকারভোগী':'Beneficiaries'})).toHaveCount(0);
  }
});
