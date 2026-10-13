import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('public home does not open guest payment wizard via a primary action',async({page})=>{
 await page.goto('/?action=landing');
 await expect(page.getByRole('link',{name:'Login'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Pay — select payment type'})).toHaveCount(0);
 await expect(page.locator('.citizen-pay')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Explore payment types'})).toBeVisible();
 await page.goto('/?action=guest');
 await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toBeVisible();
});

test('guest cannot directly open taxpayer ledger or account activity', async ({page}) => {
  await page.goto('/?action=ledger');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
  await expect(page.getByRole('heading',{name:/Illustrative Tax Ledger/})).toHaveCount(0);
  await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
  await expect(page.getByText('Taxpayer workspace · sample profile')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tax position'})).toBeVisible();
});

test('public menu contains informational navigation with no sample profile selector',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'Menu'}).click();
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav.getByRole('link',{name:'FAQs'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Sample profile (not sign-in)'})).toHaveCount(0);
 await page.keyboard.press('Escape');
 await expect(nav).toBeHidden();
 await page.getByRole('button',{name:'বাংলা'}).click();
 await expect(page.getByRole('button',{name:'মেনু'})).toBeVisible();
});

test('public information header and sections fit all six approved widths',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','One runner covers six widths');
 for(const width of [320,360,375,390,768,1280]){
  await page.setViewportSize({width,height:812});
  await page.goto('/?action=landing');
  await expect(page.locator('.public-home-header')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  if(width<=900){
    await page.getByRole('button',{name:'Menu'}).click();
    await expect(page.getByRole('navigation',{name:'Primary navigation'})).toBeVisible();
    await page.keyboard.press('Escape');
  }else{
    await expect(page.getByRole('navigation',{name:'Primary navigation'})).toBeVisible();
  }
 }
});

test('payment flow suppresses global pay and keeps account demo in both languages',async({page})=>{
  await page.goto('/?action=travel');
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  await expect(page.getByText('Demo payment flow')).toBeVisible();
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByText('নমুনা পেমেন্ট প্রক্রিয়া')).toBeVisible();
});

test('citizen navigation has no automated serious accessibility violations',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile navigation audit evaluated in 320/375 variants');
  await page.goto('/?action=landing');
  const results=await new AxeBuilder({page}).include('.public-home-header').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});


test('public guidance links stay on-page without authorizing account access',async({page})=>{
 await page.goto('/?action=landing');
 if (page.viewportSize()!.width<=900) await page.getByRole('button',{name:'Menu'}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'Payment types'}).click();
 await expect(page.getByRole('heading',{name:'Explore payment types'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Login'})).toHaveCount(1);
 await expect(page.locator('.citizen-pay')).toHaveCount(0);
});

test('leaving an active payment through the logo confirms before discarding entered details', async ({page}) => {
  await page.goto('/?action=guest');
  await page.getByLabel('Taxpayer Identification Number (e-TIN)').fill('123456789012');
  const prompt = page.waitForEvent('dialog');
  const clickHome = page.getByRole('button', { name: 'TaxPay home' }).click();
  const dialog = await prompt;
  expect(dialog.type()).toBe('confirm');
  expect(dialog.message()).toContain('information entered so far will be lost');
  await dialog.dismiss();
  await clickHome;
  await expect(page.getByRole('heading', { name: 'Guest Income Tax Payment' })).toBeVisible();
  await expect(page.getByLabel('Taxpayer Identification Number (e-TIN)')).toHaveValue('123456789012');

  const confirmExit = page.waitForEvent('dialog');
  const clickHomeAgain = page.getByRole('button', { name: 'TaxPay home' }).click();
  await (await confirmExit).accept();
  await clickHomeAgain;
  await expect(page.getByRole('heading', { name: 'Understand tax payments. Stay in control.' })).toBeVisible();
});


test('taxpayer full and compact views remain usable at six audited widths', async ({page},info) => {
  test.skip(info.project.name!=='mobile-320','Single runner captures the full viewport matrix');
  for (const width of [320,360,375,390,768,1280]) {
    await page.setViewportSize({width,height:812});
    await page.goto('/?action=taxpayer_home');
    await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
    await expect(page.getByText('Taxpayer workspace · sample profile')).toBeVisible();
    await page.screenshot({path:'test-results/screenshots/taxpayer-expanded-'+width+'.png',fullPage:false});
    const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width+2);
    await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
    if(width<=900) {
      await page.evaluate(()=>window.scrollTo(0,450));
      await expect(page.locator('.citizen-header')).toHaveClass(/citizen-header--hidden/);
      await expect(page.locator('.citizen-header')).toHaveCSS('visibility','hidden');
      await expect(page.locator('.citizen-corners').getByRole('button',{name:'Activity'})).toBeVisible();
      await expect(page.locator('.citizen-corners').getByRole('button',{name:'Home'})).toBeVisible();
      await page.screenshot({path:'test-results/screenshots/taxpayer-compact-'+width+'.png',fullPage:false});
    } else {
      await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
    }
  }
});
