import {expect,test} from '@playwright/test';

const preview='/?action=taxpayer_home&demoUser=user1';

test('dashboard month bar opens exact calendar month and preserved category',async({page})=>{
  await page.goto(preview);
  const summary=page.getByRole('region',{name:'Financial summary'});
  await expect(summary.locator('.taxpayer-dashboard-kpi')).toHaveCount(4);
  const review=page.getByRole('heading',{name:'Needs review'});
  const charts=page.getByRole('heading',{name:'Tax coverage'});
  const order=await page.evaluate(()=>({
    review:document.querySelector('#taxpayer-attention-title')?.getBoundingClientRect().top,
    chart:document.querySelector('#taxpayer-coverage-title')?.getBoundingClientRect().top,
  }));
  expect(order.review).toBeLessThan(order.chart);
  await expect(review).toBeVisible();
  await expect(charts).toBeVisible();
  await page.getByRole('group',{name:/Income tax: Jun 2026/}).getByRole('button',{name:/Income tax, Jun 2026/}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Transaction category'})).toHaveValue('income');
  await expect(page.getByRole('combobox',{name:'Transaction month'})).toHaveValue('2026-06');
  await expect(page.getByText('Records: 1')).toBeVisible();
  await expect(page.getByText('DEMO-PAY-01').first()).toBeVisible();
  await expect(page.getByText('DEMO-PAY-02')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Transaction month'}).selectOption('all');
  await expect(page.getByText('DEMO-PAY-02').first()).toBeVisible();
});

test('tax journey uses chronological scenario events, no invented four-stage confirmations',async({page})=>{
  await page.goto('/?action=journey&demoUser=user1&scenarioYear=2025-2026');
  const timeline=page.getByRole('list',{name:'Chronological account events'});
  await expect(timeline).toBeVisible();
  await expect(timeline.locator('li')).toHaveCount(14);
  await expect(timeline.locator('li').first()).toContainText('Salary withholding');
  await expect(timeline).toContainText('Pending bank reconciliation');
  await expect(timeline).toContainText('Unmatched withholding candidate');
  await expect(timeline.getByText('Treasury settlement',{exact:true})).toHaveCount(0);
  await expect(timeline.getByText('Ledger allocation',{exact:true})).toHaveCount(0);
  await timeline.getByRole('button',{name:'Details for Pending bank reconciliation'}).click();
  const details=page.getByRole('dialog',{name:'Pending bank reconciliation'});
  await expect(details).toContainText('DEMO-PAY-PEND-01');
  await expect(details).toContainText('No settlement or ledger credit assigned');
  await details.getByRole('button',{name:'Close transaction details'}).click();
  await page.getByRole('combobox',{name:'Assessment year'}).selectOption('2024-2025');
  await expect(timeline.locator('li')).toHaveCount(4);
  await expect(timeline).not.toContainText('DEMO-PAY-PEND-01');
});
