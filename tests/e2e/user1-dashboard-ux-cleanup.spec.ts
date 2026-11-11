import {expect,test} from '@playwright/test';
const demo='/?action=taxpayer_home&demoUser=user1';

test('Overview hides unverified external position and retains its year chart, coverage, tags, drafts and recent history',async({page})=>{
  await page.goto(demo);
  const workspace=page.getByTestId('user1-synthetic-workspace');
  const bento=workspace.getByTestId('taxpayer-overview-bento');
  await expect(workspace).toHaveAttribute('data-dashboard-view','true');
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveCount(1);
  await expect(bento.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(bento.locator('.taxpay-bento-hero')).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'How your tax is covered'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Payments by beneficiary tag'})).toHaveCount(1);
  await expect(bento.getByRole('heading',{name:'Recent activity'})).toHaveCount(1);
  await expect(bento.getByTestId('dashboard-correction-requests')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
  await expect(page.getByText('Sample',{exact:true})).toHaveCount(0);
});

test('correction entry preserves the existing exception history and case details',async({page})=>{
  await page.goto(demo);
  await page.getByTestId('dashboard-correction-requests').getByRole('button',{name:'View correction requests'}).click();
  await expect(page.getByRole('heading',{name:'Corrections & exceptions'})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-PEND-01').first()).toBeVisible();
});

test('certificate menu distinguishes unavailable official tax credits from recorded payment references',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop certificate route');
  await page.goto(demo);
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await rail.getByRole('button',{name:'Tax Credit Certificates'}).click();
  await expect(page.getByTestId('tax-credit-certificates')).toContainText('No verified government-issued tax credit certificates');
  await expect(page.getByText('DEMO-CH-INC-01').first()).toBeVisible();
});

test('year chart retains keyboard assessment-year selection and Travel Tax is inside Pay Tax',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop payment dropdown');
  await page.setViewportSize({width:1600,height:900});
  await page.goto(demo);
  const chart=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  const year=chart.getByRole('button',{name:/2024-2025: Total tax/});
  await year.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await rail.getByRole('button',{name:'Pay Tax menu'}).click();
  await rail.getByRole('button',{name:'Travel Tax',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('mobile and desktop analytics remain unclipped without unverified top row',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Responsive audit');
  test.setTimeout(120000);
  for(const width of [320,360,375,390,768,800,1024,1200,1440,1600]){
    await page.setViewportSize({width,height:830});
    await page.goto(demo);
    const bento=page.getByTestId('taxpayer-overview-bento');
    await expect(bento).toBeVisible();
    await expect(bento.locator('.taxpay-bento-position')).toHaveCount(0);
    await expect(bento.getByRole('heading',{name:'How your tax is covered'})).toBeVisible();
    await expect(bento.getByTestId('dashboard-correction-requests')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
});

test('approved taxpayer shell typography, primary action and mobile heading survive the dashboard visibility change',async({page})=>{
  await page.setViewportSize({width:1600,height:900});
  await page.goto(demo);
  const workspace=page.getByTestId('user1-synthetic-workspace');
  await expect(workspace.locator('section[aria-label="Welcome"]')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  const desktop=await page.evaluate(()=>{
    const shell=document.querySelector('.taxpay-citizen-shell.taxpay-taxpayer-reference');
    const rail=document.querySelector('.taxpayer-reference-rail');
    const cta=document.querySelector('.taxpayer-reference-main-action');
    const heading=document.querySelector('.taxpayer-dashboard-header h1');
    if(!shell||!rail||!cta||!heading)throw Error('Taxpayer presentation elements unavailable');
    return {
      font:getComputedStyle(shell).fontFamily,
      railWidth:getComputedStyle(rail).width,
      headingFont:getComputedStyle(heading).fontSize,
      button:getComputedStyle(cta).backgroundColor,
      primary:getComputedStyle(shell).getPropertyValue('--color-taxpay-primary').trim()
    };
  });
  expect(desktop.font).toContain('Noto Sans');
  expect(desktop.railWidth).toBe('250px');
  expect(desktop.headingFont).toBe('24px');
  expect(desktop.button).not.toBe('rgba(0, 0, 0, 0)');
  expect(desktop.primary.length).toBeGreaterThan(0);
  await page.setViewportSize({width:360,height:820});
  await expect(workspace).toBeVisible();
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('second row becomes the first bento row, followed by spending, correction requests and draft work',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(demo);
  const bento=page.getByTestId('taxpayer-overview-bento');
  const order=await bento.evaluate(element=>Array.from(element.children).map(child=>
    child.classList.contains('taxpay-bento-coverage')?'coverage':
    child.classList.contains('taxpay-bento-years')?'years':
    child.classList.contains('taxpay-bento-tags')?'tags':
    child.classList.contains('taxpay-bento-corrections')?'corrections':
    child.classList.contains('taxpay-bento-drafts')?'drafts':
    child.classList.contains('taxpay-bento-recent')?'recent':'other'));
  expect(order.slice(0,4)).toEqual(['coverage','years','tags','corrections']);
  if(order.includes('drafts'))expect(order.indexOf('drafts')).toBeGreaterThan(order.indexOf('corrections'));
  const bounds=await bento.evaluate(element=>{
    const rect=(selector:string)=>element.querySelector(selector)!.getBoundingClientRect();
    const coverage=rect('.taxpay-bento-coverage'),years=rect('.taxpay-bento-years'),
      tags=rect('.taxpay-bento-tags'),corrections=rect('.taxpay-bento-corrections');
    return {coverageY:coverage.y,yearsY:years.y,tagsY:tags.y,correctionY:corrections.y};
  });
  expect(Math.abs(bounds.coverageY-bounds.yearsY)).toBeLessThan(3);
  expect(bounds.tagsY).toBeGreaterThan(bounds.coverageY);
  expect(bounds.correctionY).toBeGreaterThan(bounds.tagsY);
  await expect(bento.locator('.taxpay-tag-spending__track')).toBeVisible();
  await expect(bento.getByTestId('tag-spend-own')).toBeVisible();
  await expect(bento.getByTestId('tag-spend-needs-tag')).toBeVisible();
  await expect(bento.getByTestId('tag-spend-no-link')).toBeVisible();
});

test('assessment year continues to control recent activity and tagged spending on mobile and desktop',async({page})=>{
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
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  }
});

test('dashboard residual breakdown still reconciles linked and unlinked payment allocations',async({page})=>{
  await page.goto(demo);
  const overview=page.getByTestId('taxpayer-overview-bento');
  await expect(overview.locator('.taxpay-bento-coverage__donut')).toContainText('3 types');
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2023-2024');
  const spending=overview.getByTestId('beneficiary-spending-breakdown');
  await expect(spending.getByTestId('tagged-payment-total')).toContainText('60,000');
  await expect(spending.getByTestId('tag-spend-own')).toContainText('0');
  await expect(spending.getByTestId('tag-spend-needs-tag')).toContainText('0');
  await expect(spending.getByTestId('tag-spend-no-link')).toContainText('60,000');
  await expect(spending.getByTestId('dashboard-tag-review')).toHaveCount(0);
});
