import {expect,test} from '@playwright/test';

const history='/?action=history&demoUser=user1';

test('history uses one content panel and aligned, legible payment rows',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Representative desktop transaction layout');
  await page.goto(history);
  const workspace=page.getByTestId('user1-synthetic-workspace');
  const panel=workspace.locator('.taxpayer-transaction-panel');
  const rows=panel.locator('.taxpayer-transaction-row');

  await expect(panel.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(workspace.getByText('Payment & activity count')).toHaveCount(0);
  await expect(panel.getByText('Records: 14')).toBeVisible();
  await expect(rows).toHaveCount(14);

  const first=rows.first();
  const positions=await first.evaluate(row=>{
    const bounds=(selector:string)=>row.querySelector(selector)!.getBoundingClientRect();
    const identity=bounds('.taxpayer-transaction-row__identity');
    const amount=bounds('.taxpayer-transaction-row__amount');
    const status=bounds('.taxpayer-transaction-row__status');
    const action=bounds('.taxpayer-transaction-row__action');
    return {identityRight:identity.right,amountLeft:amount.left,amountRight:amount.right,
      statusLeft:status.left,statusRight:status.right,actionLeft:action.left};
  });
  expect(positions.amountLeft).toBeGreaterThan(positions.identityRight);
  expect(positions.statusLeft).toBeGreaterThan(positions.amountRight);
  expect(positions.actionLeft).toBeGreaterThan(positions.statusRight);

  await first.getByRole('button',{name:'Details for Pending bank reconciliation'}).click();
  const dialog=page.getByRole('dialog',{name:'Pending bank reconciliation'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('৳ 14,000')).toBeVisible();
  await expect(dialog.getByText('DEMO-PAY-PEND-01')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Close'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(first.getByRole('button',{name:'Details for Pending bank reconciliation'})).toBeFocused();

  await panel.getByRole('combobox',{name:'Transaction category'}).selectOption('refund');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByText('Refund inquiry',{exact:true}).first()).toBeVisible();
});

test('history rows, filters and detail modal fit narrow screens',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Responsive payment row audit');
  for(const width of [320,375,390,600,768]){
    await page.setViewportSize({width,height:820});
    await page.goto(history);
    const panel=page.locator('.taxpayer-transaction-panel');
    await expect(panel.getByRole('searchbox',{name:'Search transaction reference'})).toBeVisible();
    await expect(panel.locator('.taxpayer-transaction-row').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),`overflow at ${width}px`).toBeLessThanOrEqual(2);
    await panel.getByRole('button',{name:'Details for Pending bank reconciliation'}).click();
    await expect(page.getByRole('dialog',{name:'Pending bank reconciliation'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),`modal overflow at ${width}px`).toBeLessThanOrEqual(2);
    await page.keyboard.press('Escape');
  }
});
