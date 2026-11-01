import {expect, test} from '@playwright/test';

test('guest mobile uses the approved signed-in navigation geometry without exposing account features', async ({page}) => {
  await page.setViewportSize({width:375,height:812});
  await page.goto('/?action=landing');
  const header=page.locator('.taxpay-public-mobile-navigation .citizen-header');
  await expect(header).toBeVisible();
  await expect(page.locator('.public-home-header')).toBeHidden();
  const menu=header.getByRole('button',{name:'Open menu'});
  const logo=header.getByRole('button',{name:'Korbritto home'});
  const bell=header.getByRole('button',{name:'Notifications'});
  await expect(menu).toBeVisible();
  await expect(logo).toBeVisible();
  await expect(bell).toHaveCount(0);
  const bounds=await page.evaluate(()=>{
    const h=document.querySelector('.taxpay-public-mobile-navigation .citizen-header')!.getBoundingClientRect();
    const m=document.querySelector('.taxpay-public-mobile-navigation .citizen-mobile-menu-trigger')!.getBoundingClientRect();
    const l=document.querySelector('.taxpay-public-mobile-navigation .citizen-brand')!.getBoundingClientRect();
    return {width:document.documentElement.scrollWidth, viewport:document.documentElement.clientWidth,
      menu:m.x, logo:l.x+l.width/2, center:h.x+h.width/2};
  });
  expect(bounds.menu).toBeLessThan(bounds.logo);
  expect(Math.abs(bounds.logo-bounds.center)).toBeLessThanOrEqual(3);
  expect(bounds.width-bounds.viewport).toBeLessThanOrEqual(2);
  const dock=page.getByRole('navigation',{name:'Mobile primary navigation'});
  await expect(dock).toBeVisible();
  await expect(dock.getByRole('button',{name:'Home'})).toBeVisible();
  await expect(dock.getByRole('button',{name:'Payment Status'})).toBeVisible();
  await expect(dock.getByRole('button',{name:'Help'})).toBeVisible();
  await expect(dock.getByRole('button',{name:/Beneficiaries/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
  await expect(dock).toHaveCSS('border-top-width','1px');
  await expect(dock).toHaveCSS('border-radius','0px');

  await menu.click();
  const sheet=page.getByRole('dialog',{name:'Services & menu'});
  await expect(sheet.getByRole('navigation',{name:'Services navigation'})).toBeVisible();
  await expect(sheet.getByRole('button',{name:'Sign in'})).toBeVisible();
  await expect(sheet.getByRole('button',{name:'বাংলা'})).toBeVisible();
  await expect(sheet.getByRole('button',{name:'Beneficiaries'})).toHaveCount(0);
  await sheet.getByRole('button',{name:'বাংলা'}).click();
  await expect(page.getByRole('dialog',{name:'সেবা ও মেনু'})).toBeVisible();
  await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'English'}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'সেবা ও মেনু'})).toHaveCount(0);
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
});

test('mobile guest shell shares signed-in compact-on-scroll behavior, without duplicate Pay controls',async ({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/?action=landing');
  await page.evaluate(()=>window.scrollTo(0,600));
  const corners=page.locator('.taxpay-public-mobile-navigation .citizen-corners');
  await expect(corners.getByRole('button',{name:'Open menu'})).toBeVisible();
  await expect(corners.getByRole('button',{name:'Notifications'})).toHaveCount(0);
  await expect(corners.getByRole('button',{name:'Home'})).toBeVisible();
  await expect(page.locator('.taxpay-public-mobile-navigation .citizen-header')).toHaveClass(/citizen-header--hidden/);
  await expect(page.getByRole('navigation',{name:'Mobile primary navigation'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toHaveCount(1);
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  await expect(page.getByRole('dialog',{name:'Pay Tax'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toHaveCount(0);
});

test('public desktop header is unchanged, with no mobile navigation duplication',async ({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/?action=landing');
  await expect(page.locator('.public-home-header')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Primary navigation'}).getByRole('link',{name:'User guide'})).toBeVisible();
  await expect(page.locator('.taxpay-public-mobile-navigation .citizen-header')).toBeHidden();
  await expect(page.getByRole('navigation',{name:'Mobile primary navigation'})).toBeHidden();
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeHidden();
});

test('signed-in mobile continues to use its existing private shell after login', async ({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/?action=taxpayer_login');
  const login=page.getByRole('dialog',{name:'Sign In To Your Korbritto Account'});
  await login.getByRole('textbox',{name:'User ID'}).fill('user1');
  await login.getByLabel('Password',{exact:true}).fill('user1');
  await login.getByRole('button',{name:'Sign In'}).click();
  await expect(page).toHaveURL(/action=taxpayer_home/);
  await expect(page.locator('.citizen-header')).toBeVisible();
  await expect(page.locator('.taxpay-public-mobile-navigation')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
});
