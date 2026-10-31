import {expect,test} from '@playwright/test';
import type { Page } from '@playwright/test';

// Preserve bilingual assertions while using the navigation control visible at each width.
async function switchTaxpayerToBangla(page: Page) {
  const mobileMenu = page.locator('.citizen-mobile-menu-trigger');
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
    await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
    await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
  } else {
    await page.locator('.citizen-header').getByRole('button',{name:'বাংলা'}).click();
  }
}

test('root is a public information hub with a header Login and no payment action',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#public-home-title')).toBeVisible();
 await expect(page.locator('.public-home-header__tools .public-home-login-link--desktop')).toHaveAttribute('href','?action=taxpayer_login');
 await expect(page.locator('.citizen-public-hero__actions').getByRole('link',{name:'Login'})).toHaveCount(0);
 if(page.viewportSize()!.width<=900) await expect(page.locator('.citizen-pay')).toBeVisible();
 else await expect(page.locator('.citizen-pay')).toBeHidden();
 await expect(page.locator('.office-auth')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'How your payment works'})).toBeVisible();
});

test('sample taxpayer home never invents personal ledger credit',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByText('Recognized TDS / AIT')).toBeVisible();
  await expect(page.getByText(/verified liability and tax credit not connected/i)).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Payment composition'})).toBeVisible();
  await expect(page.getByText('Total Payments (FY 2024-26):')).toHaveCount(0);
  await expect(page.getByText('Q1 Deposited')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
});
test('taxpayer mobile home and activity support Bangla without overflows',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await switchTaxpayerToBangla(page);
  await expect(page.getByRole('heading',{name:'ড্যাশবোর্ড সারসংক্ষেপ'})).toBeVisible();
  await expect(page.getByText(/স্বীকৃত টিডিএস \/ এআইটি/)).toBeVisible();
  await expect(page.getByText(/যাচাইকৃত করদায় ও ক্রেডিট সংযুক্ত নয়/)).toHaveCount(0);
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(322);
  await page.getByRole('button',{name:'লেনদেনের ইতিহাস খুলুন'}).click();
  await expect(page.getByRole('heading',{name:'পেমেন্ট ও লেনদেন'})).toBeVisible();
  await expect(page.getByLabel('পেমেন্ট খুঁজুন')).toBeVisible();
  await expect(page.getByLabel('করবর্ষ')).toBeVisible();
  await expect(page.getByLabel('পেমেন্টের ধরন')).toBeVisible();
});
test('sample payment activity retains filtering and does not assert tax-credit owner',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Open transaction history'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByText('Activity overview',{exact:true})).toBeVisible();
  await expect(page.getByText('Personal tax credit recognized')).toHaveCount(0);
  await page.getByLabel('Search payments').fill('THIS-REFERENCE-DOES-NOT-EXIST');
  await expect(page.getByText('No matching records')).toBeVisible();
  await expect(page.getByRole('button',{name:'Export records'})).toBeDisabled();
});


test('public mobile navigation reuses the taxpayer dock with public-only routes and Pay',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?action=landing');
 await expect(page.locator('.public-home-header')).toBeHidden();
 await expect(page.locator('.citizen-header')).toBeVisible();
 const dock=page.getByRole('navigation',{name:'Mobile primary navigation'});
 await expect(dock).toBeVisible();
 await expect(dock.getByRole('button',{name:'Payment Status'})).toBeVisible();
 await expect(dock.getByRole('button',{name:'Help'})).toBeVisible();
 await expect(dock.getByRole('button',{name:'Beneficiaries'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
 await page.getByRole('button',{name:'Open menu'}).click();
 await expect(page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Help'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog',{name:'Services & menu'})).toHaveCount(0);
});

test('obligations dashboard cannot assert fictional credits, demand or paid instalments',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Travel tax',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'TDS & advance tax'})).toBeVisible();
  await expect(page.getByText('Available for e-Return AY 2025-2026')).toHaveCount(0);
  await expect(page.getByText('৳ 47,400')).toHaveCount(0);
  await expect(page.getByText('PAID & SCROLLED')).toHaveCount(0);
  await switchTaxpayerToBangla(page);
  await expect(page.getByRole('heading',{name:'ড্যাশবোর্ড সারসংক্ষেপ'})).toBeVisible();
});

test('certificate previews stay non-official, match the selected type and localize in Bengali',async({page},testInfo)=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Open transaction history'}).click();
  await page.getByRole('navigation',{name:'Activity sections'}).getByRole('button',{name:'Receipts & certificates'}).click();

  await expect(page.getByRole('heading',{name:'Certificate summaries'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Annual payment summary'})).toBeVisible();
  await expect(page.getByText('No official certificate is issued from this demonstration.')).toHaveCount(0);
  await expect(page.getByText('Statutory certificates generated directly from Government Treasury deposit scrolls.')).toHaveCount(0);
  await expect(page.getByText('In Good Standing')).toHaveCount(0);
  await expect(page.getByText('Deputy Commissioner of Taxes')).toHaveCount(0);

  await page.getByRole('button',{name:'Withholding deposit summary',exact:true}).click();
  const documentModal = page.getByRole('dialog',{name:'Certificate summary'});
  await expect(documentModal.locator('[data-testid="certificate-summary-document"]')).toBeVisible();
  await expect(documentModal.getByRole('heading',{name:'Withholding deposit summary'})).toBeVisible();
  await expect(documentModal.getByText('Deductee ownership')).toBeVisible();
  await expect(documentModal.getByText('Not verified',{exact:true}).first()).toBeVisible();
  await expect(documentModal.locator('.taxpay-modal__footer .receipt-view__actions')).toBeVisible();
  await expect(documentModal.getByRole('button',{name:'Back to search'})).toHaveCount(0);
  await expect(documentModal.getByRole('button',{name:'Download'})).toBeVisible();
  await expect(documentModal.getByRole('button',{name:'Print summary'})).toBeVisible();
  const summaryDownload = page.waitForEvent('download');
  await documentModal.getByRole('button',{name:'Download'}).click();
  expect((await summaryDownload).suggestedFilename()).toBe('Korbritto-WITHHOLDING_PROOF-summary.html');
  await documentModal.getByRole('button',{name:'Close modal'}).click();
  await expect(documentModal).toHaveCount(0);

  await switchTaxpayerToBangla(page);
  await expect(page.getByRole('heading',{name:'সনদের সারসংক্ষেপ'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'উৎসে কর জমার সারসংক্ষেপ'})).toBeVisible();
  await page.getByRole('button',{name:'উৎসে কর জমার সারসংক্ষেপ',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'সনদের সারসংক্ষেপ'}).locator('[data-testid="certificate-summary-document"]')).toBeVisible();
  await expect(page.getByText('এই প্রদর্শনী থেকে কোনো সরকারি সনদ ইস্যু করা হয় না।')).toHaveCount(0);

  if (testInfo.project.name === 'mobile-320' || testInfo.project.name === 'desktop-1280') {
    await page.screenshot({path:`test-results/screenshots/certificate-preview-bn-${testInfo.project.name}.png`,fullPage:false});
  }
});


test('home explains the payment stages without an inline transaction form',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'How your payment works'})).toBeVisible();
 await expect(page.locator('.public-payment-path__steps > li')).toHaveCount(4);
 await expect(page.locator('.public-info-topic')).toHaveCount(0);
 if(page.viewportSize()!.width<=900) await expect(page.locator('.citizen-pay')).toBeVisible();
 else await expect(page.locator('.citizen-pay')).toBeHidden();
 await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toHaveCount(0);
 await page.goto('/?action=guest');
 await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toBeVisible();
});

