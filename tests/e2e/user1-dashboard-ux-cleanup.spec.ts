import { expect, test } from '@playwright/test';
import {openTaxpayerTravelTax} from './taxpayer-travel-menu-helper';

const demo = '/?action=taxpayer_home&demoUser=user1';

test('Overview hides unverified external tax position but retains analytics, drafts and correction actions',async({page})=>{
  await page.goto(demo);
  const workspace=page.getByTestId('user1-synthetic-workspace');
  const bento=workspace.getByTestId('taxpayer-overview-bento');
  await expect(workspace).toHaveAttribute('data-dashboard-view','true');
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveCount(1);
  await expect(bento.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'How your tax is covered'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Payments by beneficiary tag'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Recent activity'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'Correction Requests'})).toBeVisible();
  const requests=bento.getByTestId('dashboard-correction-request-list');
  await expect(requests.locator('li')).toHaveCount(2);
  await expect(requests).toContainText('Refund inquiry');
  await expect(requests).toContainText('Credit reassignment inquiry');
  await expect(requests).toContainText('Not approved and not disbursed');
  await bento.getByRole('button',{name:/^Correction Requests/}).click();
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await requests.getByRole('button',{name:/View request details for Refund inquiry/}).click();
  await expect(page.locator('.taxpay-modal')).toBeVisible();
});

test('when external tax data is absent the coverage and year chart move into the first row',async({page})=>{
  await page.goto(demo);
  const bento=page.getByTestId('taxpayer-overview-bento');
  await expect(bento.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'Current tax position'})).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'What needs your attention?'})).toHaveCount(0);
  const children=await bento.evaluate(element=>Array.from(element.children).slice(0,2).map(child=>child.className));
  expect(children[0]).toContain('taxpay-bento-coverage');
  expect(children[1]).toContain('taxpay-bento-years');
});

test('year chart switches assessment year and travel button uses the existing payment modal',async({page})=>{
  await page.goto(demo);
  const group=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  const year=group.getByRole('button',{name:/2024-2025: Total tax/});
  await year.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(year).toHaveAttribute('aria-current','true');
  await openTaxpayerTravelTax(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
});

test('mobile and desktop bento stays unclipped, including visible help disclosures',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','One worker audits responsive widths');
  test.setTimeout(120000);
  for(const width of [320,360,375,390,768,800,1024,1200,1440,1600]){
    await page.setViewportSize({width,height:830});
    await page.goto(demo);
    const workspace=page.getByTestId('user1-synthetic-workspace');
    const bento=workspace.getByTestId('taxpayer-overview-bento');
    await expect(bento).toBeVisible();
    await expect(workspace.getByRole('combobox',{name:'Assessment year'})).toBeVisible();
    await expect(bento.getByRole('button',{name:'Travel tax',exact:true})).toHaveCount(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
    if(width<=390){
      const disclosure=bento.locator('.taxpay-bento-coverage .taxpayer-inline-help > summary');
      await disclosure.click();
      const bounds=await disclosure.locator('..').locator('.taxpayer-inline-help__content').boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x,'popover overflows left at '+width).toBeGreaterThanOrEqual(0);
      expect(bounds!.x+bounds!.width,'popover overflows right at '+width).toBeLessThanOrEqual(width+2);
    }
  }
});

