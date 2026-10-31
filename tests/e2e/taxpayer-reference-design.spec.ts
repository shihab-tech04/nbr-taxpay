import { expect, test } from '@playwright/test';
import { enterTaxPayService } from './pay-tax-entry-helper';

/** Regression contract: preserve Korbritto primary while signed-in styling uses Sobaike Public tokens. */
const exactReference = {
  primary: 'rgb(44, 94, 173)',
  background: 'rgb(240, 242, 245)',
  text: 'rgb(5, 5, 5)',
  border: 'rgb(228, 230, 235)',
  focus: 'rgb(92, 168, 216)'
} as const;

async function openSampleTaxpayer(page: import('@playwright/test').Page) {
  await page.goto('/?action=taxpayer_home');
  const enter = page.getByRole('button', { name: 'Explore taxpayer workspace' });
  const dashboard = page.getByRole('heading', { name: 'Dashboard summary' });
  await expect(enter.or(dashboard).first()).toBeVisible();
  if (await enter.isVisible()) await enter.click();
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(1);
  await expect(dashboard).toBeVisible();
}

test('Public and Taxpayer retain Government Blue tokens; legacy Office URL returns to Public', async ({page}) => {
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
  expect(await taxpayer.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Noto Sans');
  await page.goto('/?action=officer_home');
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.locator('.taxpay-citizen-shell')).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(0);
  await expect(page.locator('header.bg-emerald-950')).toHaveCount(0);
});

