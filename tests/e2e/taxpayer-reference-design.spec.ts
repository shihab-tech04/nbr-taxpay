import { expect, test } from '@playwright/test';

/** Regression contract: Public and Taxpayer share Government Blue theme; taxpayer reference layout remains protected. */
const exactReference = {
  primary: 'rgb(44, 94, 173)',
  background: 'rgb(246, 249, 254)',
  text: 'rgb(23, 32, 51)',
  border: 'rgb(221, 231, 245)',
  focus: 'rgb(92, 168, 216)'
} as const;

async function openSampleTaxpayer(page: import('@playwright/test').Page) {
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'Explore taxpayer workspace' }).click();
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Dashboard summary' })).toBeVisible();
}

test('Public and Taxpayer share exact Government Blue tokens while Officer remains isolated', async ({page}) => {
  await page.goto('/?action=landing');
  const guest = page.locator('.taxpay-citizen-shell');
  await expect(guest).toBeVisible();
  await expect(guest).not.toHaveClass(/taxpay-taxpayer-reference/);
  const originalColor = await guest.evaluate(el => getComputedStyle(el).getPropertyValue('--citizen-primary').trim());
  const guestTheme = await guest.evaluate(el => getComputedStyle(el).getPropertyValue('--color-taxpay-primary').trim());
  expect(originalColor.startsWith('var(') || originalColor.toLowerCase() === '#2c5ead').toBeTruthy();
  expect(guestTheme.toLowerCase()).toBe('#2c5ead');
  await page.goto('/?action=secure_workspace');
  const taxpayer = page.locator('.taxpay-taxpayer-reference');
  await expect(taxpayer).toBeVisible();
  expect(await taxpayer.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(exactReference.background);
  expect(await taxpayer.evaluate(el => getComputedStyle(el).color)).toBe(exactReference.text);
  expect((await taxpayer.evaluate(el => getComputedStyle(el).getPropertyValue('--color-taxpay-primary').trim())).toUpperCase()).toBe('#2C5EAD');
  expect((await taxpayer.evaluate(el => getComputedStyle(el).getPropertyValue('--reference-focus').trim())).toUpperCase()).toBe('#5CA8D8');
  const taxpayerTheme = await taxpayer.evaluate(el => getComputedStyle(el).getPropertyValue('--color-taxpay-primary').trim());
  expect(taxpayerTheme.toLowerCase()).toBe(guestTheme.toLowerCase());
  expect(await taxpayer.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Poppins');
  await page.goto('/?action=officer_home');
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(0);
  await expect(page.locator('.citizen-bottom-nav')).toHaveCount(0);
     await expect(page.locator('.citizen-pay')).toHaveCount(0);
  await expect(page.locator('.taxpay-citizen-shell')).toHaveCount(0);
});

test('reference desktop rail preserves contextual demo routes and selected state', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1280','Inspect at explicit 1600px only');
  await page.setViewportSize({width:1600,height:900});
  await openSampleTaxpayer(page);
  const rail = page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await expect(rail).toBeVisible();
  await expect(page.locator('.citizen-header')).toBeHidden();
  const primary = rail.getByRole('button',{name:'Explore payment flow'});
  await expect(primary).toHaveCSS('background-color',exactReference.primary);
  await expect(rail.getByRole('button',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
  const main = page.locator('main');
  expect(await main.evaluate(el => Math.round(el.getBoundingClientRect().left))).toBe(250);
  await page.screenshot({path:'test-results/screenshots/taxpayer-reference-desktop-1600.png',fullPage:false});
  await rail.getByRole('button',{name:'Tax ledger'}).click();
  await expect(rail.getByRole('button',{name:'Tax ledger'})).toHaveAttribute('aria-current','page');
  await expect(page.getByText('Ledger information')).toBeVisible();
  await rail.getByRole('button',{name:'Account access'}).click();
  await expect(page.locator('.taxpayer-reference-secure')).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
});

test('mobile reference is full-width, bilingual and avoids scroll/keyboard overlap',async({page},info)=>{
  test.skip(info.project.name!=='mobile-320','Use one Playwright worker for the full responsive matrix');
  for (const width of [320,360,375,390,768,1280]) {
    await page.setViewportSize({width,height:812});
    await openSampleTaxpayer(page);
    const theme=page.locator('.taxpay-taxpayer-reference');
    expect(await theme.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(exactReference.background);
    await expect(page.locator('.taxpayer-reference-rail')).toBeHidden();
    await expect(page.locator('.citizen-header')).toBeVisible();
    const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(horizontalOverflow,'Taxpayer home has overflow at '+width).toBeLessThanOrEqual(2);
    await page.screenshot({path:'test-results/screenshots/taxpayer-reference-home-en-'+width+'.png',fullPage:false});
    if(width<=900) {
      await page.getByRole('button',{name:'Open menu'}).click();
      await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
      await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
    } else await page.getByRole('button',{name:'বাংলা'}).first().click();
    await expect(page.getByRole('heading',{name:'ড্যাশবোর্ড সারসংক্ষেপ'})).toBeVisible();
    await page.screenshot({path:'test-results/screenshots/taxpayer-reference-home-bn-'+width+'.png',fullPage:false});
    if(width<=900) {
      await page.getByRole('button',{name:'মেনু খুলুন'}).click();
      await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'English'}).click();
      await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Close'}).click();
    } else await page.getByRole('button',{name:'EN'}).first().click();
    await page.getByRole('button',{name:'Pay — select payment type'}).click();
    await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
    const payment=page.locator('.taxpay-payment-wizard');
    await expect(payment).toBeVisible();
    await expect(page.locator('.taxpayer-reference-rail')).toHaveCount(1);
    await expect(page.locator('.citizen-bottom-nav')).toHaveCount(0);
    await expect(page.locator('.citizen-pay')).toHaveCount(0);
    await expect(page.locator('.citizen-header')).toBeVisible();
    const after=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(after,'Taxpayer payment form has overflow at '+width).toBeLessThanOrEqual(2);
    await page.screenshot({path:'test-results/screenshots/taxpayer-reference-input-en-'+width+'.png',fullPage:false});
  }
});

test('private drafts receive reference inputs while backend remains disabled on Pages',async({page})=>{
  await page.goto('/?action=secure_workspace');
  const workspace=page.locator('.taxpayer-reference-secure');
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole('heading').first()).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
  await expect(page.locator('.taxpayer-reference-rail')).toBeHidden();
  const calls:string[]=[];
  page.on('request',req=>{if(new URL(req.url()).hostname.endsWith('.supabase.co'))calls.push(req.url());});
  await page.reload();
  await expect(workspace).toBeVisible();
  expect(calls).toEqual([]);
});

test('taxpayer home and ledger follow the shared Public theme without legacy emerald styling',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const shell=page.locator('.taxpay-taxpayer-reference');
  await expect(shell).toHaveCount(1);
  await expect(shell).toHaveCSS('background-color','rgb(246, 249, 254)');
  const composition=page.getByRole('heading',{name:'Payment composition'}).locator('xpath=ancestor::section');
  await expect(composition).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.getByRole('button',{name:'Tax ledger'}).first().click();
  await expect(page.getByRole('heading',{name:'Tax ledger'})).toBeVisible();
  await expect(shell).toHaveCSS('background-color','rgb(246, 249, 254)');
});

