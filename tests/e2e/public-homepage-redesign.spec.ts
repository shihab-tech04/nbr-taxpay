import { mockPublishedBannerCms } from './mock-published-banners';
import { expect, test } from '@playwright/test';

test('public homepage temporarily hides payment steps and FAQ, preserving entry actions', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?action=landing');

  const mobile = testInfo.project.name !== 'desktop-1280';
  await expect(page.getByRole('heading', { name: mobile ? 'Pay tax with confidence' : 'Tax payments, without the confusion' })).toBeVisible();

  // Temporarily hidden from Home only; content and User Guide remain unchanged.
  await expect(page.locator('#public-how-it-works')).toBeHidden();
  await expect(page.locator('#public-faq')).toBeHidden();
  await expect(page.locator('.public-record-discovery')).toBeVisible();
  await expect(page.locator('.public-info-topic')).toHaveCount(0);
  await expect(page.locator('.public-info-guides')).toHaveCount(0);
  await expect(page.locator('.public-more-link')).toHaveCount(0);

  await page.locator('.citizen-public-hero__actions').getByRole('button', { name: 'Pay Tax', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog.getByRole('button', { name: 'Walk-in Payment' })).toBeVisible();
  await expect(dialog.locator('[data-payer-relationship]')).toHaveCount(0);
});

test('hidden homepage FAQ remains available via the existing User Guide page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?action=landing');
  await expect(page.locator('#public-faq')).toBeHidden();
  const guide = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'User guide' });
  await guide.click();
  await expect(page.getByRole('heading', { name: 'Sohojkor user guide' })).toBeVisible();
});

test('Report follows heading then compact content with no redundant warnings', async ({ page }) => {
  await page.setViewportSize({ width: 1792, height: 1400 });
  await page.goto('/?action=incident');
  const report = page.locator('.public-report-page');
  await expect(report.getByRole('heading', { name: 'Report a problem' })).toBeVisible();
  await expect(report.locator('.citizen-hub-eyebrow')).toHaveCount(0);
  await expect(report.getByText('This form does not send reports or create official tickets.')).toHaveCount(0);
  await expect(report.getByText('If money was debited, contact your bank or payment provider.')).toHaveCount(0);
  await expect(report.getByLabel('Issue type')).toBeVisible();
  await expect(report.getByLabel('Short description')).toBeVisible();
  const layout = await page.evaluate(() => {
    const main = document.querySelector('#main-content')!.getBoundingClientRect();
    const section = document.querySelector('.public-report-page')!.getBoundingClientRect();
    const card = document.querySelector('.public-report-card')!.getBoundingClientRect();
    const footer = document.querySelector('.public-footer')!.getBoundingClientRect();
    return {
      cardWidth: card.width,
      horizontalOffset: Math.abs(card.left + card.width / 2 - main.left - main.width / 2),
      topGap: section.top - main.top,
      footerHeight: footer.height,
      footerBottom: footer.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  expect(layout.cardWidth).toBeLessThanOrEqual(820);
  expect(layout.horizontalOffset, 'Report form must be horizontally centered').toBeLessThanOrEqual(2);
  expect(layout.topGap, 'Report heading must start near the top of the page').toBeGreaterThanOrEqual(24);
  expect(layout.topGap, 'Report must not be vertically centered on tall screens').toBeLessThanOrEqual(48);
  expect(layout.footerHeight, 'Footer itself must remain compact rather than filling the viewport').toBeLessThanOrEqual(130);
  expect(Math.abs(layout.footerBottom - layout.viewportHeight), 'Short report pages must retain a bottom-aligned footer').toBeLessThanOrEqual(4);
  await report.getByLabel('Short description').fill('A payment reference does not match my record.');
  await report.getByRole('button', { name: 'Review details' }).click();
  await expect(report.getByRole('heading', { name: 'Review your details' })).toBeVisible();
});

test('Report remains readable without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?action=incident');
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();
  await expect(page.getByLabel('Short description')).toBeVisible();
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cardWidth: document.querySelector('.public-report-card')!.getBoundingClientRect().width,
  }));
  expect(geometry.overflow).toBeLessThanOrEqual(2);
  expect(geometry.cardWidth).toBeLessThanOrEqual(358);
});

test('top navigation uses the approved blue pill for the current public route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?action=landing');

  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  const home = nav.getByRole('link', { name: 'Home' });
  const guide = nav.getByRole('link', { name: 'User guide' });
  const report = nav.getByRole('link', { name: 'Report' });
  await expect(home).toHaveAttribute('aria-current', 'page');
  const selectedStyle = await home.evaluate(element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, shadow: style.boxShadow };
  });
  expect(selectedStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(selectedStyle.shadow).toBe('none');

  await guide.click();
  await expect(guide).toHaveAttribute('aria-current', 'page');
  await expect(home).not.toHaveAttribute('aria-current', 'page');
  await report.click();
  await expect(report).toHaveAttribute('aria-current', 'page');
  await expect(guide).not.toHaveAttribute('aria-current', 'page');
});

