import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { openLegacyTaxServiceChoice } from './pay-tax-entry-helper';

test('All Tax Payments benefit opens the approved parallel chooser', async ({ page }) => {
  await page.setViewportSize({ width: 1140, height: 900 });
  await page.goto('/?action=landing&lang=en');
  const benefits = page.locator('.public-benefits');
  await expect(benefits.getByRole('heading', { name: 'Why choose Sohojkor?' })).toBeVisible();
  const cards = benefits.locator('.public-benefits__item');
  await expect(cards).toHaveCount(6);
  await expect(benefits.locator('[data-benefit="payments"]')).toHaveJSProperty('tagName', 'BUTTON');
  for (const id of ['certificates','corrections','history','pay-again','saved-drafts']) {
    await expect(benefits.locator(`[data-benefit="${id}"]`)).toHaveJSProperty('tagName', 'ARTICLE');
  }
  await expect(benefits.getByRole('button')).toHaveCount(1);
  await benefits.locator('[data-benefit="payments"]').click();
  const dialog = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('User ID')).toBeVisible();
  await expect(dialog.getByText('Password', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Walk-in Payment' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sign In to Pay Tax' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Walk-in Payment' }).click();
  await expect(dialog.locator('.taxpay-modal__title')).toHaveText('Taxpayer Information');
  await expect(dialog.getByRole('progressbar', { name: 'Payment progress' })).toHaveAttribute('aria-valuemax', '3');
  await expect(dialog.locator('#guest-payer-name')).toHaveCount(0);
  await expect(dialog.locator('#guest-phone')).toHaveCount(0);
});

test('preserved original tax flow still has its payer/service chooser and four-stage wizard', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');
  const modal = await openLegacyTaxServiceChoice(page);
  await expect(modal.locator('[data-payer-relationship]')).toHaveCount(2);
  await expect(modal.locator('[data-payment-entry]')).toHaveCount(0);
  await modal.locator('[data-payer-relationship="OTHER"]').click();
  await modal.locator('[data-payment-entry="OTHER_TAX"]').click();
  await modal.locator('[data-payment-access="GUEST"]').click();
  await expect(modal.getByRole('button',{name:'Continue',exact:true})).toBeEnabled();
  await modal.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(modal.locator('.taxpay-modal__step-count')).toHaveText('1/4 Steps');
  await expect(modal.locator('.taxpay-modal__subtitle')).toContainText('Other Tax Payment');
});

test('wide desktop uses the available canvas without crushing the footer or lookup', async ({ page }) => {
  await page.setViewportSize({width:1775,height:864});
  await page.goto('/?action=landing&lang=en');
  await page.evaluate(async()=>{await document.fonts.ready;});
  const visual = await page.evaluate(()=>{
    const box=(selector:string)=>{
      const el=document.querySelector(selector)!;
      const r=el.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
    };
    const footerLinks=[...document.querySelectorAll('.public-footer__navs > *')]
      .map(link=>link.getBoundingClientRect());
    const overlapping=(a:DOMRect,b:DOMRect) =>
      a.left < b.right - 1 && a.right > b.left + 1 &&
      a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const identity=document.querySelector('.public-footer__identity')!.getBoundingClientRect();
    const copyright=document.querySelector('.public-footer__bottom')!.getBoundingClientRect();
    const footerCollision=footerLinks.some((link,index) =>
      overlapping(link,identity) || overlapping(link,copyright) ||
      footerLinks.some((other,j)=>j!==index && overlapping(link,other)));
    return {
      hero:box('.public-hero-carousel'),
      record:box('.public-record-discovery'),
      benefits:box('.public-benefits'),
      footer:box('.public-footer'),
      footerTagline:box('.public-footer__identity p'),
      searchHeading:box('.public-record-discovery__heading'),
      searchField:box('.public-record-search'),
      firstCard:box('.public-benefits__item'),
      footerGaps:footerLinks.slice(1).flatMap((link,index)=>
        Math.abs(link.top-footerLinks[index].top)<=2 ? [link.left-footerLinks[index].right] : []),
      footerLinkCount:footerLinks.length,
      footerGeometry:{ identity:{x:identity.x,right:identity.right,width:identity.width},
        copyright:{x:copyright.x,right:copyright.right,width:copyright.width},
        links:footerLinks.map(r=>({x:r.x,right:r.right,width:r.width,y:r.y,height:r.height})) },
      footerCollision,
      scrollOverflow:document.documentElement.scrollHeight-window.innerHeight,
      horizontalOverflow:document.documentElement.scrollWidth-window.innerWidth,
    };
  });
  // Home must match Guide and Report on wide monitors.
  expect(visual.hero.width).toBeGreaterThanOrEqual(1099);
  expect(visual.hero.width).toBeLessThanOrEqual(1101);
  expect(Math.abs(visual.hero.width-visual.record.width)).toBeLessThanOrEqual(2);
  expect(visual.searchHeading.bottom).toBeLessThan(visual.searchField.top);
  expect(visual.searchField.width).toBeGreaterThanOrEqual(visual.record.width*.9);
  // Six balanced benefit cards should retain adequate height at wide viewport sizes.
  // Medium-height desktops retain balanced readable cells and no-overflow layout.
  expect(visual.firstCard.height).toBeGreaterThanOrEqual(88);
  // Two-line tagline is acceptable; footer links must never touch or overlap.
  expect(visual.footerTagline.height).toBeLessThanOrEqual(44);
  expect(visual.footerLinkCount).toBe(4);
  expect(visual.footerCollision,JSON.stringify(visual.footerGeometry)).toBe(false);
  expect(visual.footerGaps.every(gap=>gap>=10)).toBe(true);
  expect(visual.footer.top).toBeGreaterThanOrEqual(visual.benefits.bottom);
  expect(visual.scrollOverflow).toBeLessThanOrEqual(2);
  expect(visual.horizontalOverflow).toBeLessThanOrEqual(2);
});


