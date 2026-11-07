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
  expect(desktop.headingFont).toBe('30px');
  expect(desktop.cardBorder).toBe('rgb(228, 230, 235)');
  expect(desktop.cardRadius).toBe('16px');
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
  expect(mobile.heading).toBe('26px');
  expect(mobile.overflow).toBeLessThanOrEqual(2);
});
