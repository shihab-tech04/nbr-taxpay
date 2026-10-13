import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('public home does not open guest payment wizard via a primary action',async({page})=>{
 await page.goto('/?action=landing');
 await expect(page.getByRole('button',{name:'Check payment status & receipt'})).toBeVisible();
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
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await expect(page.getByText('Taxpayer workspace')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tax position'})).toBeVisible();
});

test('public menu contains informational navigation with no sample profile selector',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/?action=landing');
 await page.getByRole('button',{name:'Menu'}).click();
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav.getByRole('link',{name:'FAQs'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Demo role'})).toHaveCount(0);
 await page.keyboard.press('Escape');
 await expect(nav).toBeHidden();
 await page.getByRole('button',{name:'বাংলা'}).click();
 await expect(page.getByRole('button',{name:'মেনু'})).toBeVisible();
});

test('public information header and sections fit all requested widths',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','One runner covers the seven-width matrix');
 for(const width of [320,360,375,390,768,1024,1440]){
  await page.setViewportSize({width,height:812});
  await page.goto('/?action=landing');
  await expect(page.locator('.public-home-header')).toBeVisible();
  await expect(page.locator('.public-home-header').getByRole('img',{name:'Government Seal of Bangladesh'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  await expect(page.locator('.citizen-public-hero__actions').getByRole('link',{name:'Login'})).toHaveCount(0);
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

test('payment flow suppresses global pay and preserves bilingual step guidance',async({page})=>{
  await page.goto('/?action=travel');
  await expect(page.locator('.citizen-pay')).toHaveCount(0);
  await expect(page.getByText('Payment steps', { exact: false })).toBeVisible();
  await page.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByText('পেমেন্টের ধাপ', { exact: false })).toBeVisible();
});

test('citizen navigation has no automated serious accessibility violations',async({page},info)=>{
  test.skip(info.project.name==='desktop-1280','Mobile navigation audit evaluated in 320/375 variants');
  await page.goto('/?action=landing');
  const results=await new AxeBuilder({page}).include('.public-home-header').include('.public-information-hub').include('.public-footer').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});


test('public guidance links stay on-page without authorizing account access',async({page})=>{
 await page.goto('/?action=landing');
 if (page.viewportSize()!.width<=900) await page.getByRole('button',{name:'Menu'}).click();
 await page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'FAQs'}).click();
 await expect(page.getByRole('heading',{name:'TaxPay user guide'})).toBeVisible();
 await expect(page.locator('.citizen-public-hero__actions').getByRole('link',{name:'Login'})).toHaveCount(0);
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
    await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
    await expect(page.getByText('Taxpayer workspace')).toBeVisible();
    await page.screenshot({path:'test-results/screenshots/taxpayer-expanded-'+width+'.png',fullPage:false});
    const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width+2);
    await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
    if(width<=900) {
      await page.evaluate(()=>window.scrollTo(0,450));
      await expect(page.locator('.citizen-header')).toHaveClass(/citizen-header--hidden/);
      await expect(page.locator('.citizen-header')).toHaveCSS('visibility','hidden');
      await expect(page.locator('.citizen-corners').getByRole('button',{name:'Notifications'})).toBeVisible();
      await expect(page.locator('.citizen-corners').getByRole('button',{name:'Home'})).toBeVisible();
      await page.screenshot({path:'test-results/screenshots/taxpayer-compact-'+width+'.png',fullPage:false});
    } else {
      await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
    }
  }
});


test('public header centers icons at 1296px and routes to User Guide',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Desktop at 1600px');
 await page.setViewportSize({width:1600,height:900});
 await page.goto('/?action=landing');
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 const home=nav.getByRole('link',{name:'Home'});
 const faq=nav.getByRole('link',{name:'FAQs'});
 const report=nav.getByRole('link',{name:'Report'});
 const login=page.locator('.public-home-header__tools').getByRole('link',{name:'Login'});
 await expect(login).toBeVisible();
 await expect(login).toHaveAttribute('href','https://shihab-tech04.github.io/NBR-Officemanagment-UI-V2/payments/transactions');
 await expect(home).toHaveAttribute('aria-current','page');
 await expect(report).toBeVisible();
 for(const link of [home,faq,report]) await expect(link.locator('svg')).toHaveCount(1);
 const headerBox=await page.locator('.public-home-header__inner').boundingBox();
 const navBox=await nav.boundingBox();
 expect(headerBox).not.toBeNull();
 expect(navBox).not.toBeNull();
 expect(Math.abs(navBox!.x+navBox!.width/2-(headerBox!.x+headerBox!.width/2))).toBeLessThanOrEqual(5);
 await expect(page.locator('.citizen-public-hero__actions').getByRole('link',{name:'Login'})).toHaveCount(0);
 const bounds=await page.locator('.public-information-hub').boundingBox();
 expect(bounds).not.toBeNull();
 expect(bounds!.width).toBeGreaterThanOrEqual(1285);
 expect(bounds!.width).toBeLessThanOrEqual(1298);
 await faq.click();
 await expect(page.getByRole('heading',{name:'TaxPay user guide'})).toBeVisible();
 await expect(faq).toHaveAttribute('aria-current','page');
 await expect(home).not.toHaveAttribute('aria-current','page');
 await report.click();
 await expect(page.getByRole('heading',{name:'Report a problem'})).toBeVisible();
 await expect(report).toHaveAttribute('aria-current','page');
});

test('mobile navigation opens FAQs and Report in English and Bengali',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Mobile controls at 375px');
 await page.goto('/?action=landing');
 const nav=page.getByRole('navigation',{name:'Primary navigation'});
 await expect(nav).toBeHidden();
 await page.getByRole('button',{name:'Menu'}).click();
 await expect(nav.getByRole('link',{name:'Login'})).toBeVisible();
 await nav.getByRole('link',{name:'FAQs'}).click();
 await expect(page.getByRole('heading',{name:'TaxPay user guide'})).toBeVisible();
 await page.getByRole('button',{name:'Menu'}).click();
 await expect(nav.getByRole('link',{name:'FAQs'})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'বাংলা'}).click();
 const bnNav=page.getByRole('navigation',{name:'প্রধান নেভিগেশন'});
 await expect(bnNav.getByRole('link',{name:'লগইন'})).toBeVisible();
 await expect(bnNav.getByRole('link',{name:'প্রশ্নোত্তর'})).toHaveAttribute('aria-current','page');
 await bnNav.getByRole('link',{name:'অভিযোগ'}).click();
 await expect(page.getByRole('heading',{name:'সমস্যা জানান'})).toBeVisible();
});