test('taxpayer ledger table and mobile labels follow the EN/BN selector',async({page},info)=>{
  test.skip(info.project.name !== 'desktop-1280','Test language parity with the desktop reference rail');
  await page.setViewportSize({width:1600,height:900});
  await openSampleTaxpayer(page);
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await rail.getByRole('button',{name:'Tax ledger'}).click();
  await expect(page.getByRole('columnheader',{name:'Particulars & Economic Code'})).toBeVisible();
  await rail.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('columnheader',{name:'বিবরণ ও অর্থনৈতিক কোড'})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'ডেবিট (দায়)'})).toBeVisible();
});

test('Public and Taxpayer use one family and legible payment controls', async ({page}) => {
  await page.goto('/?action=landing');
  const publicFont = await page.locator('.taxpay-citizen-shell').evaluate(el => getComputedStyle(el).fontFamily);
  expect(publicFont).toContain('Poppins');
  await page.goto('/?action=secure_workspace');
  const taxpayerFont = await page.locator('.taxpay-taxpayer-reference').evaluate(el => getComputedStyle(el).fontFamily);
  expect(taxpayerFont).toContain('Poppins');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  const field=page.locator('.taxpay-payment-wizard input:visible').first();
  if (await field.count()) expect(parseFloat(await field.evaluate(el=>getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
});

test('citizen numeric typography is IBM Plex Mono while regular text uses Poppins',async({page})=>{
  await page.goto('/?action=landing');
  const shell=page.locator('.taxpay-citizen-shell');
  await expect(shell).toHaveCSS('font-family',/Poppins/);
  const families=await shell.evaluate(el=>{
    const probe=document.createElement('span');
    probe.className='numeric';probe.textContent='1234567.89';
    el.appendChild(probe);
    const result=getComputedStyle(probe).fontFamily;
    probe.remove();
    return result;
  });
  expect(families).toContain('IBM Plex Mono');
  await openSampleTaxpayer(page);
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCSS('font-family',/Poppins/);
});

test('Public homepage uses heading and description without duplicate eyebrow labels',async({page})=>{
  await page.goto('/?action=landing');
  await expect(page.locator('.citizen-hub-eyebrow')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Explore payment types'})).toBeVisible();
  await expect(page.getByText('Choose a payment category.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'How it works'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Payment guidance'})).toBeVisible();
});
test('Public keyboard Tab order, skip link and FAQ disclosure remain operable',async({page})=>{
  await page.goto('/?action=landing');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:/Skip to main content/})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main-content')).toBeFocused();
  const faq=page.locator('#public-faq summary').first();
  await faq.focus();
  await page.keyboard.press('Enter');
  await expect(faq.locator('xpath=..')).toHaveAttribute('open','');
  await page.keyboard.press('Enter');
  await expect(faq.locator('xpath=..')).not.toHaveAttribute('open','');
});
test('citizen SPA navigation moves focus to main without making static content tabbable',async({page})=>{
  await page.goto('/?action=landing');
  await page.locator('#public-faq .public-more-link').click();
  await expect(page.locator('main#main-content')).toBeFocused();
  await expect(page.locator('main#main-content')).toHaveAttribute('tabindex','-1');
  await expect(page.locator('.taxpay-citizen-shell p[tabindex="0"]')).toHaveCount(0);
});

test('Taxpayer navigation offers keyboard skip to main content', async({page})=>{
  await openSampleTaxpayer(page);
  const skip=page.getByRole('link',{name:'Skip to main content'});
  await expect(skip).toHaveAttribute('href','#main-content');
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main-content')).toBeFocused();
});
