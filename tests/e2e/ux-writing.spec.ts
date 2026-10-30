import { enterLocalTaxpayerSample } from './local-taxpayer-sample';
import { expect, test } from '@playwright/test';

test('taxpayer dashboard uses compact labels, no backend essays and no invented tax balance',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Run full copy journey on one mobile viewport');
  await page.goto('/?action=taxpayer_home');
  await enterLocalTaxpayerSample(page);
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
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
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByText('Live assessments, Treasury settlements, eTDS records')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'TDS & advance tax'})).toBeVisible();
  const compactMenu=page.locator('.citizen-corners').getByRole('button',{name:'Open menu'});
  if(await compactMenu.isVisible()) await compactMenu.click();
  else await page.locator('.citizen-header').getByRole('button',{name:'Open menu'}).click();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
  await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'বন্ধ করুন'}).click();
  await expect(page.getByRole('heading',{name:'ড্যাশবোর্ড সারসংক্ষেপ'})).toBeVisible();
  await expect(page.getByText('প্রকৃত কর নির্ধারণ, ট্রেজারি জমা, ই-টিডিএস')).toHaveCount(0);
});

test('tax journey has no fabricated completed legal obligations, dates or Treasury credit',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','One navigation and content regression');
  await page.goto('/?action=taxpayer_home');
  await enterLocalTaxpayerSample(page);
  await page.getByRole('button',{name:'Full payment journey'}).click();
  await expect(page.getByRole('heading',{name:'My tax journey'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Saved payment drafts'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Payment activity'})).toBeVisible();
  await expect(page.getByText(/Requirement fulfilled|Section 154 requirement fulfilled|Due: 15 Dec 2025|Deadline: 30 Nov 2025|SCROLLED|ACTION DUE/)).toHaveCount(0);
});

test('public information copy is concise and bilingual while preserving payment safety',async({page},info)=>{
 test.skip(info.project.name!=='mobile-320','One bilingual content runner');
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Pay tax with confidence'})).toBeVisible();
 await expect(page.locator('footer').getByText('No government payments or challans are issued here.')).toHaveCount(0);
 await expect(page.getByText('Prototype status')).toHaveCount(0);
 await page.getByRole('button',{name:'বাংলা'}).click();
 await expect(page.getByRole('heading',{name:'কর পরিশোধ সহজ করুন'})).toBeVisible();
 await page.goto('/?action=travel');
 await expect(page.getByRole('heading',{name:'Travel tax'})).toBeVisible();
 await expect(page.getByText(/Rates and exemptions are not verified/)).toHaveCount(0);
});

