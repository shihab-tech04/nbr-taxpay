import {expect,test} from '@playwright/test';

const demo='/?action=taxpayer_home&demoUser=user1';

test('overview uses compact metrics and a distinct calendar-month chart with existing recorded amounts',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Desktop layout acceptance');
 await page.setViewportSize({width:1600,height:900});
 await page.goto(demo);
 const dashboard=page.getByTestId('taxpayer-overview-bento');
 const metrics=dashboard.locator('.taxpay-bento-summary');
 const cases=dashboard.locator('#dashboard-correction-requests');
 const monthly=dashboard.getByTestId('dashboard-monthly-payments');
 await expect(metrics.getByRole('button')).toHaveCount(3);
 await expect(metrics.getByRole('button',{name:/Completed Payments/})).toContainText('8');
 await expect(metrics.getByRole('button',{name:/Correction Requests/})).toContainText('2');
 await expect(cases.getByTestId('dashboard-correction-request-list').locator('li')).toHaveCount(2);
 await expect(monthly).toBeVisible();
 await expect(monthly.locator('.taxpay-monthly-card__month')).toHaveCount(6);
 await expect(monthly.locator('[data-month="2026-04"]')).toHaveAttribute('data-amount','6500');
 await expect(monthly.locator('[data-month="2026-05"]')).toHaveAttribute('data-amount','0');
 await expect(monthly.locator('[data-month="2026-06"]')).toHaveAttribute('data-amount','30000');
 await expect(monthly.locator('[data-month="2026-09"]')).toHaveAttribute('data-amount','45000');
 await expect(monthly.locator('.taxpay-monthly-card__total')).toContainText('81,500');
 const [metricBox,caseBox]=await Promise.all([metrics.boundingBox(),cases.boundingBox()]);
 expect(metricBox&&caseBox).toBeTruthy();
 expect(metricBox!.height,'summary must be content-sized, not stretched to case height').toBeLessThan(caseBox!.height);
 await metrics.getByRole('button',{name:/Correction Requests/}).click();
 await expect(cases).toBeFocused();
 await cases.getByRole('button',{name:/View request details for Refund inquiry/}).click();
 await expect(page.locator('.taxpay-modal')).toBeVisible();
});

test('Saved Drafts always opens a visible account-scoped recovery section including empty states',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Single draft-state check');
 await page.goto(demo);
 const overview=page.getByTestId('taxpayer-overview-bento');
 const tile=overview.locator('.taxpay-bento-summary').getByRole('button',{name:/Saved Drafts/});
 const drafts=overview.getByTestId('dashboard-payment-drafts');
 await expect(tile).toBeVisible();
 await expect(drafts).toBeVisible();
 await tile.click();
 await expect(drafts).toBeInViewport();
 await expect(drafts.getByRole('heading',{name:'Saved payment drafts'})).toBeVisible();
 await expect(drafts.getByRole('status')).toBeVisible();
 await expect(drafts.getByRole('button',{name:'Start a payment'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
});

test('changing assessment year recomputes payment chart from that year instead of retaining previous amounts',async({page},info)=>{
 test.skip(info.project.name!=='desktop-1280','Single data-isolation check');
 await page.goto(demo);
 await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2024-2025');
 const monthly=page.getByTestId('dashboard-monthly-payments');
 await expect(monthly).toContainText('2024-2025');
 await expect(monthly.locator('[data-month="2025-06"]')).toHaveAttribute('data-amount','40000');
 await expect(monthly.locator('[data-month="2025-09"]')).toHaveAttribute('data-amount','30000');
 await expect(monthly.locator('[data-month="2026-09"]')).toHaveCount(0);
});

test('monthly bars, metric tiles and correction actions remain contained across desktop and mobile widths',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Single viewport sweep');
 test.setTimeout(90000);
 for(const width of [320,375,768,1024,1280,1600]){
  await page.setViewportSize({width,height:830});
  await page.goto(demo);
  const dashboard=page.getByTestId('taxpayer-overview-bento');
  const monthly=dashboard.getByTestId('dashboard-monthly-payments');
  const metrics=dashboard.locator('.taxpay-bento-summary');
  await expect(monthly).toBeVisible();
  await expect(metrics.getByRole('button')).toHaveCount(3);
  await expect(dashboard.locator('#dashboard-correction-requests')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),
    'horizontal overflow at '+width).toBeLessThanOrEqual(2);
  const body=await monthly.boundingBox();
  expect(body,'chart exists at '+width).not.toBeNull();
  expect(body!.x+body!.width,'chart contained at '+width).toBeLessThanOrEqual(width+2);
 }
});

test('Bangla headings and labelled recorded-payment chart stay in the approved dashboard',async({page},info)=>{
 test.skip(info.project.name!=='mobile-375','Single Bangla check');
 await page.goto(demo+'&lang=bn');
 const chart=page.getByTestId('dashboard-monthly-payments');
 await expect(chart.getByRole('heading',{name:'মাস অনুযায়ী নথিভুক্ত পেমেন্ট'})).toBeVisible();
 await expect(chart.getByTestId('monthly-payment-bars')).toHaveAttribute('aria-label',/নথিভুক্ত পেমেন্ট/);
 await expect(page.getByTestId('taxpayer-overview-bento').locator('.taxpay-bento-summary').getByRole('button')).toHaveCount(3);
});
