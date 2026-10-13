import { expect, test } from '@playwright/test';

/** Reference token assertions come from the Sobaike Janao source, not screenshots. */
const exactReference = {
  primary: 'rgb(27, 77, 107)',
  background: 'rgb(240, 242, 245)',
  text: 'rgb(5, 5, 5)',
  border: 'rgb(228, 230, 235)',
  focus: 'rgb(58, 124, 165)'
} as const;

async function openSampleTaxpayer(page: import('@playwright/test').Page) {
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button', { name: 'Explore taxpayer workspace' }).click();
  await expect(page.locator('.taxpay-taxpayer-reference')).toHaveCount(1);
  await expect(page.getByText('Taxpayer workspace')).toBeVisible();
}

test('the exact palette applies only to taxpayer screens, not Guest or Officer', async ({page}) => {
  await page.goto('/?action=landing');
  const guest = page.locator('.taxpay-citizen-shell');
  await expect(guest).toBeVisible();
  await expect(guest).not.toHaveClass(/taxpay-taxpayer-reference/);
  const originalColor = await guest.evaluate(el => getComputedStyle(el).getPropertyValue('--citizen-primary').trim());
  const guestTheme = await guest.evaluate(el => getComputedStyle(el).getPropertyValue('--color-taxpay-primary').trim());
  expect(originalColor.startsWith('var(') || originalColor !== '#1B4D6B').toBeTruthy();
  expect(guestTheme.toLowerCase()).toBe('#2c5ead');
  await page.goto('/?action=secure_workspace');
  const taxpayer = page.locator('.taxpay-taxpayer-reference');
  await expect(taxpayer).toBeVisible();
  expect(await taxpayer.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(exactReference.background);
  expect(await taxpayer.evaluate(el => getComputedStyle(el).color)).toBe(exactReference.text);
  expect((await taxpayer.evaluate(el => getComputedStyle(el).getPropertyValue('--color-taxpay-primary').trim())).toUpperCase()).toBe('#1B4D6B');
  expect((await taxpayer.evaluate(el => getComputedStyle(el).getPropertyValue('--reference-focus').trim())).toUpperCase()).toBe('#3A7CA5');
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
  await expect(page.getByText('Example entries · Not an account statement')).toBeVisible();
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
    await expect(page.getByRole('heading',{name:'আমার কর পেমেন্ট'})).toBeVisible();
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
    await expect(page.locator('.taxpayer-reference-rail')).toHaveCount(0);
    if(width<768) {
      await expect(payment.locator('> div').first()).toHaveCSS('border-top-width','0px');
    }
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
