import type {Page} from '@playwright/test';

/** Opens Travel Tax through the taxpayer's existing Pay Tax menu on desktop/mobile. */
export async function openTaxpayerTravelTax(page:Page):Promise<void>{
  const rail=page.locator('.taxpayer-reference-rail');
  if(await rail.isVisible()){
    await rail.getByRole('button',{name:'Pay Tax menu'}).click();
    await rail.getByRole('button',{name:'Travel Tax',exact:true}).click();
  }else{
    await page.locator('.citizen-mobile-menu-trigger').click();
    await page.locator('#citizen-menu-dialog').getByRole('button',{name:'Travel Tax',exact:true}).click();
  }
}
