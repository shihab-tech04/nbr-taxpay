import { expect, test } from '@playwright/test';

test('public homepage explains six citizen benefits without duplicate CTAs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?action=landing&lang=en');

  const benefits = page.locator('.public-benefits');
  await expect(benefits.getByRole('heading', { name: 'Why choose Sohojkor?' })).toBeVisible();
  await expect(benefits.locator('.public-benefits__heading p')).toHaveText('Pay, organize and track your taxes in one place.');
  await expect(benefits.locator('.public-benefits__item')).toHaveCount(6);
  const expectedCards = [
    ['payments', 'All Tax Payments', 'Pay taxes for yourself, family or clients.'],
    ['corrections', 'Corrections & Requests', 'Request corrections and follow their progress.'],
    ['certificates', 'Tax Certificates', 'Find and download available tax certificates.'],
    ['history', 'Payment History', 'See past payments, tax years and receipts.'],
    ['beneficiaries', 'Beneficiary Management', 'Keep people and their payment records organized.'],
    ['repeat-drafts', 'Pay Again & Saved Drafts', 'Reuse a payment or resume a saved draft.'],
  ] as const;
  for (const [index, [id, heading, description]] of expectedCards.entries()) {
    const card = benefits.locator('.public-benefits__item').nth(index);
    await expect(card).toHaveAttribute('data-benefit', id);
    await expect(card.getByRole('heading', { name: heading })).toBeVisible();
    await expect(card.locator('p')).toHaveText(description);
    await expect(card.locator('svg')).toHaveCount(1);
    await expect(card.locator('p')).toHaveCSS('font-size', '14px');
  }
  await expect(benefits.getByRole('button')).toHaveCount(0);
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

test('desktop restores the approved full-width lookup and six distinct, legible benefit cards', async ({ page }) => {
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
      gridGap: parseFloat(style('.public-benefits__grid').columnGap),
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
  expect(layout.cardRadius).toBeGreaterThanOrEqual(10);
  expect(layout.gridGap).toBeGreaterThanOrEqual(8);
  expect(layout.firstCard.right + 8).toBeLessThanOrEqual(layout.secondCard.left);
  expect(layout.cardBackground).not.toBe('rgba(0, 0, 0, 0)');
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
    return {
      hero:box('.public-hero-carousel'),
      record:box('.public-record-discovery'),
      benefits:box('.public-benefits'),
      footer:box('.public-footer'),
      footerTagline:box('.public-footer__identity p'),
      searchHeading:box('.public-record-discovery__heading'),
      searchField:box('.public-record-search'),
      firstCard:box('.public-benefits__item'),
      footerGaps:footerLinks.slice(1).map((link,index)=>link.left-footerLinks[index].right),
      scrollOverflow:document.documentElement.scrollHeight-window.innerHeight,
      horizontalOverflow:document.documentElement.scrollWidth-window.innerWidth,
    };
  });
  // At the supplied 1775px reference size the old ~1020px island is not approved.
  expect(visual.hero.width).toBeGreaterThanOrEqual(1200);
  expect(visual.hero.width).toBeLessThan(1380);
  expect(Math.abs(visual.hero.width-visual.record.width)).toBeLessThanOrEqual(2);
  expect(visual.searchHeading.bottom).toBeLessThan(visual.searchField.top);
  expect(visual.searchField.width).toBeGreaterThanOrEqual(visual.record.width*.9);
  // This wide viewport intentionally uses an asymmetric 3-row bento, not 6 identical tiles.
  expect(visual.firstCard.height).toBeGreaterThanOrEqual(60);
  // The footer tagline should not collapse into the three-line column seen
  // in the live screenshot, and its navigation links should not run together.
  expect(visual.footerTagline.height).toBeLessThanOrEqual(24);
  expect(visual.footerGaps.length).toBeGreaterThanOrEqual(3);
  expect(visual.footerGaps.every(gap=>gap>=10)).toBe(true);
  expect(visual.footer.top-visual.benefits.bottom).toBeLessThanOrEqual(48);
  expect(visual.scrollOverflow).toBeLessThanOrEqual(2);
  expect(visual.horizontalOverflow).toBeLessThanOrEqual(2);
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

