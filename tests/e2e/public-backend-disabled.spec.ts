import { expect, test } from '@playwright/test';

test('public preview keeps Auth and drafts disabled without explicit backend configuration', async ({ page }) => {
  const hostedSupabaseRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname.endsWith('.supabase.co')) hostedSupabaseRequests.push(url.hostname);
  });

  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading', { name: 'Secure Korbritto workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account unavailable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in with email' })).toHaveCount(0);
  await expect(page.getByText('Sign-in and saved drafts are not available right now.')).toBeVisible();
  await expect.poll(() => hostedSupabaseRequests).toEqual([]);

  if (await page.locator('.citizen-mobile-menu-trigger').isVisible()) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('dialog', { name: 'Services & menu' }).getByRole('button', { name: 'বাংলা' }).click();
    await page.getByRole('dialog', { name: 'সেবা ও মেনু' }).getByRole('button', { name: 'বন্ধ করুন' }).click();
  } else if (await page.getByRole('complementary',{name:'Taxpayer desktop navigation'}).isVisible()) {
    await page.getByRole('complementary',{name:'Taxpayer desktop navigation'}).getByRole('button', { name: 'বাংলা' }).click();
  } else {
    await page.locator('.citizen-header').getByRole('button', { name: 'বাংলা' }).click();
  }
  await expect(page.getByRole('heading', { name: 'নিরাপদ করবৃত্ত ওয়ার্কস্পেস' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'অ্যাকাউন্ট আপাতত চালু নেই' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'সাইন ইন লিংক পাঠান' })).toHaveCount(0);
  await expect.poll(() => hostedSupabaseRequests).toEqual([]);
});
