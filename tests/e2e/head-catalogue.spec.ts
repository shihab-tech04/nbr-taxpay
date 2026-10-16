import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function switchToBangla(page: import('@playwright/test').Page) {
 const desktopSwitch=page.getByRole('button',{name:'বাংলা'});
 if(await desktopSwitch.isVisible()){
  await desktopSwitch.click();
  return;
 }
 await page.getByRole('button',{name:'Open menu'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'বাংলা'}).click();
 await page.keyboard.press('Escape');
}

test('original 170-head source reference remains available read-only on its dedicated route',async({page})=>{
 await page.goto('/?action=head_catalogue');
 await expect(page.getByRole('heading',{name:'Original v11 payment-head reference'})).toBeVisible();
 await expect(page.getByText('Legal validity and current applicability: UNVERIFIED')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Surcharge',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Pay',exact:true})).toHaveCount(0);
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
  await switchToBangla(page);
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

test('public information home has bilingual safety copy and no prototype status',async({page})=>{
 await page.goto('/?action=landing');
 await switchToBangla(page);
 await expect(page.getByRole('heading',{name:'কর পরিশোধ বুঝুন, নিজের লেনদেন জানুন।'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'কর পরিশোধের ধরন জানুন'})).toBeVisible();
 await expect(page.locator('footer').getByText('এখানে সরকারি পেমেন্ট বা চালান ইস্যু হয় না।')).toHaveCount(0);
 await expect(page.getByText('Prototype status')).toHaveCount(0);
 const bounds=await page.locator('main').boundingBox();
 expect(bounds).not.toBeNull();
 expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width+2);
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

test('public footer accurately describes service and does not promise challan issuance',async({page})=>{
 await page.goto('/?action=landing');
 const footer=page.locator('footer');
 await expect(footer.getByText('Income tax payment information')).toBeVisible();
 await expect(footer.getByText('No government payments or challans are issued here.')).toHaveCount(0);
 await page.getByRole('button',{name:'বাংলা'}).click();
 await expect(footer.getByText('আয়কর পরিশোধের তথ্য')).toBeVisible();
 await expect(footer.getByText('এখানে সরকারি পেমেন্ট বা চালান ইস্যু হয় না।')).toHaveCount(0);
});

test('public header exposes information only and no role impersonation control',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/?action=landing');
 const header=page.locator('.public-home-header');
 await expect(header.getByText('TaxPay',{exact:true})).toBeVisible();
 await expect(header.getByRole('button',{name:'Menu'})).toBeVisible();
 await header.getByRole('button',{name:'Menu'}).click();
 await expect(header.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'FAQs'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Demo role'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Sign out'})).toHaveCount(0);
 await page.keyboard.press('Escape');
 await expect(header.getByRole('navigation',{name:'Primary navigation'})).toBeHidden();
});

test('catalogue explicitly blocks payability without period/event/taxpayer evidence',async ({page})=>{
 await page.goto('/?action=head_catalogue');
 await expect(page.getByText(/No verified taxpayer-class, payment-event, effective-date/)).toBeVisible();
 await page.getByRole('button',{name:'বাংলা'}).click();
 await expect(page.getByText(/করদাতার ধরন, পরিশোধের ঘটনা, কার্যকারিতার তারিখ/)).toBeVisible();
});