test('reference desktop rail preserves contextual demo routes and selected state', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop-1280','Inspect at explicit 1600px only');
  await page.setViewportSize({width:1600,height:900});
  await openSampleTaxpayer(page);
  const rail = page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await expect(rail).toBeVisible();
  await expect(page.locator('.citizen-header')).toBeHidden();
  const bottom = rail.locator('.taxpayer-reference-rail-bottom');
  await expect(bottom.getByRole('button').first()).toHaveText('Profile');
  await expect(bottom.getByRole('button').last()).toHaveText('Exit workspace');
  await expect(rail.locator('.taxpayer-reference-links > button')).toHaveCount(5);
  await expect(rail.locator('.taxpayer-reference-links > button').nth(1)).toHaveText('Beneficiaries');
  await expect(rail.getByRole('button',{name:'Tax summary'})).toHaveCount(0);
  await expect(rail.locator('.taxpayer-reference-account')).toHaveCount(0);
  await expect(rail.getByRole('button',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
  await rail.getByRole('button',{name:'Beneficiaries',exact:true}).click();
  await expect(rail.getByRole('button',{name:'Beneficiaries',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('heading',{name:'Beneficiaries',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Manage taxpayer authorizations'})).toHaveCount(0);
  await rail.getByRole('button',{name:'Home',exact:true}).click();
  const main = page.locator('main');
  expect(await main.evaluate(el => Math.round(el.getBoundingClientRect().left))).toBe(250);
  await page.screenshot({path:'test-results/screenshots/taxpayer-reference-desktop-1600.png',fullPage:false});
  await rail.getByRole('button',{name:'Tax ledger'}).click();
  await expect(rail.getByRole('button',{name:'Tax ledger'})).toHaveAttribute('aria-current','page');
  await expect(page.getByText('Ledger information')).toBeVisible();
  await expect(rail.getByRole('button',{name:'Account access'})).toHaveCount(0);
  await bottom.getByRole('button',{name:'Profile',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Profile',exact:true}).first()).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
});

test('approved desktop rail adapts between 901px and 1439px without changing 1440px+ anchors or duplicating Pay',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One responsive desktop rail matrix');
  await page.setViewportSize({width:1600,height:900});
  await openSampleTaxpayer(page);
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  for (const width of [901,1024,1199,1200,1280,1366,1439,1440,1600,2048]) {
    await page.setViewportSize({width,height:900});
    const expectedRailWidth = width < 1440
      ? Math.min(239, Math.max(180, width * 0.17))
      : width >= 1920 ? 260 : width >= 1536 ? 250 : 240;
    const railBox = await rail.boundingBox();
    expect(railBox,'rail is visible at '+width).not.toBeNull();
    expect(Math.abs(railBox!.width - expectedRailWidth),'rail width at '+width).toBeLessThanOrEqual(1);
    const mainBox = await page.locator('#main-content').boundingBox();
    expect(mainBox,'main remains visible at '+width).not.toBeNull();
    expect(Math.abs(mainBox!.x - railBox!.width),'main starts after rail at '+width).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      'no horizontal overflow at '+width).toBeLessThanOrEqual(2);
    await expect(page.locator('.citizen-header')).toBeHidden();
    await expect(rail.locator('.taxpayer-reference-main-action')).toBeVisible();
    await expect(rail.getByRole('button',{name:'Home',exact:true}))
      .toHaveCSS('font-size', width < 1200 ? '14px' : '16px');
    if (width < 1200) await expect(rail).toHaveCSS('padding-left','10px');
    await expect(rail.getByRole('button',{name:'Home',exact:true})).toHaveCSS('box-shadow','none');
    await expect(page.locator('.citizen-pay')).toBeHidden();
    const overflow=await rail.evaluate(el=>el.scrollWidth-el.clientWidth);
    expect(overflow,`sidebar overflow at ${width}px`).toBeLessThanOrEqual(1);
    if ([901,1280,1439,1440,1600,2048].includes(width))
      await page.screenshot({path:`test-results/screenshots/taxpayer-sobaike-rail-${width}.png`,fullPage:false});
  }
});

test('mobile reference is full-width, bilingual and avoids scroll/keyboard overlap',async({page},info)=>{
  test.skip(info.project.name!=='mobile-320','Use one Playwright worker for the full responsive matrix');
  for (const width of [320,360,375,390,768,1280]) {
    await page.setViewportSize({width,height:812});
    await openSampleTaxpayer(page);
    const theme=page.locator('.taxpay-taxpayer-reference');
    expect(await theme.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(exactReference.background);
    if (width <= 900) {
      await expect(page.locator('.taxpayer-reference-rail')).toBeHidden();
      await expect(page.locator('.citizen-header')).toBeVisible();
    } else {
      await expect(page.locator('.taxpayer-reference-rail')).toBeVisible();
      await expect(page.locator('.citizen-header')).toBeHidden();
    }
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
    const services=page.getByRole('dialog',{name:'Pay Tax'});
    await enterTaxPayService(services, 'TAX_WITH_RETURN');
    await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
    const payment=services.locator('.payment-flow-embedded');
    await expect(payment).toBeVisible();
    await expect(page.locator('.taxpayer-reference-rail')).toHaveCount(1);
    // The dashboard navigation remains in the background while the modal is open.
    await expect(services).toBeVisible();
    if (width <= 900) await expect(page.locator('.citizen-header')).toBeVisible();
    else await expect(page.locator('.citizen-header')).toBeHidden();
    const after=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(after,'Taxpayer payment form has overflow at '+width).toBeLessThanOrEqual(2);
    await page.screenshot({path:'test-results/screenshots/taxpayer-reference-input-en-'+width+'.png',fullPage:false});
  }
});

test('taxpayer mobile header and Services menu keep desktop surface and readable navigation', async ({page},info) => {
  test.skip(info.project.name !== 'mobile-375', 'One runner checks the mobile width matrix');
  for (const width of [320,375,768,900]) {
    await page.setViewportSize({width,height:740});
    await openSampleTaxpayer(page);
    const header = page.locator('.citizen-header');
    await expect(header).toHaveCSS('background-color','rgb(255, 255, 255)');
    await header.getByRole('button',{name:'Open menu'}).click();
    const dialog = page.getByRole('dialog',{name:'Services & menu'});
    const nav = dialog.getByRole('navigation',{name:'Services navigation'});
    await expect(dialog).toBeVisible();
    for (const group of ['Navigation','Account']) {
      await expect(nav.getByText(group,{exact:true})).toBeVisible();
    }
    await expect(nav.getByText('Services',{exact:true})).toBeHidden();
    await expect(nav.getByText('Support',{exact:true})).toHaveCount(0);
    const items = nav.locator('.citizen-dialog__link:visible');
    await expect(items).toHaveCount(6);
    const styles = await items.evaluateAll(buttons => buttons.map(button => {
      const style = getComputedStyle(button);
      return {text:button.textContent?.trim(), color:style.color, background:style.backgroundColor,
        height:button.getBoundingClientRect().height};
    }));
    for (const item of styles) {
      expect(item.text).toBeTruthy();
      expect(item.color).not.toBe('rgb(255, 255, 255)');
      expect(item.height).toBeGreaterThanOrEqual(44);
    }
    await expect(nav.getByRole('button',{name:'Home',exact:true})).toHaveAttribute('aria-current','page');
    await expect(nav.getByRole('button',{name:'Notifications'})).toBeVisible();
    await expect(nav.getByRole('button',{name:'Beneficiaries'})).toBeVisible();
    await expect(nav.getByRole('button',{name:'Profile',exact:true})).toBeVisible();
    await expect(nav.getByRole('button',{name:'Payment services'})).toHaveCount(0);
    await dialog.getByRole('button',{name:'বাংলা'}).click();
    const bengaliDialog = page.getByRole('dialog',{name:'সেবা ও মেনু'});
    await expect(bengaliDialog.getByRole('button',{name:'বিজ্ঞপ্তি'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(bengaliDialog).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
});

test('private drafts receive reference inputs while backend remains disabled on Pages',async({page})=>{
  await page.goto('/?action=secure_workspace');
  const workspace=page.locator('.taxpayer-reference-secure');
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole('heading').first()).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) >= 901) await expect(page.locator('.taxpayer-reference-rail')).toBeVisible();
  else await expect(page.locator('.taxpayer-reference-rail')).toBeHidden();
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
  await expect(shell).toHaveCSS('background-color',exactReference.background);
  const composition=page.getByRole('heading',{name:'Payment composition'}).locator('xpath=ancestor::section');
  await expect(composition).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.getByRole('button',{name:'Tax ledger'}).first().click();
  await expect(page.getByRole('heading',{name:'Tax ledger'})).toBeVisible();
  await expect(shell).toHaveCSS('background-color',exactReference.background);
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

test('Guest retains its original font; signed-in taxpayer uses Sobaike Public Noto and legible controls', async ({page}) => {
  await page.goto('/?action=landing');
  const publicFont = await page.locator('.taxpay-citizen-shell').evaluate(el => getComputedStyle(el).fontFamily);
  expect(publicFont).toContain('Poppins');
  await page.goto('/?action=secure_workspace');
  const taxpayerFont = await page.locator('.taxpay-taxpayer-reference').evaluate(el => getComputedStyle(el).fontFamily);
  expect(taxpayerFont).toContain('Noto Sans');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  const services=page.getByRole('dialog',{name:'Pay Tax'});
  await enterTaxPayService(services, 'TAX_WITH_RETURN');
  const field=services.locator('#guest-tin');
  if (await field.count()) expect(parseFloat(await field.evaluate(el=>getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
});

test('Guest numbers retain IBM Plex Mono, signed-in workspace uses Noto Sans',async({page})=>{
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
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCSS('font-family',/Noto Sans/);
});

test('Public homepage uses heading and description without duplicate eyebrow labels',async({page})=>{
  await page.goto('/?action=landing');
  await expect(page.locator('.citizen-hub-eyebrow')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'How your payment works'})).toBeVisible();
  await expect(page.getByText('Choose who you are paying for, then select one of two services and follow these four steps.')).toBeVisible();
  await expect(page.locator('.public-payment-path__steps li')).toHaveCount(4);
  await expect(page.getByRole('heading',{name:'Common questions'})).toBeVisible();
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
  await page.locator('#public-faq details').last().locator('summary').click();
  await page.locator('#public-faq .public-faq-layout__guide-link').click();
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
