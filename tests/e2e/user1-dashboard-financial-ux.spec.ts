import { expect, test } from '@playwright/test';

const dashboard='/?action=taxpayer_home&demoUser=user1';

test('financial overview retains correct balances and highlights the action-relevant balance',async({page})=>{
  await page.goto(dashboard);
  const cards=page.locator('.taxpayer-dashboard-kpi');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText('৳ 180,000');
  await expect(cards.nth(1)).toContainText('৳ 80,000');
  await expect(cards.nth(2)).toContainText('৳ 75,000');
  await expect(cards.nth(3)).toContainText('৳ 25,000');
  await expect(cards.nth(3)).toHaveClass(/taxpayer-dashboard-kpi--balance/);
  await expect(page.getByText('Travel tax (separate)')).toBeVisible();
  await expect(page.getByText('৳ 6,500').first()).toBeVisible();

  const tds=page.getByRole('button',{name:/TDS.*48,000/});
  await tds.focus();
  await page.keyboard.press('Space');
  await expect(tds).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[role="img"][aria-label^="Liability coverage"]')).toContainText('৳ 48,000');
  await page.keyboard.press('Space');
  await expect(tds).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[role="img"][aria-label^="Liability coverage"]')).toContainText('86%');
});

test('review tiles navigate to accurately filtered transaction sets without crediting unresolved amounts',async({page})=>{
  for(const [label,count] of [['Pending',1],['Failed / reversed',2],['Unmatched',1],['Requests',2]] as const){
    await page.goto(dashboard);
    await page.getByRole('button',{name:'View '+label+': '+count}).click();
    await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
    await expect(page.getByText('Records: '+count)).toBeVisible();
    await expect(page.getByRole('combobox',{name:'Transaction status'})).toHaveValue('all');
  }
  await page.goto(dashboard);
  await expect(page.locator('.taxpayer-dashboard-kpi').last()).toContainText('৳ 25,000');
});

test('monthly chart renders only recorded bars, supports Tab focus and routes to filtered activity',async({page})=>{
  await page.goto(dashboard);
  await expect(page.getByRole('heading',{name:'Monthly activity'})).toBeVisible();
  const group=page.getByRole('group',{name:/Income tax: Jan/});
  await expect(group.getByRole('button',{name:/Income tax, Jan/})).toHaveCount(0);
  const june=group.getByRole('button',{name:/Income tax, Jun/});
  await expect(june).toBeVisible();
  await june.focus();
  await expect(june).toBeFocused();
  await expect(june).toHaveAttribute('title',/Jun.*30,000/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Transaction category'})).toHaveValue('income');
  await expect(page.getByText('DEMO-PAY-01').first()).toBeVisible();
});

test('desktop navigation consolidates duplicate Home/Tax summary and groups account routes',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop-only rail');
  await page.setViewportSize({width:1600,height:900});
  await page.goto(dashboard);
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  await expect(rail).toBeVisible();
  await expect(rail.getByRole('button',{name:'Home',exact:true})).toHaveCount(1);
  await expect(rail.getByRole('button',{name:'Tax summary'})).toHaveCount(0);
  await expect(rail.getByRole('button',{name:'Explore payment flow'})).toContainText('Payment guide');
  const account=rail.locator('.taxpayer-reference-account');
  await expect(account).not.toHaveAttribute('open','');
  await account.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(account).toHaveAttribute('open','');
  await expect(account.getByRole('button',{name:'Profile',exact:true})).toBeVisible();
  await expect(account.getByRole('button',{name:'Profile settings'})).toBeVisible();
  await expect(account.getByRole('button',{name:'Account access'})).toBeVisible();
});

test('phone-to-wide-desktop layout keeps chart, KPIs and review actions usable',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','One worker checks the full viewport matrix');
  test.setTimeout(120000);
  for(const width of [320,360,375,390,600,768,900,1024,1280,1440,1600,1920]){
    await page.setViewportSize({width,height:820});
    await page.goto(dashboard);
    await expect(page.locator('.taxpayer-dashboard-kpi')).toHaveCount(4);
    await expect(page.getByRole('group',{name:/Income tax: Jan/})).toBeVisible();
    await expect(page.getByRole('button',{name:'View Pending: 1'})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'Horizontal overflow at '+width).toBeLessThanOrEqual(2);
  }
});
