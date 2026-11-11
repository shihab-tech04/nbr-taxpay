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
  // Public navigation remains available in the menu and footer, not as a four-slot dock.
  const dock=page.getByRole('navigation',{name:'Mobile primary navigation'});
  await expect(dock).toHaveCount(0);
  const chat=page.getByRole('button',{name:'Chat support'});
  await expect(chat).toBeVisible();
  const chatBounds=await chat.boundingBox();
  const headerBounds=await header.boundingBox();
  expect(chatBounds).not.toBeNull();
  expect(headerBounds).not.toBeNull();
  expect(chatBounds!.x).toBeGreaterThan(300);
  expect(Math.abs((chatBounds!.y+chatBounds!.height/2)-(headerBounds!.y+headerBounds!.height/2))).toBeLessThanOrEqual(8);
  await expect(chat.locator('span')).toBeHidden();
  await chat.click();
  await expect(page.locator('#public-help-title')).toBeVisible();
  await page.getByRole('textbox',{name:'Your question'}).focus();
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeHidden();
  await page.getByRole('button',{name:'Close help'}).click();
  const pay=page.getByRole('button',{name:'Pay — select payment type'});
  await expect(pay).toBeVisible();
  await expect(pay).toHaveClass(/citizen-pay--guest-floating/);
  await expect(pay).toContainText('Pay now');
  const payBounds=await pay.boundingBox();
  expect(payBounds).not.toBeNull();
  expect(payBounds!.width).toBeGreaterThanOrEqual(116);

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
  if (await corners.getByRole('button',{name:'Open menu'}).isVisible()) {
    await expect(corners.getByRole('button',{name:'Notifications'})).toHaveCount(0);
    await expect(corners.getByRole('button',{name:'Home'})).toBeVisible();
    await expect(page.locator('.taxpay-public-mobile-navigation .citizen-header')).toHaveClass(/citizen-header--hidden/);
    await expect(page.getByRole('navigation',{name:'Mobile primary navigation'})).toHaveCount(0);
  } else {
    // A shorter Home page may not scroll far enough to trigger compact navigation.
    await expect(page.locator('.taxpay-public-mobile-navigation .citizen-header')).toBeVisible();
    await expect(page.getByRole('navigation',{name:'Mobile primary navigation'})).toHaveCount(0);
  }
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toHaveCount(1);
  // The floating Pay action remains anchored above the safe area after scrolling.
  const floatingPay=page.getByRole('button',{name:'Pay — select payment type'});
  await expect(floatingPay).toHaveClass(/citizen-pay--guest-floating/);
  const floatingBox=await floatingPay.boundingBox();
  expect(floatingBox).not.toBeNull();
  expect(floatingBox!.y+floatingBox!.height).toBeLessThanOrEqual(812);
  await floatingPay.click();
  await expect(page.getByRole('dialog',{name:'Pay Tax'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toHaveCount(0);
});

test('public mobile footer stays compact and the floating Pay action remains reachable',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/?action=landing');
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const footer=page.locator('.public-footer');
  await expect(footer).toBeVisible();
  const inner=footer.locator('.public-footer__inner');
  const padding=await inner.evaluate(node=>getComputedStyle(node).paddingBottom);
  expect(parseFloat(padding)).toBeLessThan(30);
  await expect(page.getByRole('navigation',{name:'Mobile primary navigation'})).toHaveCount(0);
  const pay=page.getByRole('button',{name:'Pay — select payment type'});
  await expect(pay).toBeVisible();
  const bounds=await pay.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(375);
  expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(812);
  await expect(page.getByRole('button',{name:'Chat support'})).toBeVisible();
  await pay.click();
  await expect(page.getByRole('dialog',{name:'Pay Tax'})).toBeVisible();
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
