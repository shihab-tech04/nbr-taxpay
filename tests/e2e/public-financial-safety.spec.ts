import {setWorkspaceLanguage} from './workspace-language';
import { expect, test } from '@playwright/test';

test('public page does not claim real payment processing or grant account roles',async({page})=>{
 await page.goto('/?action=landing');
 await expect(page.locator('#public-home-title')).toBeVisible();
 await expect(page.getByText('No government payments or challans are issued here.')).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Demo role'})).toHaveCount(0);
 if(page.viewportSize()!.width<=900) await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
 else await expect(page.locator('.citizen-pay')).toBeHidden();
 await expect(page.locator('.public-home-header__tools .public-home-login-link--desktop')).toHaveAttribute('href','?action=taxpayer_login');
 await expect(page.getByRole('heading',{name:'Common questions'})).toBeVisible();
 await setWorkspaceLanguage(page,'bn');
 await expect(page.locator('#public-home-title')).toBeVisible();
 await expect(page.getByRole('heading',{name:'সাধারণ প্রশ্ন'})).toBeVisible();
 await expect(page.getByText('এখানে সরকারি পেমেন্ট বা চালান ইস্যু হয় না।')).toHaveCount(0);
});

test('legacy help URL resolves to maintained guide without an unverified tax calculator', async ({page}) => {
  await page.goto('/?action=guidance');
  await expect(page.getByRole('heading',{name:'Korbritto user guide'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Proceed to Pay Estimated Tax'})).toHaveCount(0);
  await setWorkspaceLanguage(page,'bn');
  await expect(page.getByRole('heading',{name:'করবৃত্ত ব্যবহার নির্দেশিকা'})).toBeVisible();
});

test('travel tax simulation cannot be presented as a real immigration challan',async ({page})=>{
  await page.goto('/?action=travel');
  await expect(page.getByText('Enter your travel details.')).toBeVisible();
  await expect(page.getByText(/Rates and exemptions are not verified/)).toHaveCount(0);
});

test('public mobile shared navigation keeps public information, EN/BN, and accessible controls',async({page},info)=>{
 test.skip(info.project.name==='desktop-1280','Mobile navigation only');
 await page.goto('/?action=landing');
 const header=page.locator('.taxpay-public-mobile-navigation .citizen-header');
 const home=header.getByRole('button',{name:'Korbritto home'});
 await expect(home).toBeVisible();
 await home.focus();await expect(home).toBeFocused();
 const menu=header.getByRole('button',{name:'Open menu'});
 await expect(menu).toBeVisible();
 const bounds=await menu.boundingBox();
 expect(bounds).not.toBeNull();
 expect(bounds!.width).toBeGreaterThanOrEqual(43.5);
 expect(bounds!.height).toBeGreaterThanOrEqual(43.5);
 await menu.click();
 const sheet=page.getByRole('dialog',{name:'Services & menu'});
 await expect(sheet.getByRole('button',{name:'Help'})).toBeVisible();
 await expect(sheet.getByRole('button',{name:'Sign in'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(sheet).toHaveCount(0);
 await expect(menu).toBeFocused();
 await menu.click();
 await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
 await expect(page.getByRole('dialog',{name:'সেবা ও মেনু'})).toBeVisible();
});