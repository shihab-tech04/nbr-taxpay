import { expect, test } from '@playwright/test';
import {openTaxpayerTravelTax} from './taxpayer-travel-menu-helper';

const demo = '/?action=taxpayer_home&demoUser=user1&qaScenario=1';

test('Overview hides unverified external tax position and keeps drafts, corrections and useful bento charts',async({page})=>{
  await page.goto(demo);
  const bento=page.getByTestId('taxpayer-overview-bento');
  await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'}).locator('option[value="2026-2027"]')).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'How your tax is covered'})).toHaveCount(0);
  await expect(bento.getByTestId('dashboard-payment-analytics')).toBeVisible();
  await expect(bento.getByRole('heading',{name:'My Tax Journey'})).toBeVisible();
  await expect(bento.getByRole('heading',{name:'Correction Requests'})).toBeVisible();
  await expect(bento.getByRole('button',{name:/Saved Drafts/})).toBeVisible();
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const requests=bento.getByTestId('dashboard-correction-request-list');
  await expect(requests.locator('li')).toHaveCount(2);
  await requests.getByRole('button',{name:/View request details for Refund inquiry/}).click();
  await expect(page.locator('.taxpay-modal')).toBeVisible();
});

test('Overview links recent payments to Activity and filters interactive beneficiary breakdowns',async({page})=>{
  await page.goto(demo);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const bento=page.getByTestId('taxpayer-overview-bento');
  const recent=bento.locator('.taxpay-bento-recent');
  const sources=bento.getByTestId('dashboard-chart-source');
  await sources.getByRole('button',{name:'Examples'}).click();
  await expect(recent).toContainText('Example payer-initiated activity');
  await expect(recent).not.toContainText('Refund inquiry');
  const beneficiary=bento.getByTestId('dashboard-beneficiary-breakdown');
  await beneficiary.locator('.taxpay-recipient-extra > summary').click();
  await expect(beneficiary.locator('[data-tag="unassigned"]')).toBeVisible();
  await beneficiary.getByRole('button',{name:'View payment records'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
});

test('unavailable external-data cards leave no blank grid rows',async({page})=>{
  await page.goto(demo);
  const bento=page.getByTestId('taxpayer-overview-bento');
  await expect(bento.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'Current tax position'})).toHaveCount(0);
  const children=await bento.evaluate(el=>Array.from(el.children).slice(0,3).map(child=>child.className));
  expect(children[0]).toContain('taxpay-bento-request-row');
  expect(children[1]).toContain('taxpay-bento-recent');
  expect(children[2]).toContain('taxpay-bento-analytics');
});

