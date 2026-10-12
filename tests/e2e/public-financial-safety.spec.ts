import { expect, test } from '@playwright/test';

test('TaxPay cannot be mistaken for a government-owned portal', async ({page}) => {
  await page.goto('/?action=landing');
  await expect(page.getByText('Independent TaxPay Workspace')).toBeVisible();
  const header = page.locator('header').first();
  await expect(header.getByText('TaxPay', {exact:true})).toBeVisible();
  await expect(header.getByText('Independent payment demonstration')).toBeVisible();
  await page.getByRole('button',{name:'Open menu'}).click();
  await expect(page.getByRole('combobox',{name:'Sample profile (not sign-in)'})).toBeVisible();
  await expect(page.getByText('Selecting a profile is not authentication or authorization.')).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.locator('footer').getByText('Independent tax payment workspace')).toBeVisible();
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(header.getByText('TaxPay',{exact:true})).toBeVisible();
  await expect(page.locator('footer').getByText('স্বতন্ত্র কর পরিশোধ ওয়ার্কস্পেস')).toBeVisible();
});

test('unverified tax calculator never quotes fictitious slab liability', async ({page}) => {
  await page.goto('/?action=guidance');
  await expect(page.getByRole('heading',{name:'Individual income tax estimator — unavailable'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Proceed to Pay Estimated Tax'})).toHaveCount(0);
  await expect(page.getByText(/No verified, year-specific income tax thresholds/)).toBeVisible();
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('heading',{name:'ব্যক্তিগত আয়কর হিসাব — বর্তমানে বন্ধ'})).toBeVisible();
});

test('travel tax simulation cannot be presented as a real immigration challan',async ({page})=>{
  await page.goto('/?action=travel');
  await expect(page.getByText(/No official passenger verification, government fee collection or immigration clearance/)).toBeVisible();
  await expect(page.getByText(/SOURCE NOT IN INPUTS \/ LEGAL VALIDITY UNVERIFIED/)).toBeVisible();
});

test('mobile navigation and home brand are keyboard accessible with 44px touch targets', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-1280', 'Mobile menu is intentionally hidden on desktop');
  await page.goto('/?action=landing');
  const header=page.locator('header').first();
  const home=header.getByRole('button',{name:'TaxPay home'});
  await expect(home).toBeVisible();
  await home.focus();
  await expect(home).toBeFocused();
  const menu=header.getByRole('button',{name:'Open menu'});
  await expect(menu).toBeVisible();
  const bounds=await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(43.5);
  expect(bounds!.height).toBeGreaterThanOrEqual(43.5);
  await menu.click();
  await expect(page.getByRole('dialog',{name:'Services & menu'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(header.getByRole('button',{name:'TaxPay মূল পাতা'})).toBeVisible();
  await expect(header.getByRole('button',{name:'মেনু খুলুন'})).toBeVisible();
});
