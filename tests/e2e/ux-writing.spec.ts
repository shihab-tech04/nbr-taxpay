import { mockPublishedBannerCms } from './mock-published-banners';
import { expect, test } from '@playwright/test';

test('taxpayer dashboard uses compact labels, no backend essays and no invented tax balance',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Run full copy journey on one mobile viewport');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByText('Demo',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Payment composition'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Payment records summary'})).toContainText('Recorded income tax');
  await expect(page.getByText(/verified liability and tax credit not connected|visual preview/i)).toHaveCount(0);
  await expect(page.getByText('Demo scenario', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Exit demonstration account', { exact: false })).toHaveCount(0);
  await expect(page.getByText('DEMO-TIN-001', { exact: false })).toHaveCount(0);
  await expect(page.getByText('This demonstration has no verified account-specific ledger owner')).toHaveCount(0);
  await expect(page.getByText('Sample profile · not a verified taxpayer')).toHaveCount(0);
  await expect(page.getByText('Preview only · No payments or government receipts issued.')).toHaveCount(0);
  await expect(page.getByText('Taxpayer workspace · sample profile')).toHaveCount(0);
  await expect(page.getByText('Why are balances unavailable?')).toHaveCount(0);
  await page.getByRole('button',{name:'Travel tax',exact:true}).click();
  await expect(page.getByRole('button',{name:'Travel tax',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByText('Live assessments, Treasury settlements, eTDS records')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'TDS & advance tax'})).toBeVisible();
  const compactMenu=page.locator('.citizen-corners').getByRole('button',{name:'Open menu'});
  if(await compactMenu.isVisible()) await compactMenu.click();
  else await page.locator('.citizen-header').getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
  await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
  await expect(page.getByRole('heading',{name:'সংক্ষিপ্ত বিবরণ'})).toBeVisible();
  await expect(page.getByText('প্রকৃত কর নির্ধারণ, ট্রেজারি জমা, ই-টিডিএস')).toHaveCount(0);
});

test('tax journey has no fabricated completed legal obligations, dates or Treasury credit',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One navigation and content regression');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Full payment journey'}).click();
  await expect(page.getByRole('heading',{name:'My tax journey'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Related services',exact:true})).toHaveCount(0);
  await expect(page.getByText(/Requirement fulfilled|Section 154 requirement fulfilled|Due: 15 Dec 2025|Deadline: 30 Nov 2025|SCROLLED|ACTION DUE/)).toHaveCount(0);

  const viewports=[320,375,390,768,1280,1920];
  const copy={en:{nav:'Activity sections',journey:'My tax journey',transactions:'Transactions',
    journeyTab:'Tax journey',corrections:'Issues & corrections',receipts:'Receipts & certificates'},
    bn:{nav:'লেনদেনের বিভাগ',journey:'আমার কর কার্যক্রম',transactions:'লেনদেনসমূহ',
      journeyTab:'কর যাত্রা',corrections:'সমস্যা ও সংশোধন',receipts:'রসিদ ও সনদপত্র'}};
  for(const language of ['en','bn'] as const){
    for(const width of viewports){
      await page.setViewportSize({width,height:900});
      await page.goto('/?action=journey&demoUser=user1&lang='+language);
      await expect(page.getByRole('heading',{name:copy[language].journey})).toBeVisible();
      const tabs=page.getByRole('navigation',{name:copy[language].nav});
      await expect(tabs).toBeVisible();
      for(const label of [copy[language].transactions,copy[language].journeyTab,
        copy[language].corrections,copy[language].receipts]){
        await expect(tabs.getByRole('button',{name:label,exact:true})).toBeVisible();
      }
      await expect(tabs.getByRole('button',{name:copy[language].journeyTab,exact:true}))
        .toHaveAttribute('aria-current','page');
      await expect(page.getByRole('heading',{name:language==='en'?'Related services':'সংশ্লিষ্ট সেবা',exact:true})).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
      if(width===320){
        await tabs.getByRole('button',{name:copy[language].transactions,exact:true}).click();
        await expect(page.getByRole('navigation',{name:copy[language].nav})
          .getByRole('button',{name:copy[language].transactions,exact:true})).toHaveAttribute('aria-current','page');
        await page.getByRole('navigation',{name:copy[language].nav})
          .getByRole('button',{name:copy[language].journeyTab,exact:true}).click();
        await expect(page.getByRole('heading',{name:copy[language].journey})).toBeVisible();
      }
    }
  }
});

test('public information copy is concise and bilingual while preserving payment safety',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','One bilingual content runner');
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Pay tax with confidence'})).toBeVisible();
 await expect(page.locator('footer').getByText('No government payments or challans are issued here.')).toHaveCount(0);
 await expect(page.getByText('Prototype status')).toHaveCount(0);
 await page.getByRole('button', { name: 'Open menu' }).click();
 await page.getByRole('dialog', { name: 'Services & menu' }).getByRole('button', { name: 'বাংলা', exact: true }).click();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('heading',{name:'কর পরিশোধ সহজ করুন'})).toBeVisible();
 await page.goto('/?action=travel');
 await expect(page.getByRole('heading',{name:'Travel tax'})).toBeVisible();
 await expect(page.getByText(/Rates and exemptions are not verified/)).toHaveCount(0);
});


// Banner-dependent browser checks use explicitly published CMS rows;
// unavailable CMS must not revive unpublished bundled artwork.
test.beforeEach(async ({ page }) => { await mockPublishedBannerCms(page); });