test('reported tall desktop: homepage footer follows content with no blank spacer or touching links', async ({page}) => {
  for (const viewport of [
    {width:1186,height:1254},
    {width:1440,height:1254},
    {width:1775,height:1254},
  ]) {
    for (const lang of ['en','bn']) {
      await page.setViewportSize(viewport);
      await page.goto('/?action=landing&lang=' + lang);
      await page.evaluate(async () => { await document.fonts.ready; });
      const layout=await page.evaluate(() => {
        const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
        const boxes=[...document.querySelectorAll('.public-footer__navs > *')].map(el=>el.getBoundingClientRect());
        const identity=rect('.public-footer__identity');
        const copyright=rect('.public-footer__bottom');
        const overlap=(a:DOMRect,b:DOMRect)=>a.left < b.right - 1 &&
          a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        return {
          homeWidth:rect('.public-information-hub').width,
          benefitsBottom:rect('.public-benefits').bottom,
          footerTop:rect('.public-footer').top,
          footerHeight:rect('.public-footer').height,
          shellHeight:rect('.taxpay-citizen-shell').height,
          shellTop:rect('.taxpay-citizen-shell').top,
          shellBottom:rect('.taxpay-citizen-shell').bottom,
          footerBottom:rect('.public-footer').bottom,
          mainBottom:rect('#main-content').bottom,
          backgroundColor:getComputedStyle(document.querySelector('.taxpay-citizen-shell')!).backgroundColor,
          centerBottomCovered:Boolean(document.elementFromPoint(innerWidth/2,innerHeight-2)
            ?.closest('.taxpay-citizen-shell')),
          footerGeometry:{ identity:{x:identity.x,right:identity.right,width:identity.width},
            copyright:{x:copyright.x,right:copyright.right,width:copyright.width},
            links:boxes.map(r=>({x:r.x,right:r.right,width:r.width,y:r.y,height:r.height})) },
          footerOverflow:boxes.some((r,i) => overlap(r,identity) || overlap(r,copyright) ||
            boxes.some((other,j)=>i!==j && overlap(r,other))),
          linkGap:boxes.slice(1).flatMap((r,i)=>
            Math.abs(r.top-boxes[i].top)<=2 ? [r.left-boxes[i].right] : []),
          horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
        };
      });
      expect(layout.homeWidth,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(Math.min(1100, viewport.width - 64) - 1);
      expect(layout.homeWidth).toBeLessThanOrEqual(Math.min(1100, viewport.width - 64) + 1);
      expect(layout.footerTop-layout.benefitsBottom,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(0);
      // A full-height shell is insufficient: the page must not leave the
      // 300px+ blank chasm shown between the benefits and footer.
      // Unused space on a tall monitor belongs after the grouped content,
      // not between the payment actions, search and information cards.
      // Full-height shell must remain the page canvas, including the bottommost
      // screen pixel. Previous tests checked only that the footer followed the cards,
      // allowing the 300px exposed body background seen in production.
      expect(layout.shellTop).toBeGreaterThanOrEqual(-1);
      expect(layout.shellBottom,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(viewport.height-2);
      expect(layout.shellHeight,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(viewport.height-2);
      expect(layout.mainBottom).toBeLessThanOrEqual(layout.footerTop+2);
      expect(layout.footerBottom,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(viewport.height-2);
      expect(layout.footerBottom,JSON.stringify({viewport,lang,layout})).toBeLessThanOrEqual(viewport.height+2);
      expect(layout.centerBottomCovered).toBe(true);
      expect(layout.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(layout.footerHeight).toBeLessThanOrEqual(140);
      expect(layout.footerOverflow,JSON.stringify({viewport,lang,layout})).toBe(false);
      expect(layout.linkGap.every(gap=>gap>=10)).toBe(true);
      expect(layout.horizontalOverflow).toBeLessThanOrEqual(2);
    }
  }
  // Report's approved bottom-aligned footer is outside the Home-only fix.
  await page.setViewportSize({width:1186,height:1254});
  await page.goto('/?action=incident');
  const reportFooter=await page.locator('.public-footer').boundingBox();
  expect(reportFooter).not.toBeNull();
  expect(Math.abs(reportFooter!.y+reportFooter!.height-1254)).toBeLessThanOrEqual(4);
});

test('homepage viewport integrity survives 1024px breakpoint and zoom-equivalent tall screens', async ({page}) => {
  const viewports = [
    {width: 1024,height: 1023},
    {width: 1024,height: 1024},
    {width: 1024,height: 1025},
    {width: 1186,height: 940},
    {width: 1186,height: 1175}, // 80% browser zoom equivalent of a 940px physical screen
    {width: 1440,height: 900},
    {width: 1440,height: 1125}, // 80% browser zoom equivalent of a 900px physical screen
    {width: 1775,height: 1254},
    {width: 1775,height: 1567}, // tall zoom-equivalent desktop
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/?action=landing&lang=en');
    await page.evaluate(async()=>{await document.fonts.ready;});
    const bounds=await page.evaluate(()=>{
      const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
      const shell=rect('.taxpay-citizen-shell');
      const footer=rect('.public-footer');
      const benefits=rect('.public-benefits');
      return {
        viewportHeight:innerHeight,
        shellBottom:shell.bottom,
        footerBottom:footer.bottom,
        footerTop:footer.top,
        benefitsBottom:benefits.bottom,
        horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
        atBottom:Boolean(document.elementFromPoint(innerWidth/2,innerHeight-2)
          ?.closest('.taxpay-citizen-shell')),
      };
    });
    expect(bounds.shellBottom,JSON.stringify({viewport,bounds})).toBeGreaterThanOrEqual(viewport.height-2);
    expect(bounds.footerBottom,JSON.stringify({viewport,bounds})).toBeGreaterThanOrEqual(viewport.height-2);
    expect(bounds.footerTop).toBeGreaterThanOrEqual(bounds.benefitsBottom);
    expect(bounds.atBottom).toBe(true);
    expect(bounds.horizontalOverflow).toBeLessThanOrEqual(2);
  }
});

test('professionally balanced Home padding and vertical rhythm at normal and zoom-equivalent widths', async ({page}) => {
  const screens = [
    {width:1186,height:1254},
    {width:1194,height:1268}, // actual regression screenshot: no ~100px distributed gaps
    {width:1440,height:1254},
    {width:1775,height:1254},
    {width:2048,height:1016},
    {width:3072,height:1524}, // approximates the supplied 2048x1016 screenshot at 67% zoom
  ];
  for(const viewport of screens) {
    for (const lang of ['en','bn']) {
      await page.setViewportSize(viewport);
      await page.goto('/?action=landing&lang='+lang);
      await page.evaluate(async()=>{await document.fonts.ready;});
      const layout=await page.evaluate(() => {
        const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
        const css=(selector:string)=>getComputedStyle(document.querySelector(selector)!);
        const cards=[...document.querySelectorAll('.public-benefits__item')].map(el=>el.getBoundingClientRect());
        const hero=rect('.public-hero-carousel');
        const search=rect('.public-record-discovery');
        const benefits=rect('.public-benefits');
        const footer=rect('.public-footer');
        const header=rect('.public-home-header');
        const grid=rect('.public-benefits__grid');
        return {
          contentWidth:rect('.public-information-hub').width,
          headingToFooter:footer.top-benefits.bottom,
          headerToHero:hero.top-header.bottom,
          heroToSearch:search.top-hero.bottom,
          searchToBenefits:benefits.top-search.bottom,
          footerBottom:footer.bottom,
          cardsCount:cards.length,
          equalRowHeights:Math.max(...cards.map(c=>c.height))-Math.min(...cards.map(c=>c.height)),
          cardHeight:cards[0].height,
          cardPadding:parseFloat(css('.public-benefits__item').paddingTop),
          gridRowGap:parseFloat(css('.public-benefits__grid').rowGap),
          layoutWidth:grid.width,
          horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
        };
      });
      expect(layout.contentWidth,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(Math.min(1100, viewport.width - 64) - 1);
      expect(layout.contentWidth).toBeLessThanOrEqual(Math.min(1100, viewport.width - 64) + 1);
      expect(layout.cardsCount).toBe(6);
      expect(layout.equalRowHeights).toBeLessThanOrEqual(2);
      expect(layout.cardPadding).toBeGreaterThanOrEqual(14);
      expect(layout.gridRowGap).toBeGreaterThanOrEqual(.9);
      expect(layout.gridRowGap).toBeLessThanOrEqual(1.1);
      expect(layout.cardHeight).toBeGreaterThanOrEqual(108);
      expect(layout.cardHeight).toBeLessThanOrEqual(210);
      // A short Home does not need to consume every pixel of a tall monitor:
      // its sections must stay together. Only the footer is bottom-aligned.
      expect(layout.headingToFooter).toBeGreaterThanOrEqual(0);
      expect(layout.headerToHero,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(0);
      expect(layout.headerToHero,JSON.stringify({viewport,lang,layout})).toBeLessThanOrEqual(28);
      expect(layout.heroToSearch,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(12);
      expect(layout.heroToSearch,JSON.stringify({viewport,lang,layout})).toBeLessThanOrEqual(24);
      expect(layout.searchToBenefits,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(12);
      expect(layout.searchToBenefits,JSON.stringify({viewport,lang,layout})).toBeLessThanOrEqual(24);
      expect(layout.footerBottom).toBeGreaterThanOrEqual(viewport.height-2);
      expect(layout.footerBottom).toBeLessThanOrEqual(viewport.height+2);
      expect(layout.horizontalOverflow).toBeLessThanOrEqual(2);
      // Preserve a real pixel artifact for independent visual review, not only
      // numeric box-geometry assertions. Separate per project to avoid races.
      if (lang === 'en' && [1194, 1440, 3072].includes(viewport.width)) {
        await mkdir('test-results/screenshots', { recursive: true });
        const project = test.info().project.name.replace(/[^a-z0-9-]/gi, '-');
        await page.screenshot({
          path: `test-results/screenshots/sohojkor-home-rhythm-${viewport.width}x${viewport.height}-${project}.png`,
          fullPage: true,
        });
      }
    }
  }
});

test('record search and benefits share a restrained, left-aligned desktop heading hierarchy', async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1775, height: 864 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/?action=landing&lang=en');
    await page.evaluate(async () => { await document.fonts.ready; });

    const measurements = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const css = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      const recordTitle = rect('.public-record-discovery__heading h2');
      const recordDescription = rect('.public-record-discovery__heading p');
      const benefitsTitle = rect('.public-benefits__heading h2');
      const benefitsDescription = rect('.public-benefits__heading p');
      const search = rect('.public-record-search');
      const searchSection = rect('.public-record-discovery');
      return {
        recordTitleX: recordTitle.left,
        recordDescriptionX: recordDescription.left,
        benefitTitleX: benefitsTitle.left,
        benefitDescriptionX: benefitsDescription.left,
        recordDescriptionY: recordDescription.top,
        recordTitleBottom: recordTitle.bottom,
        benefitDescriptionY: benefitsDescription.top,
        benefitTitleBottom: benefitsTitle.bottom,
        searchY: search.top,
        recordDescriptionBottom: recordDescription.bottom,
        searchWidth: search.width,
        sectionWidth: searchSection.width,
        weights: [
          Number(css('.public-record-discovery__heading h2').fontWeight),
          Number(css('.public-benefits__heading h2').fontWeight),
          Number(css('.public-benefits__heading p').fontWeight),
        ],
        fontSizes: [
          css('.public-record-discovery__heading h2').fontSize,
          css('.public-benefits__heading h2').fontSize,
          css('.public-record-discovery__heading p').fontSize,
          css('.public-benefits__heading p').fontSize,
        ],
        documentHeightOverflow: document.documentElement.scrollHeight - innerHeight,
        documentWidthOverflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(Math.abs(measurements.recordTitleX - measurements.recordDescriptionX)).toBeLessThanOrEqual(2);
    expect(Math.abs(measurements.benefitTitleX - measurements.benefitDescriptionX)).toBeLessThanOrEqual(2);
    expect(measurements.recordDescriptionY).toBeGreaterThanOrEqual(measurements.recordTitleBottom);
    expect(measurements.benefitDescriptionY).toBeGreaterThanOrEqual(measurements.benefitTitleBottom);
    expect(measurements.searchY).toBeGreaterThan(measurements.recordDescriptionBottom);
    expect(measurements.searchWidth).toBeGreaterThanOrEqual(measurements.sectionWidth * .9);
    expect(measurements.weights).toEqual([600, 600, 400]);
    expect(measurements.fontSizes).toEqual(['20px', '20px', '14px', '14px']);
    expect(measurements.documentHeightOverflow).toBeLessThanOrEqual(2);
    expect(measurements.documentWidthOverflow).toBeLessThanOrEqual(2);
  }
});

test('payment-record lookup keeps the new readable heading and consistent card geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?action=landing&lang=en');
  await page.evaluate(async () => { await document.fonts.ready; });

  const panel = page.locator('.public-record-discovery');
  await expect(panel.getByRole('heading', { name: 'Find a payment record' })).toBeVisible();
  await expect(panel.locator('.public-record-discovery__heading p')).toHaveText(
    'Search by challan, token or transaction reference.'
  );
  const layout = await panel.evaluate(el => {
    const r = el.getBoundingClientRect();
    const heading = el.querySelector('.public-record-discovery__heading')!.getBoundingClientRect();
    const form = el.querySelector('.public-record-search')!.getBoundingClientRect();
    const button = el.querySelector('.public-record-search button')!.getBoundingClientRect();
    return {
      panelHeight: r.height,
      panelRadius: parseFloat(getComputedStyle(el).borderRadius),
      bg: getComputedStyle(el).backgroundColor,
      headingBottom: heading.bottom,
      formTop: form.top,
      formHeight: form.height,
      formWidth: form.width,
      panelWidth: r.width,
      buttonWidth: button.width,
      formShadow: getComputedStyle(el.querySelector('.public-record-search')!).boxShadow,
    };
  });
  expect(layout.panelHeight).toBeGreaterThanOrEqual(108);
  expect(layout.panelHeight).toBeLessThanOrEqual(150);
  expect(layout.panelRadius).toBe(10);
  expect(layout.headingBottom).toBeLessThan(layout.formTop);
  expect(layout.formHeight).toBeGreaterThanOrEqual(46);
  expect(layout.formHeight).toBeLessThanOrEqual(52);
  expect(layout.formWidth).toBeGreaterThanOrEqual(layout.panelWidth * .95);
  expect(layout.buttonWidth).toBeGreaterThanOrEqual(40);
  expect(layout.bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(layout.formShadow).not.toBe('none');
  await expect(panel.getByRole('searchbox')).toHaveAttribute('placeholder',
    'Enter challan, token or transaction reference');
});

test('desktop search keeps compact inset below the 960px height breakpoint', async ({page}) => {
  for (const {height,padLeft,padTop,padBottom} of [
    {height:959,padLeft:16,padTop:16,padBottom:16},
    {height:960,padLeft:24,padTop:24,padBottom:24},
  ]) {
    for (const lang of ['en','bn']) {
      await page.setViewportSize({width:1151,height});
      await page.goto('/?action=landing&lang='+lang);
      await page.evaluate(async()=>{await document.fonts.ready;});
      const measurements=await page.locator('.public-record-discovery').evaluate(el=>{
        const style=getComputedStyle(el);
        return {
          top:parseFloat(style.paddingTop),
          bottom:parseFloat(style.paddingBottom),
          left:parseFloat(style.paddingLeft),
          overflow:document.documentElement.scrollWidth-innerWidth,
        };
      });
      expect(measurements.left,JSON.stringify({lang,height,measurements})).toBe(padLeft);
      expect(Math.abs(measurements.top-padTop)).toBeLessThanOrEqual(1);
      expect(Math.abs(measurements.bottom-padBottom)).toBeLessThanOrEqual(1);
      expect(measurements.overflow).toBeLessThanOrEqual(2);
    }
  }
});

test('reference screenshot: tall desktop payment search matches approved padding and vertical composition', async ({page}) => {
  for (const viewport of [
    {width:1151,height:1263}, // exact supplied approved-reference PNG
    {width:1194,height:1268},
  ]) {
    for (const lang of ['en','bn']) {
      await page.setViewportSize(viewport);
      await page.goto('/?action=landing&lang=' + lang);
      await page.evaluate(async()=>{ await document.fonts.ready; });
      const metrics=await page.evaluate(()=>{
        const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
        const style=(selector:string)=>getComputedStyle(document.querySelector(selector)!);
        const hero=rect('.public-hero-carousel');
        const search=rect('.public-record-discovery');
        const input=rect('.public-record-search');
        const benefits=rect('.public-benefits');
        const footer=rect('.public-footer');
        const panel=style('.public-record-discovery');
        return {
          heroHeight:hero.height,
          heroToSearch:search.top-hero.bottom,
          searchHeight:search.height,
          searchPadLeft:parseFloat(panel.paddingLeft),
          searchPadRight:parseFloat(panel.paddingRight),
          searchPadTop:parseFloat(panel.paddingTop),
          searchPadBottom:parseFloat(panel.paddingBottom),
          headingGap:parseFloat(style('.public-record-discovery__heading').marginBottom),
          searchToBenefits:benefits.top-search.bottom,
          inputWidth:input.width,
          panelWidth:search.width,
          footerBottom:footer.bottom,
          viewportHeight:innerHeight,
          horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
        };
      });
      expect(metrics.searchPadLeft,JSON.stringify({lang,viewport,metrics})).toBe(24);
      expect(metrics.searchPadRight).toBe(24);
      expect(metrics.searchPadTop).toBe(24);
      expect(metrics.searchPadBottom).toBe(24);
      expect(metrics.headingGap).toBeGreaterThanOrEqual(12);
      expect(metrics.searchHeight,JSON.stringify({lang,viewport,metrics})).toBeGreaterThanOrEqual(148);
      expect(metrics.searchHeight).toBeLessThanOrEqual(170);
      expect(metrics.heroHeight).toBeGreaterThanOrEqual(260);
      expect(metrics.heroHeight).toBeLessThanOrEqual(284);
      expect(metrics.heroToSearch).toBeGreaterThanOrEqual(12);
      expect(metrics.heroToSearch).toBeLessThanOrEqual(20);
      expect(metrics.searchToBenefits).toBeGreaterThanOrEqual(12);
      expect(metrics.searchToBenefits).toBeLessThanOrEqual(20);
      expect(metrics.inputWidth).toBeGreaterThanOrEqual(metrics.panelWidth-60);
      expect(metrics.footerBottom).toBeGreaterThanOrEqual(metrics.viewportHeight-2);
      expect(metrics.horizontalOverflow).toBeLessThanOrEqual(2);
      if (lang==='en' && viewport.width===1151) {
        await mkdir('test-results/screenshots',{recursive:true});
        const project=test.info().project.name.replace(/[^a-z0-9-]/gi,'-');
        await page.screenshot({
          path:`test-results/screenshots/sohojkor-home-rhythm-reference-1151x1263-${project}.png`,
          fullPage:true,
        });
      }
    }
  }
});

test('approved desktop proposal is one white rounded panel with a connected 3x2 grid', async ({ page }) => {
  for (const viewport of [
    { width: 1136, height: 1264 },
    { width: 1194, height: 1268 },
    { width: 1440, height: 900 },
  ]) {
    for (const lang of ['en', 'bn']) {
      await page.setViewportSize(viewport);
      await page.goto('/?action=landing&lang=' + lang);
      await page.evaluate(async () => { await document.fonts.ready; });
      const measurement = await page.evaluate(() => {
        const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
        const css = (selector: string) => getComputedStyle(document.querySelector(selector)!);
        const section = rect('.public-benefits');
        const heading = rect('.public-benefits__heading');
        const grid = rect('.public-benefits__grid');
        const cells = [...document.querySelectorAll('.public-benefits__item')].map(el => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return { left:r.left, right:r.right, top:r.top, bottom:r.bottom,
            height:r.height, radius:style.borderTopLeftRadius,
            border:style.borderTopWidth,
            background:style.backgroundColor, scrollHeight:el.scrollHeight, clientHeight:el.clientHeight };
        });
        return {
          panelWidth:section.width, panelRadius:parseFloat(css('.public-benefits').borderTopLeftRadius),
          panelPadding:parseFloat(css('.public-benefits').paddingLeft),
          sectionBackground:css('.public-benefits').backgroundColor,
          headingWithinPanel:heading.left>=section.left && heading.top>section.top,
          gridWithinPanel:grid.left>=section.left && grid.right<=section.right,
          gridLeft:grid.left, gridTop:grid.top,
          columnGap:parseFloat(css('.public-benefits__grid').columnGap),
          rowGap:parseFloat(css('.public-benefits__grid').rowGap),
          cells, horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
        };
      });
      // The approved shared desktop maximum is 1100px; a narrower viewport retains 32px
      // horizontal gutters rather than overflowing to satisfy the max width.
      const expectedPanelWidth=Math.min(1100,viewport.width-64);
      expect(Math.abs(measurement.panelWidth-expectedPanelWidth),
        JSON.stringify({viewport,lang,measurement})).toBeLessThanOrEqual(2);
      expect(measurement.panelRadius).toBe(10);
      // The reference tall desktop keeps 24px; medium-height layouts fit in 16px.
      const expectedPadding=viewport.height<=959 ? 16 : 24;
      expect(measurement.panelPadding).toBeGreaterThanOrEqual(expectedPadding);
      expect(measurement.sectionBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(measurement.headingWithinPanel).toBe(true);
      expect(measurement.gridWithinPanel).toBe(true);
      expect(measurement.columnGap).toBe(1);
      expect(measurement.rowGap).toBe(1);
      expect(measurement.cells).toHaveLength(6);
      const c=measurement.cells;
      expect(Math.abs(c[0].top-c[1].top)).toBeLessThanOrEqual(2);
      expect(Math.abs(c[1].top-c[2].top)).toBeLessThanOrEqual(2);
      expect(Math.abs(c[3].top-c[4].top)).toBeLessThanOrEqual(2);
      expect(c[3].top).toBeGreaterThan(c[0].top);
      expect(Math.abs(c[1].left-c[0].right-1)).toBeLessThanOrEqual(1);
      expect(Math.abs(c[3].top-c[0].bottom-1)).toBeLessThanOrEqual(1);
      expect(c.every((x, index) => x.radius === (index === 0 ? '16px' : '0px') && x.border === '0px' &&
        x.background === measurement.sectionBackground && x.scrollHeight<=x.clientHeight+2)).toBe(true);
      expect(measurement.horizontalOverflow).toBeLessThanOrEqual(2);
      if (lang==='en' && viewport.height===1264) {
        await mkdir('test-results/screenshots', {recursive:true});
        const project=test.info().project.name.replace(/[^a-z0-9-]/gi,'-');
        await page.screenshot({path:`test-results/screenshots/sohojkor-approved-connected-benefits-${project}.png`,fullPage:true});
      }
    }
  }
});

test('desktop widths preserve the approved 3-by-2 equal-benefit layout in EN and BN', async ({ page }) => {
  for (const viewport of [
    { width: 1200, height: 900 },
    { width: 1310, height: 924 },
  ]) {
    for (const lang of ['en', 'bn']) {
      await page.setViewportSize(viewport);
      await page.goto('/?action=landing&lang=' + lang);
      await page.evaluate(async () => { await document.fonts.ready; });
      const cards = page.locator('.public-benefits__item');
      await expect(cards).toHaveCount(6);
      await expect(page.locator('.public-benefits__highlights')).toHaveCount(0);
      const result = await page.evaluate(() => {
        const grid = document.querySelector('.public-benefits__grid')!;
        const boxes = [...grid.querySelectorAll('.public-benefits__item')].map(el => {
          const r = el.getBoundingClientRect();
          return { x:r.x, y:r.y, width:r.width, height:r.height,
            scrollHeight:el.scrollHeight, clientHeight:el.clientHeight };
        });
        return {
          columns:getComputedStyle(grid).gridTemplateColumns.trim().split(' ').filter(Boolean).length,
          boxes,
          homeWidth:document.querySelector('.public-information-hub')!.getBoundingClientRect().width,
          searchWidth:document.querySelector('.public-record-discovery')!.getBoundingClientRect().width,
          overflowX:document.documentElement.scrollWidth-innerWidth,
        };
      });
      expect(result.columns, JSON.stringify({viewport,lang,result})).toBe(3);
      const b = result.boxes;
      expect(Math.abs(b[0].y-b[1].y)).toBeLessThanOrEqual(2);
      expect(Math.abs(b[1].y-b[2].y)).toBeLessThanOrEqual(2);
      expect(Math.abs(b[3].y-b[4].y)).toBeLessThanOrEqual(2);
      expect(b[3].y).toBeGreaterThan(b[0].y);
      expect(Math.abs(b[0].x-b[3].x)).toBeLessThanOrEqual(2);
      expect(Math.max(...b.map(x=>x.height))-Math.min(...b.map(x=>x.height))).toBeLessThanOrEqual(2);
      expect(b.every(x=>x.scrollHeight<=x.clientHeight+2)).toBe(true);
      expect(result.homeWidth).toBeGreaterThanOrEqual(Math.min(1100, viewport.width - 64) - 1);
      expect(result.homeWidth).toBeLessThanOrEqual(Math.min(1100, viewport.width - 64) + 1);
      expect(Math.abs(result.homeWidth-result.searchWidth)).toBeLessThanOrEqual(2);
      expect(result.overflowX).toBeLessThanOrEqual(2);
    }
  }
});

test('wide desktop keeps all six balanced cards and no placeholder illustrations', async ({ page }) => {
  for (const lang of ['en','bn']) {
    await page.setViewportSize({ width: 1775, height: 864 });
    await page.goto('/?action=landing&lang=' + lang);
    await page.evaluate(async()=>{await document.fonts.ready;});
    const cards = page.locator('.public-benefits__item');
    await expect(cards).toHaveCount(6);
    await expect(page.locator('.public-benefits__preview')).toHaveCount(0);
    await expect(page.locator('.public-benefits__highlights')).toHaveCount(0);
    const boxes = await cards.evaluateAll(elements => elements.map(el => {
      const r = el.getBoundingClientRect();
      return {x:r.x,y:r.y,height:r.height,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};
    }));
    const approx=(a:number,b:number)=>Math.abs(a-b)<=2;
    expect(approx(boxes[0].y,boxes[1].y) && approx(boxes[1].y,boxes[2].y)).toBe(true);
    expect(approx(boxes[3].y,boxes[4].y) && approx(boxes[4].y,boxes[5].y)).toBe(true);
    expect(boxes[3].y).toBeGreaterThan(boxes[0].y);
    expect(approx(boxes[0].x,boxes[3].x)).toBe(true);
    expect(approx(boxes[1].x,boxes[4].x)).toBe(true);
    expect(approx(boxes[2].x,boxes[5].x)).toBe(true);
    expect(Math.max(...boxes.map(x=>x.height))-Math.min(...boxes.map(x=>x.height))).toBeLessThanOrEqual(2);
    expect(boxes.every(x=>x.scrollHeight<=x.clientHeight+2)).toBe(true);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});

test('existing hero Pay Tax and Travel Tax actions still open separate journeys', async ({ page }) => {
  await page.goto('/?action=landing&lang=en');

  await page.locator('.public-hero-carousel .citizen-public-primary.public-guest-action').first().click();
  const tax = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(tax).toBeVisible();
  await tax.getByRole('button', { name: 'Close payment services' }).click();

  await page.getByRole('button', { name: 'Other Tax', exact: true }).first().click();
  const otherAccess = page.getByRole('dialog', { name: 'Pay Tax' });
  await expect(otherAccess.locator('.taxpayer-login-dialog')).toBeVisible();
  await otherAccess.getByRole('button', { name: 'Walk-in Payment' }).click();
  await page.getByTestId('other-tax-chooser').getByRole('button', {name:/Travel Tax/}).click();
  const travel = page.getByRole('dialog', { name: /Travel tax/i });
  await expect(travel).toBeVisible();
  await travel.getByRole('button', { name: 'Close modal' }).click();
});

test('benefit cards adapt to tablet and keep Bengali mobile bottom navigation intact', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto('/?action=landing&lang=en');
  const benefits = page.locator('.public-benefits');
  const tablet = await benefits.locator('.public-benefits__item').evaluateAll(items =>
    items.map(item => {
      const rect = item.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    })
  );
  expect(tablet[0].y).toBe(tablet[1].y);
  expect(tablet[0].x).toBeLessThan(tablet[1].x);
  expect(tablet[2].y).toBeGreaterThan(tablet[0].y);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?action=landing&lang=bn');
  await expect(benefits.getByRole('heading', { name: 'সহজকর কেন ব্যবহার করবেন?' })).toBeVisible();
  await expect(benefits.locator('.public-benefits__item')).toHaveCount(6);
  const mobileSearch = page.locator('.public-record-discovery');
  const mobileSearchBox = await mobileSearch.boundingBox();
  const mobileBenefitsBox = await benefits.boundingBox();
  expect(mobileSearchBox).not.toBeNull();
  expect(mobileBenefitsBox).not.toBeNull();
  expect(mobileBenefitsBox!.y - (mobileSearchBox!.y + mobileSearchBox!.height)).toBeGreaterThanOrEqual(16);
  await expect(benefits.getByRole('heading', { name: 'আবার পরিশোধ' })).toBeVisible();
  await expect(benefits.locator('[data-benefit="certificates"] h3')).toHaveText('কর সনদ');
  await expect(benefits.locator('[data-benefit="saved-drafts"] h3')).toHaveText('সংরক্ষিত খসড়া');
  await expect(benefits.locator('[data-benefit="saved-drafts"] p')).toHaveText('পেমেন্ট খসড়া সংরক্ষণ করে পরে চালিয়ে যান।');
  await expect(benefits.locator('.public-benefits__heading p')).toHaveText('কর পরিশোধ, তথ্য গুছিয়ে রাখা ও অগ্রগতি দেখা—সব এক জায়গায়।');
  await expect(page.getByRole('navigation', { name: 'মোবাইল প্রধান নেভিগেশন' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'পেমেন্ট রেকর্ড খুঁজুন' })).toBeVisible();
  const mobile = await benefits.locator('.public-benefits__item').evaluateAll(items =>
    items.map(item => {
      const rect = item.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    })
  );
  expect(mobile[0].x).toBe(mobile[1].x);
  expect(mobile[1].y).toBeGreaterThan(mobile[0].y);
  const iconBounds = await benefits.locator('.public-benefits__item').first().locator('.public-benefits__icon').boundingBox();
  const copyBounds = await benefits.locator('.public-benefits__item').first().locator('.public-benefits__copy').boundingBox();
  expect(iconBounds).not.toBeNull();
  expect(copyBounds).not.toBeNull();
  expect(copyBounds!.x).toBeGreaterThan(iconBounds!.x + iconBounds!.width);
  const sizes = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(sizes.document - sizes.viewport).toBeLessThanOrEqual(2);
});


for (const { width, height, lang } of [
  { width: 1440, height: 900, lang: 'en' },
  { width: 1366, height: 768, lang: 'en' },
  { width: 1366, height: 768, lang: 'bn' },
  { width: 1024, height: 768, lang: 'en' },
]) {
  test(`public desktop landing fits one viewport ${width}×${height} (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`/?action=landing&lang=${lang}`);
    await page.evaluate(async () => { await document.fonts.ready; });
    const benefits = page.locator('.public-benefits');
    await expect(benefits.locator('.public-benefits__item')).toHaveCount(6);
    await expect(benefits.getByRole('heading', {
      name: lang === 'bn' ? 'সহজকর কেন ব্যবহার করবেন?' : 'Why choose Sohojkor?',
    })).toBeVisible();
    await expect(page.getByRole('heading', {
      name: lang === 'bn' ? 'পেমেন্ট রেকর্ড খুঁজুন' : 'Find a payment record',
    })).toBeVisible();
    const metrics = await page.evaluate(() => {
      const footer = document.querySelector('.public-footer')?.getBoundingClientRect();
      const benefit = document.querySelector('.public-benefits')?.getBoundingClientRect();
      const banner = document.querySelector('.public-hero-carousel')?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollHeight - window.innerHeight,
        footerBottom: footer?.bottom,
        benefitsBottom: benefit?.bottom,
        bannerHeight: banner?.height,
      };
    });
    expect(metrics.overflow).toBeLessThanOrEqual(2);
    expect(metrics.footerBottom).toBeLessThanOrEqual(height + 2);
    expect(metrics.benefitsBottom).toBeLessThan(height - 30);
    expect(metrics.bannerHeight).toBeGreaterThan(200);
    await expect(page.locator('.public-home-header')).toBeVisible();
  });
}

test('Home keeps only All Tax Payments actionable in English and Bengali', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'Cross-viewport parity is checked within this test.');
  for (const width of [320, 1280]) {
    await page.setViewportSize({width, height:900});
    for (const lang of ['en','bn'] as const) {
      await page.goto('/?action=landing&lang=' + lang);
      const cells = page.locator('.public-benefits__item');
      await expect(cells).toHaveCount(6);
      await expect(cells.first()).toHaveJSProperty('tagName','BUTTON');
      for(let i=1;i<6;i++) await expect(cells.nth(i)).toHaveJSProperty('tagName','ARTICLE');
      await expect(page.locator('.public-benefits__heading button')).toHaveCount(0);
      await cells.first().click();
      const modal = page.getByRole('dialog',{name:lang==='bn'?'কর পরিশোধ':'Pay Tax'});
      await expect(modal).toBeVisible();
      await modal.getByRole('button',{name:lang==='bn'?'ওয়াক-ইন পেমেন্ট':'Walk-in Payment'}).click();
      await expect(modal.getByRole('progressbar',{name:'Payment progress'})).toHaveAttribute('aria-valuemax','3');
      await modal.getByRole('button',{name:lang==='bn'?'কর পরিশোধের সেবা বন্ধ করুন':'Close payment services'}).click();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    }
  }
});

test('homepage reference entry does not claim a missing SQL record before session verification', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'This case explicitly exercises mobile and desktop states.');
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ['en', 'bn'] as const) {
      await page.goto(`/?action=landing&lang=${language}`);
      const reference = `UNVERIFIED-REFERENCE-${width}`;
      const landing = page.locator('.public-record-discovery');
      await landing.getByRole('searchbox').fill(reference);
      await landing.getByRole('button', { name: language === 'bn' ? 'রেকর্ড খুঁজুন' : 'Search records' }).click();
      const modal = page.getByRole('dialog', { name: language === 'bn' ? 'পেমেন্টের অবস্থা ও রসিদ' : 'Payment status & receipt' });
      await expect(modal).toBeVisible();
      await expect(modal.getByRole('textbox', { name: language === 'bn'
        ? 'চালান, টোকেন বা লেনদেনের রেফারেন্স' : 'Challan, token or transaction reference' }))
        .toHaveValue(reference);
      await expect(modal.getByTestId('receipt-mobile-required')).toBeVisible();
      await expect(modal.getByRole('heading', { name: language === 'bn' ? 'কোনো মিল পাওয়া যায়নি' : 'No matching record' })).toHaveCount(0);
      await modal.getByRole('button', { name: language === 'bn' ? 'রেকর্ড খুঁজুন' : 'Search records' }).click();
      await expect(modal.getByTestId('receipt-mobile-required')).toBeVisible();
      await expect(modal.locator('.receipt-view')).toHaveCount(0);
    }
  }
});

test('homepage lookup labels example-only matches and preserves focus in EN/BN at 320px, 375px and 1280px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'This case covers both target widths in one browser.');
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const lang of ['en', 'bn'] as const) {
      await page.goto(`/?action=landing&lang=${lang}`);
      const section = page.locator('.public-record-discovery');
      const search = section.getByRole('searchbox');
      // Prevent the integration merge from duplicating the one live status region.
      await expect(section.getByTestId('public-search-match-status')).toHaveCount(1);
      await expect(section.getByTestId('public-search-match-status')).toBeEmpty();
      await expect(section.locator('#public-record-suggestions')).toHaveCount(0);
      await search.focus();
      await expect(section.locator('#public-record-suggestions')).toHaveCount(1);
      if (width === 1280 && lang === 'en') {
        const firstExample = (await section.locator('.public-record-suggestions__examples')
          .locator('.public-record-suggestions__value').first().innerText()).trim();
        await search.fill(firstExample);
        const matched = section.locator('.public-record-suggestions__group').first();
        await expect(matched.locator('.public-record-suggestions__value')
          .filter({ hasText: firstExample })).toHaveCount(1);
        await expect(section.locator('.public-record-suggestions__examples')
          .locator('.public-record-suggestions__value').filter({ hasText: firstExample })).toHaveCount(0);
        await matched.locator('.public-record-suggestions__option').first().click();
        const verification = page.getByRole('dialog', { name: 'Payment status & receipt' });
        await expect(verification).toBeVisible();
        // Selecting a saved example opens its locally permitted receipt directly.
        // The input is deliberately hidden while its matching receipt is shown.
        const matchedReceipt = verification.locator('.receipt-view');
        await expect(matchedReceipt).toBeVisible();
        await expect(matchedReceipt).toContainText(firstExample);
        await page.goto('/?action=landing&lang=en');
        await section.getByRole('searchbox').focus();
      }
      await expect(search).toHaveAttribute('aria-autocomplete', 'list');
      await expect(search).toHaveAttribute('aria-describedby', 'public-record-discovery-help');
      await search.fill('NOT-A-KNOWN-EXAMPLE');
      await expect(section.getByTestId('public-search-match-status')).toContainText(lang === 'bn'
        ? 'কোনো নমুনা রেফারেন্স মেলেনি'
        : 'No example references matched');
      await expect(section.locator('.public-record-suggestions__empty')).toContainText(lang === 'bn'
        ? 'নমুনার মধ্যে মিলে যাওয়া রেফারেন্স নেই'
        : 'No matching references among the examples');
      await search.press('ArrowDown');
      await expect(section.locator('#public-search-option-0')).toHaveClass(/is-active/);
      await search.press('Escape');
      await expect(search).toBeFocused();
      await expect(section.locator('#public-search-option-0')).toHaveCount(0);
      await expect(section.locator('#public-record-suggestions')).toHaveCount(0);
      await expect(section.getByTestId('public-search-match-status')).toBeEmpty();
      await search.fill('NOT-A-KNOWN-EXAMPLE');
      await section.getByRole('button', { name: lang === 'bn' ? 'রেকর্ড খুঁজুন' : 'Search records' }).click();
      await expect(page.getByTestId('receipt-mobile-required')).toBeVisible();
      await expect(page.locator('.receipt-view')).toHaveCount(0);
    }
  }
});

test('public reference no-match distinguishes browser session lookup from official records in EN/BN', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'One desktop project covers EN/BN at narrow and wide breakpoints.');
  await page.route(/\/functions\/v1\/demo-story1-taxpay\/payments\?/, async route => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, simulationOnly: true, data: { items: [], total: 0 } }) });
  });
  for (const width of [320, 1280]) {
    await page.setViewportSize({width,height:860});
    for (const language of ['en','bn'] as const) {
      await page.goto('/?action=landing&lang=' + language);
      const search=page.locator('.public-record-discovery');
      await search.getByRole('searchbox').fill('UNLINKED-TEST-REFERENCE');
      await search.getByRole('button', {name: language === 'bn' ? 'রেকর্ড খুঁজুন' : 'Search records'}).click();
      const dialog=page.getByRole('dialog', {name: language === 'bn' ? 'পেমেন্টের অবস্থা ও রসিদ' : 'Payment status & receipt'});
      await expect(dialog).toBeVisible();
      await dialog.locator('#receipt-lookup-mobile').fill('01700000000');
      await dialog.getByRole('button', {name: language === 'bn' ? 'রেকর্ড খুঁজুন' : 'Search records'}).click();
      await expect(dialog.getByTestId('receipt-session-only-notice')).toContainText(
        language === 'bn' ? 'সরকারি পেমেন্ট রেকর্ড আছে কি না' : 'does not confirm whether an official payment record exists');
      await expect(dialog.locator('.receipt-view')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    }
  }
});

test('1920px desktop Home fills the viewport with balanced sections and fixed footer', async ({ page }) => {
  for (const viewport of [
    { width: 1775, height: 864 },
    { width: 1920, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    for (const lang of ['en', 'bn']) {
      await page.setViewportSize(viewport);
      await page.goto('/?action=landing&lang=' + lang);
      await page.evaluate(async () => { await document.fonts.ready; });
      const geometry = await page.evaluate(() => {
        const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
        const cells = [...document.querySelectorAll('.public-benefits__item')].map(el => ({
          top: el.getBoundingClientRect().top,
          height: el.getBoundingClientRect().height,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }));
        const header = rect('.public-home-header');
        const hero = rect('.public-hero-carousel');
        const search = rect('.public-record-discovery');
        const benefits = rect('.public-benefits');
        const footer = rect('.public-footer');
        return {
          headerBottom: header.bottom,
          heroTop: hero.top,
          heroHeight: hero.height,
          heroWidth: hero.width,
          searchWidth: search.width,
          benefitsWidth: benefits.width,
          footerTop: footer.top,
          footerBottom: footer.bottom,
          gapBelowBenefits: footer.top - benefits.bottom,
          searchGap: search.top - hero.bottom,
          benefitsGap: benefits.top - search.bottom,
          documentHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          cells,
        };
      });
      expect(geometry.heroWidth, JSON.stringify({viewport, lang, geometry})).toBeGreaterThanOrEqual(1099);
      expect(geometry.heroWidth).toBeLessThanOrEqual(1101);
      expect(Math.abs(geometry.heroWidth - geometry.searchWidth)).toBeLessThanOrEqual(2);
      expect(Math.abs(geometry.heroWidth - geometry.benefitsWidth)).toBeLessThanOrEqual(2);
      expect(geometry.headerBottom).toBeLessThan(geometry.heroTop);
      expect(geometry.heroHeight).toBeGreaterThanOrEqual(210);
      expect(geometry.searchGap).toBeGreaterThanOrEqual(12);
      expect(geometry.searchGap).toBeLessThanOrEqual(24);
      expect(geometry.benefitsGap).toBeGreaterThanOrEqual(12);
      expect(geometry.benefitsGap).toBeLessThanOrEqual(24);
      expect(geometry.gapBelowBenefits).toBeGreaterThanOrEqual(0);
      expect(geometry.gapBelowBenefits).toBeLessThanOrEqual(32);
      expect(geometry.footerTop).toBeGreaterThan(geometry.headerBottom);
      expect(Math.abs(geometry.footerBottom - viewport.height)).toBeLessThanOrEqual(2);
      expect(geometry.documentHeight - geometry.viewportHeight).toBeLessThanOrEqual(2);
      expect(geometry.overflowX).toBeLessThanOrEqual(2);
      expect(geometry.cells).toHaveLength(6);
      expect(Math.max(...geometry.cells.map(c=>c.height)) - Math.min(...geometry.cells.map(c=>c.height))).toBeLessThanOrEqual(2);
      expect(geometry.cells.every(c=>c.scrollHeight <= c.clientHeight + 2)).toBe(true);
      await expect(page.getByRole('searchbox', {name: lang==='bn'
        ? 'রেফারেন্স দিয়ে পেমেন্ট রেকর্ড খুঁজুন' : 'Search payment records by reference'})).toBeVisible();
      await expect(page.locator('.public-hero-carousel__slide')).toHaveCount(5);
    }
  }
});



test('parallel taxpayer entry preserves real tax heads and allocations through approved payment wizard', async ({page}, info) => {
  test.skip(true, 'Superseded by the approved unified All Tax Payments entry; the parallel Home CTA was removed.');
  test.skip(info.project.name !== 'desktop-1280', 'Focused review at mobile and desktop widths.');
  for (const width of [375, 1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/?action=landing&lang=en');
    await page.evaluate(() => sessionStorage.clear());
    await page.getByRole('button', {name:'Open parallel taxpayer entry'}).click();
    const draft = page.getByRole('dialog', {name:'All Tax Payments — parallel draft'});
    await expect(draft.getByTestId('parallel-taxpayer-empty')).toBeVisible();
    await expect(draft.getByTestId('parallel-taxpayer-empty')).toHaveCSS('border-top-width', '1px');
    // The icon and title must be centered as a group on both axes at either viewport.
    const emptyAlignment = await draft.getByTestId('parallel-taxpayer-empty').evaluate(element => {
      const icon = element.querySelector('svg');
      const title = element.querySelector('strong');
      if (!icon || !title) return null;
      const box = element.getBoundingClientRect();
      const iconBox = icon.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      return {
        horizontal: Math.abs((titleBox.left + titleBox.right) / 2 - (box.left + box.right) / 2),
        vertical: Math.abs((iconBox.top + titleBox.bottom) / 2 - (box.top + box.bottom) / 2),
        width: box.width,
      };
    });
    expect(emptyAlignment).not.toBeNull();
    expect(emptyAlignment!.horizontal).toBeLessThanOrEqual(3);
    expect(emptyAlignment!.vertical).toBeLessThanOrEqual(3);
    expect(emptyAlignment!.width).toBeGreaterThan(200);
    await expect(draft.getByTestId('parallel-taxpayer-continue')).toBeDisabled();
    await expect(draft.locator('.parallel-taxpayer-draft__disclaimer')).toHaveCount(0);
    const searchFor = async (tin:string) => {
      await draft.locator('#parallel-taxpayer-tin').fill(tin);
      await draft.getByRole('button', {name:'Search taxpayer TIN'}).click();
    };
    await searchFor('111111111111');
    await expect(draft.getByTestId('parallel-taxpayer-search-result')).toContainText('User 1');
    await expect(draft.getByTestId('parallel-taxpayer-search-result')).toHaveCSS('border-top-style', 'solid');
    await expect(draft.getByTestId('parallel-taxpayer-search-result')).toHaveCSS('border-left-width', '1px');
    await expect(draft.getByTestId('parallel-taxpayer-search-result')).toHaveCSS('border-bottom-width', '1px');
    await draft.getByTestId('parallel-add-taxpayer').click();
    await expect(draft.locator('#parallel-taxpayer-tin')).toBeFocused();
    await expect(draft.getByRole('table').locator('tbody tr')).toHaveCount(1);
    const selectedTable = draft.locator('.parallel-taxpayer-draft__panel .parallel-taxpayer-draft__table');
    if (width === 1280) {
      await expect(selectedTable.locator('thead th').first()).toHaveCSS('border-top-width', '1px');
      await expect(selectedTable.locator('tbody td').first()).toHaveCSS('border-left-width', '1px');
      await expect(selectedTable.locator('tbody td').first()).toHaveCSS('border-top-left-radius', '11px');
      await expect(selectedTable.locator('tbody td').first()).toHaveCSS('vertical-align', 'middle');
    } else {
      await expect(selectedTable.locator('tbody tr').first()).toHaveCSS('border-top-width', '1px');
      await expect(selectedTable.locator('tbody tr').first()).toHaveCSS('border-radius', '11px');
      await expect(selectedTable.locator('tbody tr').first()).toHaveCSS('align-items', 'center');
    }
    // Parallel list is intentionally reveal-only; no Copy action exists.
    await expect(draft.getByRole('button', {name:'Copy TIN'})).toHaveCount(0);
    await expect(draft.getByRole('button', {name:'Reveal TIN: User 1'})).toHaveCount(1);
    const sections = draft.locator('.parallel-taxpayer-draft__panel');
    const bodyBox = await draft.locator('.taxpay-modal__body').boundingBox();
    const rightBox = await sections.nth(1).boundingBox();
    expect(bodyBox).not.toBeNull();
    expect(rightBox).not.toBeNull();
    if (bodyBox && rightBox && width === 1280) {
      expect(await sections.nth(1).evaluate(node => getComputedStyle(node).borderLeftWidth)).toBe('1px');
      // Unbroken center divider reaches both modal body edges;
      // search instructions stay within the left pane without any note.
      expect(Math.abs(rightBox.y - bodyBox.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(rightBox.y + rightBox.height - bodyBox.y - bodyBox.height)).toBeLessThanOrEqual(2);
      await expect(sections.first().locator('.parallel-taxpayer-draft__intro')).toBeVisible();
      await expect(sections.first().locator('.parallel-taxpayer-draft__disclaimer')).toHaveCount(0);
    } else if (bodyBox && rightBox) {
      expect(await sections.nth(1).evaluate(node => getComputedStyle(node).borderTopWidth)).toBe('1px');
      expect(Math.abs(rightBox.x - bodyBox.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(rightBox.width - bodyBox.width)).toBeLessThanOrEqual(2);
    }
    await draft.locator('#parallel-taxpayer-tin').fill('111111111111');
    await draft.locator('#parallel-taxpayer-tin').press('Enter');
    await expect(draft.getByTestId('parallel-add-taxpayer')).toBeDisabled();
    await searchFor('222222222222');
    await draft.getByTestId('parallel-add-taxpayer').click();
    await draft.getByRole('button', {name:'Remove taxpayer: User 1'}).click();
    await expect(draft.getByRole('button', {name:'Undo remove taxpayer'})).toBeVisible();
    await draft.getByRole('button', {name:'Undo remove taxpayer'}).click();
    await expect(draft.getByRole('table').locator('tbody tr')).toHaveCount(2);
    await draft.getByTestId('parallel-taxpayer-continue').click();
    let heads = draft.getByTestId('parallel-tax-head-boundary');
    await expect(heads.getByTestId('other-tax-batch')).toBeVisible();
    // Taxpayer navigation appears for two taxpayers, and only masked TINs are exposed.
    const taxpayerTabs = heads.locator('.other-tax-taxpayer-chip');
    await expect(taxpayerTabs).toHaveCount(2);
    await expect(taxpayerTabs.nth(1)).toHaveAttribute('title', /222\*\*\*\*/);
    await expect(taxpayerTabs.nth(1)).not.toHaveAttribute('title', /222222222222/);
    // Returning to one taxpayer correctly hides multi-taxpayer tabs.
    await draft.locator('.parallel-taxpayer-draft__secondary').click();
    await draft.getByRole('button', {name:'Remove taxpayer: User 1'}).click();
    await expect(draft.getByRole('table').locator('tbody tr')).toHaveCount(1);
    await draft.getByTestId('parallel-taxpayer-continue').click();
    heads = draft.getByTestId('parallel-tax-head-boundary');
    await expect(heads.getByTestId('other-tax-batch')).toBeVisible();
    await expect(heads.locator('.other-tax-taxpayer-chip')).toHaveCount(0);
    // A known eligible v11 head; do not introduce a parallel head catalogue.
    await heads.locator('[data-head-group="Advance Tax"] > summary').click();
    await heads.getByRole('checkbox', {name:/Select 64 —/}).check();
    await heads.getByTestId('other-tax-line').first().locator('input[id^="other-tax-amount"]').fill('250.50');
    await draft.getByTestId('parallel-tax-head-continue').click();
    await expect(draft.getByTestId('parallel-allocation-review')).toContainText('250.50');
    await draft.getByTestId('parallel-payment-handoff').click();
    await expect(draft).toHaveCount(0);
    const payment = page.getByRole('dialog', {name:'Pay Tax'});
    await expect(payment).toBeVisible();
    // The ordinary payer/receipt verification step has not been bypassed.
    await expect(payment.locator('#guest-payer-name')).toBeVisible();
    await payment.locator('#guest-payer-name').fill('Reviewed Payer');
    await payment.locator('#guest-phone').fill('01712345678');
    await payment.getByRole('button', {name:'Continue to purpose & amount'}).click();
    await expect(payment.getByTestId('other-tax-batch')).toBeVisible();
    await expect(payment.getByTestId('other-tax-line')).toHaveCount(1);
    await expect(payment.getByTestId('other-tax-line').first()
      .locator('input[id^="other-tax-amount"]')).toHaveValue('250.50');
    await payment.getByRole('button', {name:'Close payment services'}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  }
});

test('parallel taxpayer session draft restores after close and refresh without creating beneficiaries', async ({page}, info) => {
  test.skip(true, 'Superseded by the approved unified All Tax Payments entry; the parallel Home CTA was removed.');
  test.skip(info.project.name !== 'desktop-1280', 'Focused same-tab recovery check.');
  await page.goto('/?action=landing&lang=en');
  await page.evaluate(()=>sessionStorage.clear());
  await page.getByRole('button',{name:'Open parallel taxpayer entry'}).click();
  let draft=page.getByRole('dialog',{name:'All Tax Payments — parallel draft'});
  await draft.locator('#parallel-taxpayer-tin').fill('333333333333');
  await draft.getByRole('button',{name:'Search taxpayer TIN'}).click();
  await draft.getByTestId('parallel-add-taxpayer').click();
  await draft.getByRole('button',{name:'Close parallel draft'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Open parallel taxpayer entry'}).click();
  draft=page.getByRole('dialog',{name:'All Tax Payments — parallel draft'});
  await expect(draft.locator('.parallel-taxpayer-draft__table tbody tr')).toHaveCount(1);
  await expect(draft).toContainText('Selection restored.');
  await draft.locator('#parallel-taxpayer-tin').fill('12');
  await expect(draft).not.toContainText('Selection restored.');
  await draft.getByRole('button',{name:'Close parallel draft'}).click();
});
