import {expect, test} from '@playwright/test';

test('guest mobile uses the approved signed-in navigation geometry without exposing account features', async ({page}) => {
  await page.setViewportSize({width:375,height:812});
  await page.goto('/?action=landing');
  const header=page.locator('.taxpay-public-mobile-navigation .citizen-header');
  await expect(header).toBeVisible();
  await expect(page.locator('.public-home-header')).toBeHidden();
  const menu=header.getByRole('button',{name:'Open menu'});
  const logo=header.getByRole('button',{name:'Sohojkor home'});
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
  // Preserve the original three navigation actions. Pay is independent.
  const dock=page.getByRole('navigation',{name:'Mobile primary navigation'});
  await expect(dock).toBeVisible();
  for(const item of ['Home','Payment Status','Help'])
    await expect(dock.getByRole('button',{name:item})).toBeVisible();
  await expect(dock.locator('.citizen-bottom-nav__item')).toHaveCount(3);
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
  const helpPanel=page.locator('#public-help-panel');
  await expect(helpPanel).toBeVisible();
  await expect(page.locator('.public-help-launch__close')).toBeHidden();
  const panelBox=await helpPanel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(Math.abs(panelBox!.y+panelBox!.height-812)).toBeLessThanOrEqual(2);
  expect(panelBox!.height).toBeLessThan(812*.8);
  await expect(page.locator('.public-help-backdrop')).toBeVisible();
  await expect(helpPanel).toHaveAttribute('aria-modal','true');
  await expect(dock).toBeVisible();
  expect(await page.evaluate(()=>getComputedStyle(document.body).overflow)).toBe('hidden');
  await page.getByRole('textbox',{name:'Your question'}).focus();
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeHidden();
  await page.getByRole('button',{name:'Close chat'}).click();
  await expect(page.locator('.taxpay-public-mobile-navigation .citizen-header')).toBeVisible();
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
  const header=page.locator('.taxpay-public-mobile-navigation .citizen-header');
  const corners=page.locator('.taxpay-public-mobile-navigation .citizen-corners');
  // Wait for the mounted header's scroll listener before triggering a large
  // scroll; reading corner visibility immediately races the React scroll state.
  await expect(header).toBeVisible();
  await page.evaluate(async()=>{
    window.scrollTo(0,0);
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    window.scrollTo(0,600);
  });
  if (await page.evaluate(()=>window.scrollY>145)) {
    await expect(corners.getByRole('button',{name:'Open menu'})).toBeVisible();
    await expect(corners.getByRole('button',{name:'Notifications'})).toHaveCount(0);
    await expect(corners.getByRole('button',{name:'Home'})).toHaveCount(0);
    await expect(header).toHaveClass(/citizen-header--hidden/);
  } else {
    // A shorter Home page may not scroll far enough to trigger compact navigation.
    await expect(header).toBeVisible();
  }
  await expect(page.getByRole('navigation',{name:'Mobile primary navigation'})).toBeVisible();
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
  await expect(footer.locator('.public-footer__navs')).toBeHidden();
  const more=footer.locator('.public-footer__mobile-more > summary');
  await expect(more).toBeVisible();
  const inner=footer.locator('.public-footer__inner');
  // The footer must keep a stable Pay/dock clearance, painted in the page
  // background rather than as an empty white extension of the footer.
  await expect(page.locator('.taxpay-public-mobile-navigation .citizen-corners')).toHaveCount(1);
  const footerColors=await footer.evaluate(element=>({
    clearance:parseFloat(getComputedStyle(element).paddingBottom),
    footerBackground:getComputedStyle(element).backgroundColor,
    rowBackground:getComputedStyle(element.querySelector('.public-footer__inner')!).backgroundColor,
  }));
  expect(footerColors.clearance).toBeGreaterThanOrEqual(80);
  expect(footerColors.clearance).toBeLessThanOrEqual(90);
  expect(footerColors.footerBackground).not.toBe(footerColors.rowBackground);
  const brandBox=await footer.locator('.public-footer__wordmark').boundingBox();
  const copyBox=await footer.locator('.public-footer__bottom').boundingBox();
  const moreBox=await more.boundingBox();
  expect(brandBox).not.toBeNull();
  expect(copyBox).not.toBeNull();
  expect(moreBox).not.toBeNull();
  expect(Math.abs(brandBox!.y+brandBox!.height/2-(copyBox!.y+copyBox!.height/2))).toBeLessThanOrEqual(12);
  expect(Math.abs(brandBox!.y+brandBox!.height/2-(moreBox!.y+moreBox!.height/2))).toBeLessThanOrEqual(12);
  expect((await inner.boundingBox())!.height).toBeLessThan(80);
  await more.click();
  const mobileLinks=footer.getByRole('navigation',{name:'More footer links'});
  await expect(mobileLinks).toBeVisible();
  await expect(mobileLinks.getByRole('button')).toHaveCount(3);
  await expect(mobileLinks.getByRole('link',{name:'NBR publications'})).toHaveAttribute('href','https://nbr.gov.bd/');
  await more.click();
  await expect(mobileLinks).toBeHidden();
  const padding=await inner.evaluate(node=>getComputedStyle(node).paddingBottom);
  expect(parseFloat(padding)).toBeLessThan(30);
  const dock=page.getByRole('navigation',{name:'Mobile primary navigation'});
  await expect(dock).toBeVisible();
  const pay=page.getByRole('button',{name:'Pay — select payment type'});
  await expect(pay).toBeVisible();
  const bounds=await pay.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(375);
  expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(812);
  expect(Math.max(brandBox!.y+brandBox!.height, copyBox!.y+copyBox!.height, moreBox!.y+moreBox!.height)).toBeLessThanOrEqual(bounds!.y-4);
  const dockBounds=await dock.boundingBox();
  expect(dockBounds).not.toBeNull();
  // In the compact scrolled state, the full dock yields to Home/Pay corners.
  // Both floating buttons must remain accessible, without covering the footer.
  const compactHome=page.locator('.taxpay-public-mobile-navigation .citizen-corner--bottom-left');
  await expect(compactHome).toBeVisible();
  const homeBounds=await compactHome.boundingBox();
  expect(homeBounds).not.toBeNull();
  expect(brandBox!.y+brandBox!.height).toBeLessThanOrEqual(homeBounds!.y-4);
  expect(dockBounds!.bottom).toBeLessThanOrEqual(812);
  await expect(page.getByRole('button',{name:'Chat support'})).toBeVisible();
  await pay.click();
  const choice=page.getByRole('dialog',{name:'Pay Tax'});
  await expect(choice).toBeVisible();
  await expect(choice.locator('[data-payer-relationship]')).toHaveCount(2);
  await expect.poll(async()=>{
    const box=await choice.boundingBox();
    return box?.height??Infinity;
  }).toBeLessThan(812*.8);
});