test('signed-in workspace mirrors Sobaike Public design tokens without changing Korbritto primary', async ({page}) => {
  await page.setViewportSize({width:1600,height:900});
  await page.goto(demo);
  const workspace=page.getByTestId('user1-synthetic-workspace');
  await expect(workspace).toBeVisible();
  await expect(workspace.locator('section[aria-label="Welcome"]')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(workspace.getByTestId('taxpayer-overview-bento')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  const desktop=await page.evaluate(()=>{
    const shell=document.querySelector('.taxpay-citizen-shell.taxpay-taxpayer-reference');
    const rail=document.querySelector('.taxpayer-reference-rail');
    const cta=document.querySelector('.taxpayer-reference-main-action');
    const heading=document.querySelector('.taxpayer-dashboard-header h1');
    const card=document.querySelector('.taxpay-bento-coverage section');
    if(!shell||!rail||!cta||!heading||!card)throw Error('Taxpayer presentation elements unavailable');
    const shellStyles=getComputedStyle(shell);
    const railStyles=getComputedStyle(rail);
    const buttonStyles=getComputedStyle(cta);
    const cardStyles=getComputedStyle(card);
    return {
      font:shellStyles.fontFamily,
      page:shellStyles.backgroundColor,
      ink:shellStyles.color,
      railWidth:railStyles.width,
      headingFont:getComputedStyle(heading).fontSize,
      cardBorder:cardStyles.borderTopColor,
      cardRadius:cardStyles.borderTopLeftRadius,
      brandButton:buttonStyles.backgroundColor,
      brandVariable:shellStyles.getPropertyValue('--color-taxpay-primary').trim()
    };
  });
  expect(desktop.font).toContain('Noto Sans');
  expect(desktop.page).toBe('rgb(240, 242, 245)');
  expect(desktop.ink).toBe('rgb(5, 5, 5)');
  expect(desktop.railWidth).toBe('250px');
  expect(desktop.headingFont).toBe('24px');
  expect(desktop.cardBorder).toBe('rgb(228, 230, 235)');
  expect(desktop.cardRadius).toBe('16px');
  const headingBounds=await page.locator('.taxpayer-dashboard-header--overview').boundingBox();
  expect(headingBounds).not.toBeNull();
  expect(headingBounds!.height,'Overview heading must remain compact').toBeLessThan(90);
  expect(desktop.brandButton).toBe('rgb(44, 94, 173)');
  expect(desktop.brandVariable.toUpperCase()).toBe('#2C5EAD');

  await page.setViewportSize({width:360,height:820});
  await expect(workspace).toBeVisible();
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  const mobile=await page.evaluate(()=>{
    const shell=document.querySelector('.taxpay-citizen-shell.taxpay-taxpayer-reference');
    const heading=document.querySelector('.taxpayer-dashboard-header h1');
    return {
      font:shell?getComputedStyle(shell).fontFamily:'',
      heading:heading?getComputedStyle(heading).fontSize:'',
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
    };
  });
  expect(mobile.font).toContain('Noto Sans');
  expect(mobile.heading).toBe('24px');
  expect(mobile.overflow).toBeLessThanOrEqual(2);
});

test('dashboard only: calm card surfaces preserve action contrast and mobile containment',async({page})=>{
  for(const width of [375,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto(demo);
    const bento=page.getByTestId('taxpayer-overview-bento');
    const hero=bento.locator('.taxpay-bento-hero');
    await expect(hero).toHaveCSS('background-color','rgb(255, 255, 255)');
    await expect(bento.locator('.taxpay-bento-position__highlight')).toHaveCount(0);
    const status=hero.locator('.taxpay-bento-hero__status');
    await expect(status.getByRole('button')).toHaveCount(3);
    for(const button of await status.getByRole('button').all()){
      await expect(button).toHaveCSS('background-color','rgb(247, 249, 252)');
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'dashboard horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});

test('Overview puts financial position first, followed by exceptions, charts, spending and draft work',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(demo);
  const bento=page.getByTestId('taxpayer-overview-bento');
  const order=await bento.evaluate(element=>Array.from(element.children).map(child=>
    child.classList.contains('taxpay-bento-position')?'position':
    child.classList.contains('taxpay-bento-request-row')?'requests':
    child.classList.contains('taxpay-bento-coverage')?'coverage':
    child.classList.contains('taxpay-bento-years')?'years':
    child.classList.contains('taxpay-bento-tags')?'tags':
    child.classList.contains('taxpay-bento-drafts')?'drafts':
    child.classList.contains('taxpay-bento-recent')?'recent':'other'));
  expect(order.slice(0,4)).toEqual(['coverage','years','requests','tags']);
  if(order.includes('drafts')){
    expect(order.indexOf('drafts')).toBeGreaterThan(order.indexOf('tags'));
    expect(order.indexOf('drafts')).toBeLessThan(order.indexOf('recent'));
  }
  const positions=await bento.evaluate(element=>{
    const rect=(selector:string)=>element.querySelector(selector)!.getBoundingClientRect();
    const coverage=rect('.taxpay-bento-coverage'),years=rect('.taxpay-bento-years');
    const attention=rect('.taxpay-bento-hero'),tags=rect('.taxpay-bento-tags'),recent=rect('.taxpay-bento-recent');
    return {coverageY:coverage.y,yearsY:years.y,attentionY:attention.y,
      tagsY:tags.y,recentY:recent.y,coverageHeight:coverage.height,yearsHeight:years.height};
  });
  expect(Math.abs(positions.coverageY-positions.yearsY)).toBeLessThan(3);
  expect(positions.attentionY).toBeGreaterThan(positions.coverageY);
  expect(positions.tagsY).toBeGreaterThan(positions.coverageY);
  expect(positions.recentY).toBeGreaterThan(positions.tagsY);
  expect(Math.abs(positions.coverageHeight-positions.yearsHeight),'Balanced analytics cards').toBeLessThan(3);
  await expect(bento.locator('.taxpay-bento-position__totals > div')).toHaveCount(0);
  await expect(bento.locator('.taxpay-bento-hero__status button')).toHaveCount(3);
  await expect(bento.locator('.taxpay-bento-hero [aria-controls="dashboard-payment-drafts"]')).toHaveCount(0);
  await expect(bento.locator('.taxpay-tag-spending__track')).toBeVisible();
  await expect(bento.getByRole('button',{name:'Check tax ledger'})).toHaveCount(0);
  await expect(bento.getByRole('button',{name:'View tax ledger'})).toHaveCount(0);
  await expect(bento.getByTestId('tag-spend-own')).toBeVisible();
  await expect(bento.getByTestId('tag-spend-needs-tag')).toBeVisible();
  await expect(bento.getByTestId('tag-spend-no-link')).toBeVisible();
  await expect(bento.getByTestId('tag-spend-unassigned')).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
});

test('selected assessment year controls recent activity and compact spending on desktop and mobile',async({page})=>{
  for(const width of [375,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto(demo);
    const bento=page.getByTestId('taxpayer-overview-bento');
    await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2023-2024');
    const recent=bento.locator('.taxpay-bento-recent');
    await expect(recent).toContainText('Assessment year: 2023-2024');
    await expect(recent).toContainText('20 Aug 2024');
    await expect(recent).not.toContainText('Pending bank reconciliation');
    const tags=bento.getByTestId('beneficiary-spending-breakdown');
    await expect(tags.getByTestId('tagged-payment-total')).toContainText('60,000');
    await expect(tags.getByTestId('tag-spend-no-link')).toContainText('60,000');
    await expect(tags.getByTestId('tag-spend-family')).toContainText('0');
    await expect(tags.locator('.taxpay-tag-spending__track span')).toHaveCount(1);
    await expect(bento.locator('.taxpay-bento-hero__status button')).toHaveCount(3);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});

test('dashboard residual breakdown reconciles linked and unlinked payments without duplicating totals',async({page})=>{
  await page.goto(demo);
  const overview=page.getByTestId('taxpayer-overview-bento');
  const coverage=overview.locator('.taxpay-bento-coverage__donut');
  await expect(coverage).toContainText('3 types');
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2023-2024');
  const spending=overview.getByTestId('beneficiary-spending-breakdown');
  await expect(spending.getByTestId('tagged-payment-total')).toContainText('60,000');
  await expect(spending.getByTestId('tag-spend-own')).toContainText('0');
  await expect(spending.getByTestId('tag-spend-needs-tag')).toContainText('0');
  await expect(spending.getByTestId('tag-spend-no-link')).toContainText('60,000');
  await expect(spending.getByTestId('dashboard-tag-review')).toHaveCount(0);
});
