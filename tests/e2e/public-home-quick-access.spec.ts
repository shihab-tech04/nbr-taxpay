import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('compact desktop homepage keeps six balanced benefit destinations', async ({ page }) => {
  // This 3x2 parity test intentionally uses the compact desktop breakpoint.
  // The same 3x2 layout remains consistent at wider desktop sizes.
  await page.setViewportSize({ width: 1140, height: 900 });
  await page.goto('/?action=landing&lang=en');

  const benefits = page.locator('.public-benefits');
  await expect(benefits.getByRole('heading', { name: 'Why choose Sohojkor?' })).toBeVisible();
  await expect(benefits.locator('.public-benefits__heading p')).toHaveText('Pay, organize and track your taxes in one place.');
  await expect(benefits.locator('.public-benefits__item')).toHaveCount(6);
  const expectedCards = [
    ['payments', 'All Tax Payments', 'Pay taxes for yourself, family or clients.'],
    ['certificates', 'Tax Certificates', 'Find and download available tax certificates.'],
    ['corrections', 'Corrections & Requests', 'Request corrections and follow their progress.'],
    ['history', 'Payment History', 'See past payments, tax years and receipts.'],
    ['pay-again', 'Pay Again', 'Reuse and edit a previous payment.'],
    ['saved-drafts', 'Saved Drafts', 'Save a payment and continue it later.'],
  ] as const;
  for (const [index, [id, heading, description]] of expectedCards.entries()) {
    const card = benefits.locator('.public-benefits__item').nth(index);
    await expect(card).toHaveAttribute('data-benefit', id);
    await expect(card.getByRole('heading', { name: heading })).toBeVisible();
    await expect(card.locator('p')).toHaveText(description);
    const control = id === 'payments'
      ? card.getByRole('button', { name: heading })
      : card.getByRole('link', { name: heading });
    await expect(control).toHaveAttribute('aria-describedby', `public-benefit-detail-${id}`);
    const destination: Record<string, string> = {
      certificates: 'certificates',
      corrections: 'corrections',
      history: 'history',
      'pay-again': 'history',
      'saved-drafts': 'taxpayer_home',
    };
    if (id !== 'payments') await expect(control).toHaveAttribute('href', `?action=${destination[id]}`);
    await expect(card.locator('svg')).toHaveCount(1);
    await expect(card.locator('p')).toHaveCSS('font-size', '14px');
  }
  await expect(benefits.getByRole('button')).toHaveCount(1);
  await expect(benefits.getByRole('link')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Find a payment record' })).toBeVisible();

  const positions = await benefits.locator('.public-benefits__item').evaluateAll(items =>
    items.map(item => {
      const rect = item.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    })
  );
  expect(positions[0].y).toBe(positions[1].y);
  expect(positions[1].y).toBe(positions[2].y);
  expect(positions[0].x).toBeLessThan(positions[1].x);
  expect(positions[1].x).toBeLessThan(positions[2].x);
  expect(positions[3].y).toBeGreaterThan(positions[0].y);
  expect(positions[3].x).toBe(positions[0].x);
  const heights = await benefits.locator('.public-benefits__item').evaluateAll(items =>
    items.map(item => item.getBoundingClientRect().height)
  );
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2);
  expect(Math.max(...heights)).toBeLessThanOrEqual(145);

  for (const card of await benefits.locator('.public-benefits__item').all()) {
    const icon = card.locator('.public-benefits__icon');
    const copy = card.locator('.public-benefits__copy');
    await expect(card).toHaveCSS('display', 'grid');
    const iconBox = await icon.boundingBox();
    const copyBox = await copy.boundingBox();
    expect(iconBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(copyBox!.x).toBeGreaterThan(iconBox!.x + iconBox!.width + 6);
    expect(Math.abs((iconBox!.y + iconBox!.height / 2) - (copyBox!.y + copyBox!.height / 2))).toBeLessThanOrEqual(2);
  }
});

test('desktop restores full-width lookup and proposed connected six-cell benefits panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?action=landing&lang=en');
  await page.evaluate(async () => { await document.fonts.ready; });

  const layout = await page.evaluate(() => {
    const bounds = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
    };
    const rect = (s: string) => bounds(document.querySelector(s)!);
    const style = (s: string) => getComputedStyle(document.querySelector(s)!);
    const cardNodes = [...document.querySelectorAll('.public-benefits__item')];
    const cards = cardNodes.map(bounds);
    return {
      search: rect('.public-record-discovery'),
      heading: rect('.public-record-discovery__heading'),
      input: rect('.public-record-search'),
      headings: [
        Number(style('.public-record-discovery__heading h2').fontWeight),
        Number(style('.public-benefits__heading h2').fontWeight),
        Number(style('.public-benefits__copy h3').fontWeight),
      ],
      descriptions: [
        parseFloat(style('.public-record-discovery__heading p').fontSize),
        parseFloat(style('.public-benefits__copy p').fontSize),
        parseFloat(style('.public-footer__bottom p').fontSize),
      ],
      cardBackground: style('.public-benefits__item').backgroundColor,
      cardRadius: parseFloat(style('.public-benefits__item').borderTopLeftRadius),
      cardBorderWidth: parseFloat(style('.public-benefits__item').borderLeftWidth),
      panelBackground: style('.public-benefits').backgroundColor,
      panelRadius: parseFloat(style('.public-benefits').borderTopLeftRadius),
      gridGap: parseFloat(style('.public-benefits__grid').columnGap),
      rowGap: parseFloat(style('.public-benefits__grid').rowGap),
      gridPadding: parseFloat(style('.public-benefits__grid').paddingTop),
      panelToGridInset: rect('.public-benefits__grid').left - rect('.public-benefits').left,
      firstCard: cards[0],
      secondCard: cards[1],
      sectionBottom: rect('.public-benefits').bottom,
      footerTop: rect('.public-footer').top,
      scrollOverflow: document.documentElement.scrollHeight - window.innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(layout.heading.bottom).toBeLessThan(layout.input.top);
  expect(layout.input.width).toBeGreaterThanOrEqual(layout.search.width * .9);
  expect(layout.headings.every(weight => weight <= 600)).toBe(true);
  expect(layout.descriptions.every(size => size >= 14)).toBe(true);
  expect(layout.panelRadius).toBeGreaterThanOrEqual(14);
  // On 821–959px-tall desktops, the approved connected panel retains a compact 16px inset.
  expect(layout.panelToGridInset).toBeGreaterThanOrEqual(16);
  expect(layout.panelBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(layout.cardRadius).toBe(0);
  expect(layout.cardBorderWidth).toBe(0);
  expect(layout.gridGap).toBeGreaterThanOrEqual(.9);
  expect(layout.gridGap).toBeLessThanOrEqual(1.1);
  expect(layout.rowGap).toBeGreaterThanOrEqual(.9);
  expect(layout.rowGap).toBeLessThanOrEqual(1.1);
  expect(layout.gridPadding).toBe(1);
  expect(Math.abs(layout.secondCard.left - layout.firstCard.right - 1)).toBeLessThanOrEqual(1);
  expect(layout.cardBackground).toBe(layout.panelBackground);
  expect(layout.scrollOverflow).toBeLessThanOrEqual(2);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(2);
  expect(layout.footerTop - layout.sectionBottom).toBeLessThanOrEqual(110);
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
      footerCollision,
      scrollOverflow:document.documentElement.scrollHeight-window.innerHeight,
      horizontalOverflow:document.documentElement.scrollWidth-window.innerWidth,
    };
  });
  // The Home canvas keeps the same original 1100px width as Guide and Report.
  expect(visual.hero.width).toBeGreaterThanOrEqual(1099);
  expect(visual.hero.width).toBeLessThanOrEqual(1101);
  expect(Math.abs(visual.hero.width-visual.record.width)).toBeLessThanOrEqual(2);
  expect(visual.searchHeading.bottom).toBeLessThan(visual.searchField.top);
  expect(visual.searchField.width).toBeGreaterThanOrEqual(visual.record.width*.9);
  // Six balanced benefit cards should retain adequate height at wide viewport sizes.
  // Medium-height desktops use 88px cells to preserve the no-overflow layout.
  expect(visual.firstCard.height).toBeGreaterThanOrEqual(88);
  // Two-line tagline is acceptable; footer links must never touch or overlap.
  expect(visual.footerTagline.height).toBeLessThanOrEqual(44);
  expect(visual.footerLinkCount).toBe(4);
  expect(visual.footerCollision).toBe(false);
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
          footerOverflow:boxes.some((r,i) => overlap(r,identity) || overlap(r,copyright) ||
            boxes.some((other,j)=>i!==j && overlap(r,other))),
          linkGap:boxes.slice(1).flatMap((r,i)=>
            Math.abs(r.top-boxes[i].top)<=2 ? [r.left-boxes[i].right] : []),
          horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
        };
      });
      expect(layout.homeWidth,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(1099);
      expect(layout.homeWidth).toBeLessThanOrEqual(1101);
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
      expect(layout.contentWidth,JSON.stringify({viewport,lang,layout})).toBeGreaterThanOrEqual(1099);
      expect(layout.contentWidth).toBeLessThanOrEqual(1101);
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
    expect(measurements.fontSizes).toEqual(['16px', '20px', '14px', '14px']);
    expect(measurements.documentHeightOverflow).toBeLessThanOrEqual(2);
    expect(measurements.documentWidthOverflow).toBeLessThanOrEqual(2);
  }
});