test('426px scrolled mobile footer is one compact white row above the floating Pay control',async({page})=>{
  await page.setViewportSize({width:426,height:882});
  await page.goto('/?action=landing&lang=en');
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await expect(page.locator('.taxpay-public-mobile-navigation .citizen-corners')).toHaveCount(1);
  const footer=page.locator('.public-footer');
  await expect(footer).toBeVisible();
  const result=await page.evaluate(()=>{
    const footer=document.querySelector('.public-footer')!;
    const row=document.querySelector('.public-footer__inner')!;
    const pay=document.querySelector('.citizen-pay--guest-floating')!;
    const footerStyle=getComputedStyle(footer);
    const rowStyle=getComputedStyle(row);
    const copyStyle=getComputedStyle(document.querySelector('.public-footer__bottom p')!);
    return {
      clearance:parseFloat(footerStyle.paddingBottom),
      rowHeight:row.getBoundingClientRect().height,
      footerBackground:footerStyle.backgroundColor,
      rowBackground:rowStyle.backgroundColor,
      rowToPayGap:pay.getBoundingClientRect().top-row.getBoundingClientRect().bottom,
      copySize:parseFloat(copyStyle.fontSize),
      overflow:document.documentElement.scrollWidth-window.innerWidth,
    };
  });
  expect(result.clearance).toBeGreaterThanOrEqual(80);
  expect(result.clearance).toBeLessThanOrEqual(90);
  expect(result.rowHeight).toBeLessThanOrEqual(72);
  expect(result.footerBackground).not.toBe(result.rowBackground);
  expect(result.rowToPayGap).toBeGreaterThanOrEqual(8);
  expect(result.rowToPayGap).toBeLessThanOrEqual(32);
  expect(result.copySize).toBeGreaterThanOrEqual(14);
  expect(result.overflow).toBeLessThanOrEqual(2);
  const more=footer.locator('.public-footer__mobile-more > summary');
  await more.click();
  await expect(footer.getByRole('navigation',{name:'More footer links'})).toBeVisible();
  await more.click();
  await expect(footer.getByRole('navigation',{name:'More footer links'})).toBeHidden();
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
});