test('benefits bento appears at the actual 1310px desktop screenshot size in EN and BN', async ({ page }) => {
  for (const viewport of [
    { width: 1200, height: 900 },
    { width: 1310, height: 924 },
  ]) {
    for (const lang of ['en', 'bn']) {
      await page.setViewportSize(viewport);
      await page.goto('/?action=landing&lang=' + lang);
      await page.evaluate(async () => { await document.fonts.ready; });

      const cards = page.locator('.public-benefits__item');
      const highlights = page.locator('.public-benefits__highlights');
      await expect(cards).toHaveCount(6);
      await expect(highlights).toHaveCount(2);
      await expect(highlights.first()).toBeVisible();
      await expect(highlights.last()).toBeVisible();
      await expect(page.locator('.public-benefits__preview')).toHaveCount(0);

      const result = await page.evaluate(() => {
        const box = (selector:string) => {
          const r=document.querySelector(selector)!.getBoundingClientRect();
          return { x:r.x, y:r.y, width:r.width, height:r.height };
        };
        return {
          gridColumns:getComputedStyle(document.querySelector('.public-benefits__grid')!).gridTemplateColumns.trim().split(' ').filter(Boolean).length,
          payments:box('.public-benefits__item[data-benefit="payments"]'),
          corrections:box('.public-benefits__item[data-benefit="corrections"]'),
          certificates:box('.public-benefits__item[data-benefit="certificates"]'),
          repeat:box('.public-benefits__item[data-benefit="repeat-drafts"]'),
          search:box('.public-record-discovery'),
          overflowY:document.documentElement.scrollHeight-innerHeight,
          overflowX:document.documentElement.scrollWidth-innerWidth,
        };
      });
      expect(result.gridColumns, JSON.stringify({viewport, lang, result})).toBe(4);
      expect(result.payments.x).toBeLessThan(result.corrections.x);
      expect(result.corrections.x).toBeLessThan(result.certificates.x);
      expect(result.certificates.x).toBeLessThan(result.repeat.x);
      expect(result.payments.height).toBeGreaterThan(result.corrections.height * 1.8);
      expect(result.repeat.height).toBeGreaterThan(result.certificates.height * 1.8);
      expect(result.search.width).toBeGreaterThanOrEqual(1090);
      expect(result.overflowY, JSON.stringify({viewport, lang, result})).toBeLessThanOrEqual(2);
      expect(result.overflowX).toBeLessThanOrEqual(2);
    }
  }

  // Short desktop keeps the approved compact 3x2 rather than overflowing.
  await page.setViewportSize({width:1310,height:768});
  await page.goto('/?action=landing&lang=en');
  const compact = await page.locator('.public-benefits__grid').evaluate(el =>
    getComputedStyle(el).gridTemplateColumns.trim().split(/\\s+/).length
  );
  expect(compact).toBe(3);
  await expect(page.locator('.public-benefits__highlights').first()).toBeHidden();
});

test('wide desktop balances six benefits without placeholder illustrations', async ({ page }) => {
  for (const lang of ['en','bn']) {
    await page.setViewportSize({ width: 1775, height: 864 });
    await page.goto('/?action=landing&lang=' + lang);
    await page.evaluate(async () => { await document.fonts.ready; });
    const cards = page.locator('.public-benefits__item');
    await expect(cards).toHaveCount(6);
    await expect(page.locator('.public-benefits__preview')).toHaveCount(0);
    const labels = page.locator('.public-benefits__highlights');
    await expect(labels).toHaveCount(2);
    await expect(labels.first().locator('span')).toHaveCount(3);
    await expect(labels.last().locator('span')).toHaveCount(2);
    await expect(labels.first()).toHaveAttribute('aria-hidden','true');
    await expect(labels.last()).toHaveAttribute('aria-hidden','true');
    const boxes = await cards.evaluateAll(elements => elements.map(element => {
      const r = element.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height,
        scrollHeight:element.scrollHeight,clientHeight:element.clientHeight};
    }));
    const approx = (a:number,b:number) => Math.abs(a-b)<=2;
    // Two tall outside cards, four legible compact cards in the middle.
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[1].x).toBeLessThan(boxes[2].x);
    expect(boxes[2].x).toBeLessThan(boxes[5].x);
    expect(approx(boxes[0].y,boxes[1].y)).toBe(true);
    expect(approx(boxes[1].y,boxes[2].y)).toBe(true);
    expect(approx(boxes[0].y,boxes[5].y)).toBe(true);
    expect(approx(boxes[1].x,boxes[3].x)).toBe(true);
    expect(approx(boxes[2].x,boxes[4].x)).toBe(true);
    expect(boxes[3].y).toBeGreaterThan(boxes[1].y);
    expect(approx(boxes[3].y,boxes[4].y)).toBe(true);
    expect(boxes[0].height).toBeGreaterThan(boxes[1].height*1.8);
    expect(boxes[5].height).toBeGreaterThan(boxes[2].height*1.8);
    expect(boxes.every(b => b.scrollHeight<=b.clientHeight+2),JSON.stringify({lang,boxes})).toBe(true);
    const overflow = await page.evaluate(() => ({
      vertical:document.documentElement.scrollHeight-innerHeight,
      horizontal:document.documentElement.scrollWidth-innerWidth,
    }));
    expect(overflow.vertical,JSON.stringify({lang,overflow})).toBeLessThanOrEqual(2);
    expect(overflow.horizontal).toBeLessThanOrEqual(2);
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
  await expect(benefits.getByRole('heading', { name: 'সুবিধাভোগী ব্যবস্থাপনা' })).toBeVisible();
  await expect(benefits.locator('[data-benefit="certificates"] h3')).toHaveText('কর সনদ');
  await expect(benefits.locator('[data-benefit="repeat-drafts"] h3')).toHaveText('আবার পরিশোধ ও সংরক্ষিত খসড়া');
  await expect(benefits.locator('[data-benefit="repeat-drafts"] p')).toHaveText('আগের পেমেন্টের তথ্য ব্যবহার করুন বা খসড়া চালিয়ে যান।');
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
