import { expect, test } from '@playwright/test';

const dashboard='/?action=taxpayer_home&demoUser=user1';

test('bento financial position reconciles with the unchanged account ledger and coverage chart',async({page})=>{
  await page.goto(dashboard);
  const bento=page.getByTestId('taxpayer-overview-bento');
  await expect(bento).toBeVisible();
  const position=bento.locator('.taxpay-bento-position');
  await expect(position).toContainText('৳ 180,000');
  await expect(position).toContainText('৳ 155,000');
  await expect(position).toContainText('৳ 25,000');
  await expect(position).toContainText('Travel tax (separate)');
  await expect(position).toContainText('৳ 6,500');
  await expect(bento.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
  const tds=page.getByRole('button',{name:/TDS.*48,000/});
  await tds.focus();
  await page.keyboard.press('Space');
  await expect(tds).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[role="img"][aria-label^="Liability coverage"]')).toContainText('৳ 48,000');
  await page.keyboard.press('Space');
  await expect(tds).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[role="img"][aria-label^="Liability coverage"]')).toContainText('86%');
  await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toBeVisible();
});

test('attention actions retain their filtered Activity and correction routes',async({page})=>{
  for(const [label,count] of [['Pending',1],['Failed / reversed',2],['Unmatched',1],['Requests',2]] as const){
    await page.goto(dashboard);
    await page.getByRole('button',{name:'View '+label+': '+count}).click();
    await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
    await expect(page.locator('.taxpay-office-register__count')).toContainText(String(count));
    await page.getByRole('button',{name:'Clear review filter'}).click();
    await expect(page.locator('.taxpay-office-register__count')).toContainText('14');
  }
  await page.goto(dashboard);
  await page.getByRole('button',{name:'Review exceptions'}).click();
  await expect(page.getByRole('heading',{name:'Corrections & exceptions'})).toBeVisible();
});

test('tax year bars remain keyboard-accessible selectors and do not invent monthly trends',async({page})=>{
  await page.goto(dashboard);
  const group=page.getByRole('group',{name:'Liability and posted credits by tax year'});
  const oldYear=group.getByRole('button',{name:/2024-2025: Total tax/});
  await expect(oldYear).toBeVisible();
  await oldYear.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(oldYear).toHaveAttribute('aria-current','true');
  await expect(page.locator('.taxpay-bento-position')).toContainText('৳ 10,000');
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
  await page.getByRole('button',{name:'View all activity'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
});

test('desktop navigation consolidates duplicate Overview/Tax summary and groups account routes',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop-only rail');
  await page.setViewportSize({width:1600,height:900});
  await page.goto(dashboard);
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await expect(rail).toBeVisible();
  await expect(rail.getByRole('button',{name:'Overview',exact:true})).toHaveCount(1);
  await expect(rail.getByRole('button',{name:'Tax summary'})).toHaveCount(0);
  await expect(rail.locator('.taxpayer-reference-links > button')).toHaveCount(5);
  const account=rail.locator('.taxpayer-reference-rail-bottom');
  await expect(rail.locator('.taxpayer-reference-account')).toHaveCount(0);
  await expect(account.getByRole('button',{name:'Profile',exact:true})).toBeVisible();
  await expect(account.getByRole('button',{name:'Profile settings'})).toHaveCount(0);
  await expect(account.getByRole('button')).toHaveCount(3);
  await expect(account.getByRole('button',{name:'Account access'})).toHaveCount(0);
  await expect(account.getByRole('button',{name:'Help',exact:true})).toHaveCount(0);
  await expect(account.getByRole('button').last()).toContainText('Exit workspace');
  await expect(rail.getByRole('button',{name:'Payment services',exact:true})).toHaveCount(0);
});


test('bento layout, Travel Tax and action controls remain usable from 320px to wide desktop',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','One worker verifies the full responsive matrix');
  test.setTimeout(120000);
  for(const width of [320,360,375,390,600,768,800,900,1024,1199,1200,1280,1440,1600,1920]){
    await page.setViewportSize({width,height:820});
    await page.goto(dashboard);
    const bento=page.getByTestId('taxpayer-overview-bento');
    await expect(bento).toBeVisible();
    await expect(bento.getByRole('button',{name:'Travel tax',exact:true})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'Tax trend by year'})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'Payments by beneficiary tag'})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'Recent activity'})).toBeVisible();
    await expect(bento.getByRole('heading',{name:'Monthly activity'})).toHaveCount(0);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'Horizontal overflow at '+width).toBeLessThanOrEqual(2);
    const before=await bento.evaluate(node=>node.getBoundingClientRect());
    expect(before.width,'Bento bounds should be nonempty at '+width).toBeGreaterThan(250);
  }
});