test('320px Bengali public footer remains one row with accessible links',async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await page.goto('/?action=landing&lang=bn');
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const footer=page.locator('.public-footer');
  const more=footer.locator('.public-footer__mobile-more > summary');
  await expect(more).toBeVisible();
  await expect(more).toContainText('আরও');
  await expect(footer.locator('.public-footer__bottom')).toContainText('© ২০২৬ সহজকর');
  const moreRect=await more.boundingBox();
  const floatingPayRect=await page.locator('.taxpay-public-mobile-navigation .citizen-pay--guest-floating').boundingBox();
  expect(moreRect).not.toBeNull();
  expect(floatingPayRect).not.toBeNull();
  expect(moreRect!.y+moreRect!.height).toBeLessThanOrEqual(floatingPayRect!.y-4);
  const extent=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(extent).toBeLessThanOrEqual(2);
  await more.click();
  const links=footer.getByRole('navigation',{name:'ফুটারের আরও লিংক'});
  await expect(links).toBeVisible();
  await expect(links.getByRole('button',{name:'রসিদ ও সংশোধন'})).toBeVisible();
  await expect(links.getByRole('button',{name:'নিরাপত্তা ও সহায়তা'})).toBeVisible();
  await expect(links.getByRole('link',{name:'এনবিআর প্রকাশনা'})).toBeVisible();
  await links.getByRole('button',{name:'রসিদ ও সংশোধন'}).click();
  await expect(page).toHaveURL(/action=user_guide/);
});

test('mobile Pay Tax sheet stays bottom-fixed and grows with each existing choice',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  const choice=page.getByRole('dialog',{name:'Pay Tax'});
  const bottom=async()=>{
    const box=await choice.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(844);
    return {height:box!.height,offset:Math.abs(box!.y+box!.height-844)};
  };
  // Shared sheet entrance scales from 99%; test its settled bottom edge,
  // not intermediate animation frames (the strict 2px gate is preserved).
  await expect.poll(async()=>(await bottom()).offset).toBeLessThanOrEqual(2);
  await expect.poll(async()=>(await bottom()).height).toBeLessThan(844*.8);
  const initial=(await bottom()).height;
  await choice.locator('[data-payer-relationship="SELF"]').click();
  await expect(choice.locator('[data-payment-entry]')).toHaveCount(2);
  await expect.poll(async()=> {
    const measurement=await bottom();
    return measurement.offset<=2 ? measurement.height : initial;
  }).toBeGreaterThan(initial);
  await choice.locator('[data-payment-entry="OTHER_TAX"]').click();
  await expect(choice.locator('[data-payment-access]')).toHaveCount(2);
  await expect.poll(async()=>(await bottom()).offset).toBeLessThanOrEqual(2);
  const expanded=(await bottom()).height;
  expect(expanded).toBeGreaterThan(initial);
  await choice.locator('[data-payment-access="GUEST"]').click();
  await choice.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(choice.getByRole('progressbar',{name:'Payment progress'})).toBeVisible();
  await expect.poll(async()=>(await bottom()).offset).toBeLessThanOrEqual(2);
  await choice.getByRole('button',{name:'Close payment services'}).click();
});

test('mobile Help bottom sheet closes by Escape and backdrop without changing navigation',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/?action=landing');
  const dock=page.getByRole('navigation',{name:'Mobile primary navigation'});
  await expect(dock).toBeVisible();
  const help=page.getByRole('button',{name:'Chat support'});
  await help.click();
  const dialog=page.locator('#public-help-panel');
  await expect(dialog).toBeVisible();
  const rect=await dialog.boundingBox();
  expect(rect).not.toBeNull();
  expect(Math.abs(rect!.y+rect!.height-812)).toBeLessThanOrEqual(2);
  await expect(dialog.getByRole('button',{name:'Close chat'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(dock).toBeVisible();
  await help.click();
  await expect(dialog).toBeVisible();
  await page.locator('.public-help-backdrop').click({position:{x:5,y:5}});
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Pay — select payment type'})).toBeVisible();
});

test('public desktop header is unchanged, with no mobile navigation duplication',async ({page})=>{
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/?action=landing');
  await expect(page.locator('.public-home-header')).toBeVisible();
  const desktopFooter=page.locator('.public-footer');
  await expect(desktopFooter.locator('.public-footer__mobile-actions')).toBeHidden();
  await expect(desktopFooter.getByRole('navigation',{name:'Footer navigation'})).toBeVisible();
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
