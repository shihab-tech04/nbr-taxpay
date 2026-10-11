import { expect, test } from '@playwright/test';

test('TaxPay cannot be mistaken for a government-owned portal', async ({page}) => {
  await page.goto('/?action=landing');
  await expect(page.getByText('TaxPay development preview — not an official NBR gateway')).toBeVisible();
  const header = page.locator('header').first();
  await expect(header.getByText('TaxPay', {exact:true})).toBeVisible();
  await expect(header.getByText('Independent Income Tax Payment Development Preview')).toBeVisible();
  await expect(header.getByRole('combobox',{name:'Demo role selector — not real authorization'})).toBeVisible();
  await expect(page.locator('footer').getByText(/not an official NBR website/)).toBeVisible();
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(header.getByText('TaxPay — ট্যাক্সপে')).toBeVisible();
  await expect(page.locator('footer').getByText(/সরকারি NBR ওয়েবসাইট নয়/)).toBeVisible();
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
  const menu=header.getByRole('button',{name:'Mobile navigation'});
  await expect(menu).toHaveAttribute('aria-expanded','false');
  const bounds=await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(43.5);
  expect(bounds!.height).toBeGreaterThanOrEqual(43.5);
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#taxpay-mobile-menu')).toBeVisible();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(header.getByRole('button',{name:'TaxPay মূল পাতা'})).toBeVisible();
  await expect(header.getByRole('button',{name:'মোবাইল নেভিগেশন'})).toBeVisible();
});