test('taxpayer mobile header, compact corners and two-tier full-width menu are accessible',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','One mobile workflow verifies requested navigation behavior');
 await page.setViewportSize({width:375,height:812});
 await page.goto('/?action=taxpayer_home');
 await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
 const header=page.locator('.citizen-header');
 await expect(header.getByRole('button',{name:'Open menu'})).toBeVisible();
 await expect(header.getByRole('button',{name:'Notifications'})).toBeVisible();
 const bounds=await page.evaluate(()=>{
   const bar=document.querySelector('.citizen-header')!.getBoundingClientRect();
   const menu=document.querySelector('.citizen-mobile-menu-trigger')!.getBoundingClientRect();
   const brand=document.querySelector('.citizen-brand')!.getBoundingClientRect();
   const notice=document.querySelector('.citizen-header__notification')!.getBoundingClientRect();
   return {menuX:menu.x,brandCenter:brand.x+brand.width/2,barCenter:bar.x+bar.width/2,noticeX:notice.x};
 });
 expect(bounds.menuX).toBeLessThan(bounds.brandCenter);
 expect(Math.abs(bounds.brandCenter-bounds.barCenter)).toBeLessThanOrEqual(3);
 expect(bounds.noticeX).toBeGreaterThan(bounds.brandCenter);
 await header.getByRole('button',{name:'Open menu'}).click();
 const dialog=page.getByRole('dialog',{name:'Services & menu'});
 await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('navigation',{name:'Services navigation'})).toBeVisible();
 await expect(dialog.getByRole('region',{name:'Language and account'})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Sign in'})).toBeVisible();
 const edge=await dialog.boundingBox();
 expect(edge).not.toBeNull();
 expect(Math.abs(edge!.x)).toBeLessThanOrEqual(1);
 expect(Math.abs(edge!.width-375)).toBeLessThanOrEqual(2);
 await expect(dialog.getByText(/Demo scenario|Exit demonstration account|Account: user1/)).toHaveCount(0);
 await dialog.getByRole('button',{name:'বাংলা'}).click();
 await expect(page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('navigation',{name:'সেবার নেভিগেশন'})).toBeVisible();
 await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'English'}).click();
 await dialog.getByRole('button',{name:'Close'}).click();
 await page.evaluate(()=>window.scrollTo(0,500));
 await expect(header).toHaveClass(/citizen-header--hidden/);
 const corners=page.locator('.citizen-corners');
 for(const name of ['Open menu','Notifications','Home'])await expect(corners.getByRole('button',{name})).toBeVisible();
 await expect(page.locator('.citizen-pay--compact')).toBeVisible();
});