test('assessment-year selector includes current year and Travel Tax retains its existing modal',async({page})=>{
  await page.goto(demo);
  const year=page.getByRole('combobox',{name:'Assessment year'});
  await expect(year.locator('option[value="2026-2027"]')).toHaveCount(1);
  await year.selectOption('2024-2025');
  await expect(year).toHaveValue('2024-2025');
  await openTaxpayerTravelTax(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(0);
});

test('mobile and desktop interactive bento charts stay within viewport and remain usable',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','One worker audits responsive widths');
  test.setTimeout(120000);
  for(const width of [320,360,375,390,768,800,1024,1200,1440,1600]){
    await page.setViewportSize({width,height:830});
    await page.goto(demo);
    const bento=page.getByTestId('taxpayer-overview-bento');
    await expect(bento).toBeVisible();
    const source=bento.getByTestId('dashboard-chart-source');
    await expect(source.getByRole('button',{name:'Recorded'})).toBeVisible();
    await expect(source.getByRole('button',{name:'Examples'})).toBeVisible();
    await expect(bento.getByRole('button',{name:'Travel tax',exact:true})).toHaveCount(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'horizontal overflow at '+width).toBeLessThanOrEqual(2);
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
    const card=document.querySelector('.taxpay-bento-analytics__card');
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
  expect(parseFloat(desktop.headingFont)).toBeGreaterThanOrEqual(28);
  expect(desktop.cardBorder).toBe('rgb(228, 230, 235)');
  expect(desktop.cardRadius).toBe('16px');
  const headingBounds=await page.locator('.taxpayer-dashboard-header--overview').boundingBox();
  expect(headingBounds).not.toBeNull();
  expect(headingBounds!.height,'Overview heading must remain compact with its descriptive subtitle').toBeLessThan(112);
  expect(desktop.brandButton).toBe('rgb(44, 94, 173)');
  expect(desktop.brandVariable.toUpperCase()).toBe('#2C5EAD');

  await page.setViewportSize({width:360,height:820});
  await expect(workspace).toBeVisible();
  await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
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
    await expect(hero).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
    await expect(bento.locator('.taxpay-bento-position__highlight')).toHaveCount(0);
    const status=hero.locator('.taxpay-bento-hero__status');
    await expect(status.getByRole('button')).toHaveCount(3);
    for(const button of await status.getByRole('button').all()){
      await expect(button).toHaveCSS('background-color','rgb(255, 255, 255)');
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'dashboard horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});

test('Overview uses task-first bento sections with independently sized interactive charts',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(demo);
  const bento=page.getByTestId('taxpayer-overview-bento');
  const order=await bento.evaluate(el=>Array.from(el.children).map(child=>child.className));
  expect(order[0]).toContain('taxpay-bento-request-row');
  expect(order[1]).toContain('taxpay-bento-recent');
  expect(order[2]).toContain('taxpay-bento-analytics');
  await expect(bento.locator('.taxpay-bento-request-row .taxpay-bento-drafts')).toHaveCount(1);
  const positions=await bento.evaluate(el=>{
    const rect=(selector:string)=>el.querySelector(selector)!.getBoundingClientRect();
    return {summary:rect('.taxpay-bento-summary'),recent:rect('.taxpay-bento-recent'),
      charts:rect('.taxpay-bento-analytics'),tasks:rect('.taxpay-bento-tasks'),
      service:rect('[data-testid="dashboard-service-breakdown"]'),
      roles:rect('[data-testid="dashboard-role-breakdown"]'),
      beneficiary:rect('[data-testid="dashboard-beneficiary-breakdown"]'),
      ranking:rect('[data-testid="dashboard-ranked-beneficiaries"]')};
  });
  expect(positions.summary.y).toBeLessThan(positions.charts.y);
  expect(positions.charts.y).toBeLessThan(positions.recent.y);
  expect(Math.abs(positions.service.y-positions.roles.y)).toBeLessThan(4);
  expect(Math.abs(positions.beneficiary.y-positions.ranking.y)).toBeLessThan(4);
  expect(Math.abs(positions.beneficiary.width-positions.ranking.width)).toBeLessThan(4);
  expect(Math.abs(positions.recent.y-positions.tasks.y)).toBeLessThan(4);
  await expect(bento.locator('.taxpay-bento-hero__status button')).toHaveCount(3);
  await expect(bento.getByRole('heading',{name:'Recorded payments by month'})).toHaveCount(0);
});

test('selected assessment year updates recent activity and source-isolated spending',async({page})=>{
  for(const width of [375,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto(demo);
    const bento=page.getByTestId('taxpayer-overview-bento');
    await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2023-2024');
    await expect(bento.locator('.taxpay-bento-recent')).toContainText('20 Aug 2024');
    await bento.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
    const beneficiary=bento.getByTestId('dashboard-beneficiary-breakdown');
    await expect(beneficiary).toContainText('60,000');
    await beneficiary.locator('.taxpay-recipient-extra > summary').click();
    await expect(beneficiary.locator('[data-tag="unassigned"]')).toBeVisible();
    await bento.getByTestId('dashboard-payment-extra').locator('summary').click();
    await expect(bento.getByTestId('dashboard-service-breakdown').locator('[data-service="income"]')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
});

test('selecting a service interactively filters beneficiary amounts without mutating ledger data',async({page})=>{
  await page.goto(demo);
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2025-2026');
  const analytics=page.getByTestId('dashboard-payment-analytics');
  await analytics.getByTestId('dashboard-chart-source').getByRole('button',{name:'Examples'}).click();
  await analytics.getByTestId('dashboard-payment-extra').locator('summary').click();
  const service=analytics.getByTestId('dashboard-service-breakdown');
  const beneficiary=analytics.getByTestId('dashboard-beneficiary-breakdown');
  const before=await beneficiary.locator('.taxpay-bento-analytics__total').textContent();
  await service.locator('[data-service="travel"]').click();
  await expect(beneficiary).toContainText('Travel Tax');
  await expect(beneficiary).toContainText('6,500');
  expect(await beneficiary.locator('.taxpay-bento-analytics__total').textContent()).not.toBe(before);
  await service.getByRole('button',{name:'Show all payment services'}).click();
  await expect(beneficiary.locator('.taxpay-bento-analytics__total')).toHaveText(before!);
});