test('approved payment-record lookup keeps the compact reference composition', async ({ page }) => {
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
  expect(layout.panelHeight).toBeLessThanOrEqual(128);
  expect(layout.panelRadius).toBeGreaterThanOrEqual(11);
  expect(layout.panelRadius).toBeLessThanOrEqual(13);
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
    {height:959,padLeft:16,padTop:10,padBottom:11},
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
      expect(metrics.searchHeight).toBeLessThanOrEqual(158);
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
      // The agreed maximum is 1100px; a narrower viewport retains 32px
      // horizontal gutters rather than overflowing to satisfy the max width.
      const expectedPanelWidth=Math.min(1100,viewport.width-64);
      expect(Math.abs(measurement.panelWidth-expectedPanelWidth),
        JSON.stringify({viewport,lang,measurement})).toBeLessThanOrEqual(2);
      expect(measurement.panelRadius).toBeGreaterThanOrEqual(14);
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
      expect(c.every(x => x.radius === '0px' && x.border === '0px' &&
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
      expect(result.homeWidth).toBeGreaterThanOrEqual(1099);
      expect(result.homeWidth).toBeLessThanOrEqual(1101);
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

  await page.getByRole('button', { name: 'Pay Travel Tax', exact: true }).first().click();
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

test('six benefit destinations work by pointer and keyboard in English and Bangla on mobile and desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'The test covers its own explicit mobile and desktop viewports.');
  const cases = [
    { id: 'payments', en: 'All Tax Payments', bn: 'সব ধরনের কর পরিশোধ', destination: 'pay-choice' },
    { id: 'certificates', en: 'Tax Certificates', bn: 'কর সনদ', destination: 'certificates' },
    { id: 'corrections', en: 'Corrections & Requests', bn: 'সংশোধন ও আবেদন', destination: 'corrections' },
    { id: 'history', en: 'Payment History', bn: 'পেমেন্টের ইতিহাস', destination: 'history' },
    { id: 'pay-again', en: 'Pay Again', bn: 'আবার পরিশোধ', destination: 'history' },
    { id: 'saved-drafts', en: 'Saved Drafts', bn: 'সংরক্ষিত খসড়া', destination: 'taxpayer_home' },
  ] as const;
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ['en', 'bn'] as const) {
      await page.goto(`/?action=landing&lang=${language}`);
      const benefits = page.locator('.public-benefits');
      await expect(benefits.locator('.public-benefits__grid')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);

      for (const item of cases) {
        const card = benefits.locator(`[data-benefit="${item.id}"]`);
        const label = item[language];
        const box = await card.boundingBox();
        if (!box) throw new Error(`Missing benefit card: ${item.id}`);
        if (item.id === 'payments') {
          await card.click({ position: { x: box.width - 6, y: box.height - 6 } });
          await expect(page.locator('.tax-service-choice__card')).toHaveCount(2);
        } else {
          const control = card.getByRole('link', { name: label });
          if (item.id === 'certificates' && width === 320 && language === 'bn') {
            await control.focus();
            await expect(control).toBeFocused();
            await page.keyboard.press('Enter');
          } else {
            await card.click({ position: { x: box.width - 6, y: box.height - 6 } });
          }
          await expect(page).toHaveURL(new RegExp(`[?&]action=${item.destination}(?:&|$)`));
        }
      }
    }
  }
});
