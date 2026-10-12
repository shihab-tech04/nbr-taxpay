import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('guest payment selection preserves purpose without entering taxpayer wizard', async ({page}) => {
  await page.goto('/?action=landing');
  const pay = page.getByRole('button',{name:'Pay — select payment type'});
  await expect(pay).toBeVisible();
  await pay.click();
  const picker = page.getByRole('dialog',{name:'Select payment type'});
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('button',{name:'Travel Tax',exact:true})).toBeVisible();
  await picker.getByRole('button',{name:'Advance Tax'}).click();
  await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toBeVisible();
  await expect(page.getByText('Selected purpose: Advance Tax')).toBeVisible();
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  await expect(page.getByText('Demo payment flow')).toBeVisible();
});

test('guest cannot directly open taxpayer ledger or account activity', async ({page}) => {
  await page.goto('/?action=ledger');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
  await expect(page.getByRole('heading',{name:/Illustrative Tax Ledger/})).toHaveCount(0);
  await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
  await expect(page.getByText('Taxpayer home · sample data')).toBeVisible();
  await expect(page.getByText('Not reconciled with eReturn / NBR')).toBeVisible();
});

test('guest menu preserves clear demo profile separation and keyboard escape', async ({page}) => {
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Open menu'}).click();
  const menu = page.getByRole('dialog',{name:'Services & menu'});
  await expect(menu.getByRole('combobox',{name:'Sample profile (not sign-in)'})).toBeVisible();
  await expect(menu.getByText('Selecting a profile is not authentication or authorization.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('button',{name:'মেনু খুলুন'})).toBeVisible();
});

test('scroll direction adapts four corners across approved mobile widths', async ({page}, info) => {
  test.skip(info.project.name !== 'mobile-320', 'All width matrix runs once to avoid duplicates');
  for(const width of [320,360,375,390,768,1280]) {
    await page.setViewportSize({width,height:812});
    await page.goto('/?action=landing');
    const header = page.locator('.citizen-header');
    await expect(header).toBeVisible();
    await page.screenshot({path:'test-results/screenshots/guest-expanded-'+width+'.png',fullPage:false});
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(width+2);
    if(width<=900) {
      await page.evaluate(() => window.scrollTo(0,350));
      await expect(header).toHaveClass(/citizen-header--hidden/);
      const corners=page.locator('.citizen-corner');
      await expect(corners).toHaveCount(3);
      await expect(page.locator('.citizen-corners').getByRole('button',{name:'Open menu'})).toBeVisible();
      await expect(page.locator('.citizen-corners').getByRole('button',{name:'Payment Status'})).toBeVisible();
      await expect(page.locator('.citizen-corners').getByRole('button',{name:'Home',exact:true})).toBeVisible();
      await expect(page.locator('.citizen-pay')).toBeVisible();
      await page.screenshot({path:'test-results/screenshots/guest-compact-'+width+'.png',fullPage:false});
      await page.evaluate(() => window.scrollBy(0,-60));
      await expect(header).not.toHaveClass(/citizen-header--hidden/);
    } else {
      await expect(header.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
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
  const results=await new AxeBuilder({page}).include('.citizen-header').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});


test('browser back restores route and expanded navigation after payment entry',async({page})=>{
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  await page.getByRole('dialog',{name:'Select payment type'}).getByRole('button',{name:'Advance Tax',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Independent TaxPay Workspace')).toBeVisible();
  await expect(page.locator('.citizen-header')).not.toHaveClass(/citizen-header--hidden/);
});


test('taxpayer full and compact views remain usable at six audited widths', async ({page},info) => {
  test.skip(info.project.name!=='mobile-320','Single runner captures the full viewport matrix');
  for (const width of [320,360,375,390,768,1280]) {
    await page.setViewportSize({width,height:812});
    await page.goto('/?action=taxpayer_home');
    await page.getByRole('button',{name:'View sample taxpayer demonstration'}).click();
    await expect(page.getByText('Taxpayer home · sample data')).toBeVisible();
    await page.screenshot({path:'test-results/screenshots/taxpayer-expanded-'+width+'.png',fullPage:false});
    const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width+2);
    await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
    if(width<=900) {
      await page.evaluate(()=>window.scrollTo(0,450));
      await expect(page.locator('.citizen-header')).toHaveClass(/citizen-header--hidden/);
      await expect(page.locator('.citizen-corners').getByRole('button',{name:'Activity'})).toBeVisible();
      await expect(page.locator('.citizen-corners').getByRole('button',{name:'Home'})).toBeVisible();
      await page.screenshot({path:'test-results/screenshots/taxpayer-compact-'+width+'.png',fullPage:false});
    } else {
      await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
    }
  }
});
