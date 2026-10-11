import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing link opens the original 170-head reference without submitting a payment', async ({ page }) => {
  await page.goto('/?action=landing');
  await expect(page.getByText('Independent TaxPay Workspace')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  await page.getByRole('button', { name: /Browse Original Heads \(170\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Original v11 payment-head reference' })).toBeVisible();
  await expect(page.getByText('Legal validity and current applicability: UNVERIFIED')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Surcharge', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay', exact: true })).toHaveCount(0);
});

test('search is exact-source, no silent fallback, and owner-review IDs stay blocked', async ({ page }) => {
  await page.goto('/?action=head_catalogue');
  const search = page.getByRole('searchbox', { name: /Search by head ID/ });
  await search.fill('19AAAAA');
  await expect(page.getByText('Matching source records: 1 / 170')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tax on undisclosed investment in flat, house,land' })).toBeVisible();
  await expect(page.getByText(/OWNER REVIEW REQUIRED/)).toBeVisible();
  await expect(page.getByText('No Bangla label in the original source')).toBeVisible();
  await search.fill('zzzzzz-no-matching-head');
  await expect(page.getByText('Matching source records: 0 / 170')).toBeVisible();
  await expect(page.getByText(/Nothing has been automatically selected/)).toBeVisible();
  await search.fill('56(1)(28)');
  await expect(page.getByRole('heading', { name: 'Any other payments' })).toBeVisible();
  await expect(page.getByText(/OWNER REVIEW REQUIRED/)).toBeVisible();
});

test('seven source group filter and Bengali translation are available by keyboard', async ({ page }) => {
  await page.goto('/?action=head_catalogue');
  const selector = page.getByLabel('Original source group');
  await selector.selectOption('Source Tax');
  await expect(page.getByText('Matching source records: 127 / 170')).toBeVisible();
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByRole('heading', { name: 'মূল v11 কর পরিশোধের খাতের তালিকা' })).toBeVisible();
  await expect(page.getByText('অনুসন্ধানে পাওয়া খাত: 127 / 170')).toBeVisible();
});

test('mobile-first content stays within viewport and controls provide touch-friendly targets', async ({ page }) => {
  await page.goto('/?action=head_catalogue');
  await expect(page.getByRole('heading', { name: 'Original v11 payment-head reference' })).toBeVisible();
  const mainBounds = await page.locator('main').boundingBox();
  expect(mainBounds).not.toBeNull();
  expect(mainBounds!.x).toBeGreaterThanOrEqual(-1);
  expect(mainBounds!.x + mainBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 2);
  for (const selector of ['#v11-head-query', '#v11-head-group']) {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
  }
  await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 9')).toBeVisible();
});

test('catalogue main content passes WCAG A/AA automated rules', async ({ page }) => {
  await page.goto('/?action=head_catalogue');
  await expect(page.getByRole('heading', { name: 'Original v11 payment-head reference' })).toBeVisible();
  const results = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
});

test('legacy source codes and legal provisions remain visibly separate', async ({ page }) => {
  await page.goto('/?action=head_catalogue');
  await page.getByRole('searchbox', { name: /Search by head ID/ }).fill('19AAAAA');
  await expect(page.getByRole('heading', { name: 'Verified Income Tax Ordinance 1984 section' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verified Income Tax Act 2023 section' })).toBeVisible();
  await expect(page.getByText('No official mapping verified')).toHaveCount(2);
  await expect(page.getByText(/ACS Treasury economic code: NOT VERIFIED/)).toBeVisible();
});

test('public preview safety disclosure remains explicit in Bengali and on narrow screens', async ({ page }) => {
  await page.goto('/?action=landing');
  await page.getByRole('button', { name: 'বাংলা' }).click();
  await expect(page.getByText('স্বতন্ত্র TaxPay ওয়ার্কস্পেস')).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByText('কর পরিশোধের বিভাগ (যাচাই চলমান)')).toBeVisible();
  const main = await page.locator('main').boundingBox();
  expect(main).not.toBeNull();
  expect(main!.x + main!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 2);
});

test('source integrity is announced only after verified read-only backend match', async ({ page }) => {
  await page.goto('/?action=head_catalogue');
  await expect(page.getByTestId('catalogue-source-status')).toContainText(
    'Database reference matches all 170 controlled v11 source records.'
  );
});
test('when source backend is unreachable, read-only offline fallback is explicit', async ({ page }) => {
  await page.route('**/rest/v1/taxpay_head_source_candidates**', route => route.abort('failed'));
  await page.goto('/?action=head_catalogue');
  await expect(page.getByTestId('catalogue-source-status')).toContainText('Supabase reference could not be verified.');
  await expect(page.getByRole('heading', { name: 'Surcharge', exact: true })).toBeVisible();
  await expect(page.getByText('Legal validity and current applicability: UNVERIFIED')).toBeVisible();
});

test('footer does not claim government ownership or real challan issuance in EN/BN', async ({ page }) => {
  await page.goto('/?action=landing');
  const footer = page.locator('footer');
  await expect(footer.getByText('Independent tax payment workspace')).toBeVisible();
  await expect(footer.getByText('© 2026 TaxPay')).toBeVisible();
  await page.getByRole('button',{ name: 'বাংলা' }).click();
  await expect(footer.getByText('স্বতন্ত্র কর পরিশোধ ওয়ার্কস্পেস')).toBeVisible();
  await expect(footer.getByText('© ২০২৬ TaxPay')).toBeVisible();
});

test('shared header remains visibly TaxPay-branded and demo roles cannot imply officer authorization', async ({page})=>{
  await page.goto('/?action=landing');
  const header=page.locator('header').first();
  await expect(header.getByText('TaxPay', {exact:true})).toBeVisible();
  await expect(header.getByText('Independent Tax Payment Workspace')).toBeVisible();
  const selector=header.getByRole('combobox',{name:'Sample profile selector — not account access'});
  await expect(selector).toBeVisible();
  await expect(selector.locator('option[value="OFFICER_APPROVER"]')).toHaveText('Example Commissioner (Approver)');
  await selector.selectOption('OFFICER_APPROVER');
  await expect(page.getByText('DEMONSTRATION & PROTOTYPE ENVIRONMENT', {exact:false})).toHaveCount(0);
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(header.getByText('TaxPay — ট্যাক্সপে')).toBeVisible();
  await expect(header.getByRole('combobox',{name:'নমুনা প্রোফাইল নির্বাচন; অ্যাকাউন্ট অ্যাক্সেস নয়'})).toBeVisible();
});

test('catalogue explicitly blocks payability without period/event/taxpayer evidence',async ({page})=>{
 await page.goto('/?action=head_catalogue');
 await expect(page.getByText(/No verified taxpayer-class, payment-event, effective-date/)).toBeVisible();
 await page.getByRole('button',{name:'বাংলা'}).click();
 await expect(page.getByText(/করদাতার ধরন, পরিশোধের ঘটনা, কার্যকারিতার তারিখ/)).toBeVisible();
});
