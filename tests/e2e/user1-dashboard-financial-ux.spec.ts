import { expect, test } from '@playwright/test';
const dashboard='/?action=taxpayer_home&demoUser=user1';

test('the verified external financial row is hidden, with year analytics and correction requests moving up',async({page})=>{
  await page.goto(dashboard);
  const bento=page.getByTestId('taxpayer-overview-bento');
  await expect(bento).toBeVisible();
  await expect(bento.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(bento.locator('.taxpay-bento-hero')).toHaveCount(0);
  await expect(bento.getByRole('heading',{name:'How your tax is covered'})).toBeVisible();
  await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toBeVisible();
  await expect(bento.getByRole('heading',{name:'Payments by beneficiary tag'})).toBeVisible();
  await expect(bento.getByTestId('dashboard-correction-requests')).toBeVisible();
  await expect(bento.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
});

test('correction requests use the preserved scenario correction journey',async({page})=>{
  await page.goto(dashboard);
  await page.getByTestId('dashboard-correction-requests').getByRole('button',{name:'View correction requests'}).click();
  await expect(page.getByRole('heading',{name:'Corrections & exceptions'})).toBeVisible();
  await expect(page.getByText('DEMO-PAY-PEND-01').first()).toBeVisible();
  await page.goto('/?action=history&demoUser=user1');
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
});

test('year bars keep keyboard year selection without showing an unverified tax position',async({page})=>{
  await page.goto(dashboard);
  const group=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  const oldYear=group.getByRole('button',{name:/2024-2025: Total tax/});
  await oldYear.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(oldYear).toHaveAttribute('aria-current','true');
  await expect(page.locator('.taxpay-bento-position')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
});

test('desktop rail has dedicated certificate and correction entries and nested Travel Tax',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop rail');
  await page.setViewportSize({width:1600,height:900});
  await page.goto(dashboard);
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await expect(rail).toBeVisible();
  await expect(rail.locator('.taxpayer-reference-links > button')).toHaveCount(7);
  await expect(rail.getByRole('button',{name:'Tax Credit Certificates'})).toBeVisible();
  await expect(rail.getByRole('button',{name:'Correction Requests'})).toBeVisible();
  const pay=rail.getByRole('button',{name:'Pay Tax menu'});
  await expect(pay).toHaveAttribute('aria-expanded','false');
  await pay.click();
  await expect(pay).toHaveAttribute('aria-expanded','true');
  await expect(rail.getByRole('button',{name:'Travel Tax',exact:true})).toBeVisible();
  await expect(rail.getByRole('button',{name:'Tax with Return / Other Tax'})).toBeVisible();
  await rail.getByRole('button',{name:'Travel Tax',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('year analytics and correction shortcuts remain contained from 320px through desktop',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Responsive matrix');
  test.setTimeout(120000);
  for(const width of [320,360,375,390,600,768,800,900,1024,1199,1200,1280,1440,1600,1920]){
    await page.setViewportSize({width,height:820});
    await page.goto(dashboard);
    const bento=page.getByTestId('taxpayer-overview-bento');
    await expect(bento).toBeVisible();
    await expect(bento.locator('.taxpay-bento-position')).toHaveCount(0);
    await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toBeVisible();
    await expect(bento.getByTestId('dashboard-correction-requests')).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'Horizontal overflow at '+width).toBeLessThanOrEqual(2);
    expect(await bento.evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(250);
  }
});