test('mobile banner preserves all five conceptual illustrations and fixed payment actions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/?action=landing');
  const carousel = page.getByRole('region', { name: 'Tax payment service banners' });
  await expect(carousel.locator('.public-hero-carousel__slide')).toHaveCount(5);
  await expect(carousel.locator('.public-information-hero__image')).toHaveCount(5);
  const expectedAssets = ['intro-v9', 'return-v9', 'advance-v9', 'withholding-v9', 'travel-v9'];
  const images = await carousel.locator('.public-information-hero__image').evaluateAll(elements =>
    elements.map(element => (element as HTMLImageElement).dataset.deferredSrc),
  );
  expectedAssets.forEach((name, index) => expect(images[index]).toContain(`taxpay-hero-${name}`));

  const shortHeading = carousel.locator('[data-banner-service="intro"] .public-hero-copy--mobile').first();
  await expect(shortHeading).toBeVisible();
  await expect(shortHeading.locator('xpath=..')).toHaveCSS('white-space', 'normal');
  await expect(carousel.locator('.public-hero-carousel__arrow').first()).toBeHidden();
  await carousel.focus();
  await page.keyboard.press('ArrowRight');
  const active = carousel.locator('.public-hero-carousel__slide').nth(1);
  await expect(active.getByRole('button', { name: 'Pay Tax', exact: true })).toBeVisible();
  await expect(active.getByRole('button', { name: 'Other Tax', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

// Banner-dependent browser checks use explicitly published CMS rows;
// unavailable CMS must not revive unpublished bundled artwork.
test.beforeEach(async ({ page }) => { await mockPublishedBannerCms(page); });


test('Home search and six-benefit panel share readable typography, spacing and corners', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Single cross-viewport design acceptance');
  for (const viewport of [{ width: 375, height: 812 }, { width: 1024, height: 800 }, { width: 1780, height: 864 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/?action=landing');
    const search = page.locator('.public-record-discovery');
    const benefits = page.locator('.public-benefits');
    await expect(search).toBeVisible();
    await expect(benefits).toBeVisible();
    await expect(benefits.locator('.public-benefits__item')).toHaveCount(6);
    const computed = await page.evaluate(() => {
      const css = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      const searchStyle = css('.public-record-discovery');
      const benefitStyle = css('.public-home-sections .public-benefits');
      const searchTitle = css('.public-record-discovery__heading h2');
      const benefitTitle = css('.public-benefits__heading h2');
      const searchHelp = css('.public-record-discovery__heading p');
      const benefitHelp = css('.public-benefits__heading p');
      const benefitDescription = css('.public-benefits__copy p');
      return {
        titleSizes: [parseFloat(searchTitle.fontSize), parseFloat(benefitTitle.fontSize)],
        bodySizes: [parseFloat(searchHelp.fontSize), parseFloat(benefitHelp.fontSize),
          parseFloat(benefitDescription.fontSize)],
        radii: [parseFloat(searchStyle.borderTopLeftRadius), parseFloat(benefitStyle.borderTopLeftRadius)],
        horizontalPadding: [parseFloat(searchStyle.paddingLeft), parseFloat(benefitStyle.paddingLeft)],
        verticalPadding: [parseFloat(searchStyle.paddingTop), parseFloat(benefitStyle.paddingTop)],
        bottomPadding: [parseFloat(searchStyle.paddingBottom), parseFloat(benefitStyle.paddingBottom)],
        headingAfter: [
          parseFloat(css('.public-record-discovery__heading').marginBottom),
          parseFloat(css('.public-benefits__heading').marginBottom),
        ],
        subtitleBefore: [
          parseFloat(searchHelp.marginTop),
          parseFloat(benefitHelp.marginTop),
        ],
        icons: [...document.querySelectorAll<HTMLElement>('.public-benefits__item')].map(item => {
          const iconStyle = getComputedStyle(item.querySelector<HTMLElement>('.public-benefits__icon')!);
          return { id: item.dataset.benefit, background: iconStyle.backgroundColor,
            foreground: iconStyle.color, image: iconStyle.backgroundImage };
        }),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(computed.titleSizes[0], 'record search uses lighter responsive section role').toBe(viewport.width < 768 ? 18 : 20);
    expect(computed.titleSizes[1], 'benefits title matches search in lighter section tier').toBe(viewport.width < 768 ? 18 : 20);
    expect(Math.min(...computed.bodySizes.slice(0,2)), 'home helper text uses the restrained 14px tier').toBe(14);
    expect(computed.bodySizes[2], 'benefit details retain the approved 14px baseline').toBeGreaterThanOrEqual(14);
    expect(computed.radii, 'matching understated home card corners').toEqual([10,10]);
    expect(computed.horizontalPadding[0], 'same left/right insets').toBe(computed.horizontalPadding[1]);
    expect(computed.verticalPadding[0], 'same top inset').toBe(computed.verticalPadding[1]);
    expect(computed.bottomPadding[0], 'same bottom inset').toBe(computed.bottomPadding[1]);
    expect(computed.headingAfter[0], 'equal heading-to-control/grid spacing').toBe(computed.headingAfter[1]);
    expect(computed.subtitleBefore[0], 'equal title-to-subtitle spacing').toBe(computed.subtitleBefore[1]);
    expect(Math.min(...computed.horizontalPadding)).toBeGreaterThanOrEqual(14);
    expect(Math.min(...computed.verticalPadding)).toBeGreaterThanOrEqual(14);
    expect(computed.icons.map(icon => icon.id)).toEqual([
      'payments','certificates','corrections','history','pay-again','saved-drafts']);
    expect(new Set(computed.icons.map(icon => icon.background)).size).toBe(6);
    expect(new Set(computed.icons.map(icon => icon.foreground)).size).toBe(6);
    expect(computed.icons.every(icon => icon.image === 'none'), 'flat icons, no gradients').toBe(true);
    expect(computed.overflow, 'no horizontal overflow at ' + viewport.width).toBeLessThanOrEqual(2);
    await expect(page.getByRole('searchbox', { name: 'Search payment records by reference' })).toBeVisible();
  }
});


test('six connected benefit cells have soft non-moving hover/focus shadows and clean nested corners', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'Focused desktop hover and mobile corner acceptance');
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?action=landing');
    const measures = await page.evaluate(() => {
      const select = (selector: string) => getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      return {
        outer: [select('.public-record-discovery').borderTopLeftRadius,
          select('.public-benefits').borderTopLeftRadius],
        searchInput: select('.public-record-search').borderTopLeftRadius,
        grid: select('.public-benefits__grid').borderTopLeftRadius,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(measures.outer).toEqual(['10px','10px']);
    expect(measures.searchInput).toBe('8px');
    if (width >= 981) expect(measures.grid, 'connected six-cell grid has rounded outer corners').toBe('16px');
    expect(measures.overflow).toBeLessThanOrEqual(2);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?action=landing');
  const cards = page.locator('.public-benefits__item');
  await expect(cards).toHaveCount(6);
  for (const card of await cards.all()) {
    const before = await card.boundingBox();
    await expect(card).toHaveCSS('box-shadow', 'none');
    await card.hover();
    await expect(card).not.toHaveCSS('box-shadow', 'none');
    const after = await card.boundingBox();
    expect(after?.x).toBeCloseTo(before!.x, 1);
    expect(after?.y).toBeCloseTo(before!.y, 1);
    expect(after?.height).toBeCloseTo(before!.height, 1);
    expect(after?.width).toBeCloseTo(before!.width, 1);
  }

  await page.mouse.move(0,0);
  const first = cards.first();
  await expect(first.getByRole('link')).toHaveCount(0);
  await expect(first.getByRole('button')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion:'reduce' });
  await expect(first).toHaveCSS('transition-duration','0s');
  const cornerRadii = await cards.evaluateAll(items => items.map(item => {
    const css = getComputedStyle(item);
    return [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomLeftRadius, css.borderBottomRightRadius];
  }));
  expect(cornerRadii).toEqual([
    ['16px', '0px', '0px', '0px'],
    ['0px', '0px', '0px', '0px'],
    ['0px', '16px', '0px', '0px'],
    ['0px', '0px', '16px', '0px'],
    ['0px', '0px', '0px', '0px'],
    ['0px', '0px', '0px', '16px'],
  ]);
});

test('Home 2 is opt-in, retains original home, and reuses the payment entry', async ({page})=>{
  await page.goto('/?action=landing');
  await expect(page.getByTestId('home2-root')).toHaveCount(0);
  await expect(page.locator('.public-benefits__item')).toHaveCount(6);
  await page.getByRole('link',{name:'Home 2',exact:true}).click();
  await expect(page.getByTestId('home2-root')).toBeVisible();
  await expect(page).toHaveURL(/action=home-2/);
  await page.reload();
  await expect(page.getByTestId('home2-root')).toBeVisible();
  await page.getByTestId('home2-pay').click();
  await expect(page.getByRole('dialog',{name:'Pay Tax'}).getByRole('button',{name:'Walk-in Payment'})).toBeVisible();
  await page.goto('/?action=home-2');
  await page.getByRole('link',{name:'Original Home',exact:true}).click();
  await expect(page.getByTestId('home2-root')).toHaveCount(0);
  await expect(page.locator('.public-benefits__item')).toHaveCount(6);
});
test('Home 2 bilingual responsive layout keeps all actions available', async ({page}, info)=>{
  for(const lang of ['en','bn']){
    await page.goto('/?action=home-2&lang='+lang);
    const root=page.getByTestId('home2-root');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('data-design','uploaded-mobile-bento');
    await expect(root).toHaveAttribute('data-viewport',(page.viewportSize()?.width ?? 1280)>=960?'desktop':'mobile');
    await expect(root.getByTestId('home2-pay')).toBeVisible();
    await expect(root.getByTestId('home2-other')).toBeVisible();
    await expect(root.getByTestId('home2-reference')).toBeVisible();
    await expect(root.getByRole('banner')).toBeVisible();
    await expect(root.getByRole('contentinfo')).toBeVisible();
    await expect(page.locator('.public-home-header')).toHaveCount(0);
    await expect(page.locator('.citizen-bottom-nav')).toHaveCount(0);
    await page.screenshot({path:`test-results/screenshots/sohojkor-home-rhythm-home2-${info.project.name}-${lang}.png`,fullPage:true,animations:'disabled'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
});


test('Home 2 uploaded design uses actual record lookup rather than prototype response', async ({page})=>{
  await page.goto('/?action=home-2');
  const root=page.getByTestId('home2-root');
  await root.getByTestId('home2-reference').fill('HOME2-CHECK-123');
  await root.getByTestId('home2-reference').press('Enter');
  await expect(page).toHaveURL(/action=verify/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).not.toHaveURL(/HOME2-CHECK-123/);
});


test('Imported Home 2 retains source typography and never clips desktop hero or guide controls',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Cross-viewport source typography acceptance');
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [960,1024,1280,1920]){
    await page.setViewportSize({width,height:900});
    for(const lang of ['en','bn']){
      await page.goto('/?action=home-2&lang='+lang);
      const root=page.getByTestId('home2-root');
      await expect(root).toBeVisible();
      await page.evaluate(()=>document.fonts.ready);
      const hero=root.getByTestId('home2-desktop-hero');
      const copy=root.getByTestId('home2-hero-copy');
      await expect(copy.locator('p').first()).toHaveCSS('font-size','14.5px');
      await expect(copy.locator('li')).toHaveCount(0);
      await expect(root.getByTestId('home2-guide-action')).toHaveCSS('font-size','13px');
      const outer=await hero.boundingBox();
      for(const id of ['home2-pay','home2-other']){
        const action=await root.getByTestId(id).boundingBox();
        expect(action!.y+action!.height,'payment actions remain inside the hero').toBeLessThanOrEqual(outer!.y+outer!.height+1);
      }
      for(const id of ['home2-guide-action','home2-chat-action']){
        const action=root.getByTestId(id);
        expect(await action.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(2);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    }
  }
});


test('Home 2 Saved Drafts uses the approved soft rose palette on desktop and mobile',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?action=home-2&lang=en');
  const tile=page.getByTestId('home2-root').getByRole('button').filter({has:page.getByRole('heading',{name:'Saved Drafts',exact:true})});
  await expect(tile).toBeVisible();
  await expect(tile).toHaveCSS('background-color','rgb(240, 223, 227)');
  await expect(tile).toHaveCSS('color','rgb(20, 27, 45)');
  await expect(tile.locator('p')).toHaveCSS('color','rgb(112, 78, 91)');
});


test('Home 2 separates Pay Again olive and Saved Drafts rose on desktop and mobile',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?action=home-2&lang=en');
  const root=page.getByTestId('home2-root');
  const again=root.getByRole('button').filter({has:page.getByRole('heading',{name:'Pay Again',exact:true})});
  const drafts=root.getByRole('button').filter({has:page.getByRole('heading',{name:'Saved Drafts',exact:true})});
  await expect(again).toBeVisible();
  await expect(again).toHaveCSS('background-color','rgb(230, 233, 214)');
  await expect(again).toHaveCSS('color','rgb(20, 27, 45)');
  await expect(again.locator('p')).toHaveCSS('color','rgb(83, 92, 59)');
  await expect(drafts).toHaveCSS('background-color','rgb(240, 223, 227)');
});


test('Home 2 uses the uploaded project surface palette without replacing the design',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?action=home-2&lang=en');
  const root=page.getByTestId('home2-root');
  for(const [title,color] of [['All Tax Payments','rgb(220, 235, 233)'],['Payment History','rgb(240, 232, 214)'],['Tax Certificates','rgb(229, 226, 240)'],['Corrections & Requests','rgb(241, 224, 216)'],['Pay Again','rgb(230, 233, 214)'],['Saved Drafts','rgb(240, 223, 227)']]){
    const tile=root.getByRole('button').filter({has:page.getByRole('heading',{name:title,exact:true})});
    await expect(tile).toBeVisible();await expect(tile).toHaveCSS('background-color',color);
  }
  await expect(root.getByRole('button').filter({has:page.getByRole('heading',{name:'All Tax Payments',exact:true})})).toHaveCSS('color','rgb(21, 32, 51)');
});


test('Home 2 primary banner omits the eyebrow and trust labels in both languages',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const lang of ['en','bn']){
    await page.goto('/?action=home-2&lang='+lang);
    const root=page.getByTestId('home2-root');
    const hero=root.getByTestId('home2-primary-slide');
    await expect(hero.getByRole('heading',{level:1})).toBeVisible();
    await expect(hero.locator('p')).toBeVisible();
    await expect(hero.getByTestId('home2-pay')).toBeVisible();
    await expect(hero.getByTestId('home2-other')).toBeVisible();
    for(const label of ['Income tax, simplified','Secure payment','Instant challan','Receipts kept','আয়কর, সহজভাবে','নিরাপদ পেমেন্ট','তাৎক্ষণিক চালান','রসিদ সংরক্ষিত থাকে']){
      await expect(hero.getByText(label,{exact:true})).toHaveCount(0);
    }
    await expect(hero.locator('img')).toHaveCount(1);
  }
});


test('Home 3 is reachable from the original footer and preserves existing payment entry', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  await page.getByRole('link', {name:'Home 3',exact:true}).click();
  await expect(page).toHaveURL(/action=home-3/);
  const home=page.getByTestId('home3-root');
  await expect(home).toBeVisible();
  await expect(home.getByRole('heading',{name:/Pay and Manage\s*Your Taxes Digitally/i})).toBeVisible();
  await expect(home.getByText('Find Your Payment Record',{exact:true}).filter({visible:true})).toBeVisible();
  await expect(home.getByRole('heading',{name:'Payment History'})).toBeVisible();
  await expect(home.getByRole('heading',{name:'Tax Certificates'})).toBeVisible();
  await expect(home.getByRole('heading',{name:'Corrections & Requests'})).toBeVisible();
  await expect(home.locator('a[href="#"]')).toHaveCount(0);
  await expect.poll(()=>home.locator('img').evaluateAll(imgs=>imgs.every(i=>i instanceof HTMLImageElement&&i.complete&&i.naturalWidth>0))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await expect(home.getByRole('link',{name:/Pay\s+Gift Tax/})).toBeVisible();
  await expect(home.getByRole('link',{name:/Pay\s+Travel Tax/})).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280)>=640) {
    await home.getByRole('button',{name:'Search',exact:true}).click();
    await expect(home.getByRole('alert')).toHaveText('Enter a payment reference.');
  } else {
    await home.getByRole('link',{name:/Find Your Payment Record/}).click();
    await expect(page).toHaveURL(/action=verify/);
    await page.goto('/?action=home-3&lang=en');
  }
  await home.getByRole('link',{name:'Pay Income Tax',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Pay Tax'}).getByRole('button',{name:'Walk-in Payment'})).toBeVisible();
  await page.getByRole('dialog',{name:'Pay Tax'}).getByRole('button',{name:'Close payment services'}).click();
  await expect(home).toBeVisible();
  await home.getByRole('link',{name:'Original Home',exact:true}).click();
  await expect(page).toHaveURL(/action=landing/);
  await expect(page.locator('.public-record-discovery')).toBeVisible();
});
test('Home 3 direct URL and Bengali translation retain the separate Home 2 route', async ({page})=>{
  await page.goto('/?action=home-3&lang=bn');
  await expect(page.getByTestId('home3-root').getByRole('heading',{name:/ডিজিটাল পদ্ধতিতে কর/})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.getByTestId('home3-root').getByRole('link',{name:'Home 2',exact:true}).click();
  await expect(page.getByTestId('home2-root')).toBeVisible();
  await expect(page.getByRole('link',{name:'Home 3',exact:true})).toBeVisible();
});
