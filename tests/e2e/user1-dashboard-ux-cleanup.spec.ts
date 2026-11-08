import { expect, test } from '@playwright/test';

const demo = '/?action=taxpayer_home&demoUser=user1';

test('the Overview has one tax position, one tax-year chart, the original draft and beneficiary actions',async({page})=>{
  await page.goto(demo);
  const workspace=page.getByTestId('user1-synthetic-workspace');
  const bento=workspace.getByTestId('taxpayer-overview-bento');
  await expect(workspace).toHaveAttribute('data-dashboard-view','true');
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveCount(1);
  await expect(bento.locator('.taxpay-bento-position')).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'How your tax is covered'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Payments by beneficiary tag'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Recent activity'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
  await expect(bento.getByRole('button',{name:'Pay tax',exact:true})).toBeVisible();
  await expect(bento.getByRole('button',{name:'Travel tax',exact:true})).toBeVisible();
  await expect(bento.locator('.taxpay-bento-position')).toContainText('৳ 180,000');
  await expect(bento.locator('.taxpay-bento-position')).toContainText('৳ 155,000');
  await expect(bento.locator('.taxpay-bento-position')).toContainText('৳ 25,000');
  await expect(bento.locator('.taxpay-bento-position')).toContainText('Travel tax (separate)');
  await expect(page.getByRole('heading',{name:'Tax service activity'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Transaction history'})).toHaveCount(0);
  await expect(page.getByText('Sample',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Review exceptions'}).click();
  await expect(page.getByRole('heading',{name:'Corrections & exceptions'})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-PEND-01').first()).toBeVisible();
});

test('current tax position explanation supports keyboard and touch disclosure',async({page})=>{
  await page.goto(demo);
  const disclosure=page.locator('summary[aria-label="About Current tax position"]');
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure.locator('..')).toHaveAttribute('open','');
  await expect(page.getByText(/Recorded account scenario for the selected assessment year/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(disclosure.locator('..')).not.toHaveAttribute('open','');
  await disclosure.focus();
  await page.keyboard.press('Space');
  await expect(disclosure.locator('..')).toHaveAttribute('open','');
  await disclosure.click();
  await expect(disclosure.locator('..')).not.toHaveAttribute('open','');
});

test('year chart switches assessment year and travel button uses the existing payment modal',async({page})=>{
  await page.goto(demo);
  const group=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  const year=group.getByRole('button',{name:/2024-2025: Total tax/});
  await year.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(year).toHaveAttribute('aria-current','true');
  await page.getByRole('button',{name:'Travel tax',exact:true}).click();
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
    await expect(bento.getByRole('button',{name:'Travel tax',exact:true})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
    if(width<=390){
      const disclosure=page.locator('summary[aria-label="About Current tax position"]');
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
    const card=document.querySelector('.taxpay-bento-position');
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
    const highlight=bento.locator('.taxpay-bento-position__highlight');
    await expect(hero).toHaveCSS('background-color','rgb(255, 255, 255)');
    await expect(highlight).toHaveCSS('background-color','rgb(245, 248, 252)');
    await expect(hero.locator('.taxpay-bento-hero__status button').first()).toHaveCSS('background-color','rgb(247, 249, 252)');
    await expect(hero.getByRole('button',{name:'Pay tax',exact:true})).toBeVisible();
    await expect(hero.getByRole('button',{name:'Travel tax',exact:true})).toBeVisible();
    const colors=await hero.evaluate(element=>{
      const heading=element.querySelector('h2');
      const buttons=Array.from(element.querySelectorAll<HTMLButtonElement>('.taxpay-bento-hero__actions button'));
      return {
        heading:heading?getComputedStyle(heading).color:'',
        buttons:buttons.map(button=>({
          background:getComputedStyle(button).backgroundColor,
          color:getComputedStyle(button).color,
          height:button.getBoundingClientRect().height
        }))
      };
    });
    expect(colors.heading).not.toBe('rgb(255, 255, 255)');
    expect(colors.buttons).toHaveLength(2);
    expect(colors.buttons.every(button=>button.background==='rgb(255, 255, 255)')).toBe(true);
    expect(colors.buttons.every(button=>button.color!=='rgb(255, 255, 255)'&&button.height>=44)).toBe(true);
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
    child.classList.contains('taxpay-bento-hero')?'attention':
    child.classList.contains('taxpay-bento-coverage')?'coverage':
    child.classList.contains('taxpay-bento-years')?'years':
    child.classList.contains('taxpay-bento-tags')?'tags':
    child.classList.contains('taxpay-bento-drafts')?'drafts':
    child.classList.contains('taxpay-bento-recent')?'recent':'other'));
  expect(order.slice(0,5)).toEqual(['position','attention','coverage','years','tags']);
  if(order.includes('drafts')){
    expect(order.indexOf('drafts')).toBeGreaterThan(order.indexOf('tags'));
    expect(order.indexOf('drafts')).toBeLessThan(order.indexOf('recent'));
  }
  const positions=await bento.evaluate(element=>{
    const rect=(selector:string)=>element.querySelector(selector)!.getBoundingClientRect();
    const balance=rect('.taxpay-bento-position'),attention=rect('.taxpay-bento-hero');
    const coverage=rect('.taxpay-bento-coverage'),years=rect('.taxpay-bento-years');
    const tags=rect('.taxpay-bento-tags'),recent=rect('.taxpay-bento-recent');
    return {balanceX:balance.x,attentionX:attention.x,coverageY:coverage.y,
      yearsY:years.y,tagsY:tags.y,recentY:recent.y,attentionHeight:attention.height,
      coverageHeight:coverage.height,yearsHeight:years.height};
  });
  expect(positions.balanceX).toBeLessThan(positions.attentionX);
  expect(Math.abs(positions.coverageY-positions.yearsY)).toBeLessThan(3);
  expect(positions.tagsY).toBeGreaterThan(positions.coverageY);
  expect(positions.recentY).toBeGreaterThan(positions.tagsY);
  expect(positions.attentionHeight,'Compact attention card').toBeLessThan(370);
  expect(Math.abs(positions.coverageHeight-positions.yearsHeight),'Balanced analytics cards').toBeLessThan(3);
  await expect(bento.locator('.taxpay-bento-position__totals > div')).toHaveCount(2);
  await expect(bento.locator('.taxpay-bento-hero__status button')).toHaveCount(4);
  await expect(bento.locator('.taxpay-bento-hero [aria-controls="dashboard-payment-drafts"]')).toHaveCount(0);
  await expect(bento.locator('.taxpay-tag-spending__track')).toBeVisible();
  await expect(bento.getByRole('button',{name:'Check tax ledger'})).toHaveCount(0);
  await expect(bento.getByRole('button',{name:'View tax ledger'})).toHaveCount(1);
  await expect(bento.locator('[data-testid^="tag-spend-"]')).toHaveCount(5);
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
    await expect(tags.getByTestId('tag-spend-unassigned')).toContainText('60,000');
    await expect(tags.getByTestId('tag-spend-family')).toContainText('0');
    await expect(tags.locator('.taxpay-tag-spending__track span')).toHaveCount(1);
    await expect(bento.locator('.taxpay-bento-hero__status button')).toHaveCount(0);
    await expect(bento.locator('.taxpay-bento-hero__clear')).toBeVisible();
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
  const residual=spending.getByTestId('dashboard-tag-review');
  await expect(residual).toContainText('Own payments');
  await expect(residual).toContainText('Saved beneficiary needs a tag');
  await expect(residual).toContainText('No beneficiary link');
  await expect(residual).toContainText('60,000');
  await expect(residual.getByRole('button',{name:'Review beneficiary tags'})).toHaveCount(0);
});
