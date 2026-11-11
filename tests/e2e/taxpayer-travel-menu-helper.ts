import type {Page} from '@playwright/test';

/** Opens Travel Tax through the taxpayer's existing Pay Tax menu on desktop/mobile. */
export async function openTaxpayerTravelTax(page:Page):Promise<void>{
  const rail=page.locator('.taxpayer-reference-rail');
  if(await rail.isVisible()){
    await rail.getByRole('button',{name:'Pay Tax menu'}).click();
    await rail.getByRole('button',{name:'Travel Tax',exact:true}).click();
  }else{
    // After a year-chart interaction the mobile header can compact on scroll.
    // Open whichever real menu trigger is visible, rather than clicking a hidden header.
    const compactMenu=page.locator('.citizen-corner--top-left');
    if(await compactMenu.isVisible()) await compactMenu.click();
    else {
      await page.evaluate(() => window.scrollTo(0,0));
      await page.locator('.citizen-mobile-menu-trigger').click();
    }
    await page.locator('#citizen-menu-dialog').getByRole('button',{name:'Travel Tax',exact:true}).click();
  }
}

/** Uses the existing two-choice payment workflow from the taxpayer rail or floating Pay action. */
export async function openTaxpayerPayTax(page:Page):Promise<void>{
  const rail=page.locator('.taxpayer-reference-rail');
  if(await rail.isVisible()){
    await rail.getByRole('button',{name:'Pay Tax menu'}).click();
    await rail.getByRole('button',{name:'Pay Tax',exact:true}).click();
  }else{
    await page.getByRole('button',{name:'Pay — select payment type'}).click();
  }
}
