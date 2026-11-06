import {expect,test} from '@playwright/test';

const history='/?action=history&demoUser=user1';

test('history uses one content panel and aligned, legible payment rows',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Representative desktop transaction layout');
  await page.goto(history);
  const workspace=page.getByTestId('user1-synthetic-workspace');
  const panel=workspace.locator('.taxpayer-transaction-panel');
  const rows=panel.getByTestId('taxpayer-transaction-table').locator('tbody tr');

  await expect(panel.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(workspace.getByText('Payment & activity count')).toHaveCount(0);
  await expect(panel.getByText('Records: 14')).toBeVisible();
  const toolbar=panel.getByTestId('convay-table-toolbar');
  const filters=panel.getByTestId('convay-table-filters');
  await expect(toolbar).toBeVisible();
  await expect(filters).toBeVisible();
  await expect(toolbar.getByRole('button',{name:'Export CSV'})).toBeVisible();
  const visuals=await Promise.all([toolbar,filters].map(element=>element.evaluate(node=>{
    const box=node.getBoundingClientRect();
    const style=getComputedStyle(node);
    return {y:box.y,bottom:box.bottom,background:style.backgroundColor,borderBottom:style.borderBottomWidth};
  })));
  expect(visuals[0].bottom).toBeLessThanOrEqual(visuals[1].y+2);
  expect(visuals[0].background).not.toBe(visuals[1].background);
  expect(visuals[0].borderBottom).toBe('1px');
  await expect(rows).toHaveCount(10);
  await expect(panel.getByTestId('taxpayer-transaction-table').locator('thead th')).toHaveText(['Payment','Reference','Payment type','Date','Amount','Status','Actions']);
  await expect(panel.getByRole('navigation',{name:'Page navigation'})).toBeVisible();

  const first=rows.first();
  const positions=await first.evaluate(row=>{
    const bounds=(selector:string)=>row.querySelector(selector)!.getBoundingClientRect();
    const cells=Array.from(row.querySelectorAll('td'));
    return cells.map(cell=>({left:cell.getBoundingClientRect().left,right:cell.getBoundingClientRect().right}));
  });
  expect(positions).toHaveLength(7);
  for(let i=1;i<positions.length;i++)expect(positions[i].left).toBeGreaterThanOrEqual(positions[i-1].right-1);
  expect(positions[4].left).toBeGreaterThan(positions[3].left);

  await first.getByRole('button',{name:'Details for Pending bank reconciliation'}).click();
  const dialog=page.getByRole('dialog',{name:'Pending bank reconciliation'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('৳ 14,000')).toBeVisible();
  await expect(dialog.getByText('DEMO-PAY-PEND-01')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Close'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(first.getByRole('button',{name:'Details for Pending bank reconciliation'})).toBeFocused();

  await panel.getByRole('navigation',{name:'Page navigation'}).getByRole('button',{name:'Next'}).click();
  await expect(rows).toHaveCount(4);
  await expect(panel.getByText('Showing 11–14 of 14 records')).toBeVisible();
  await panel.getByRole('combobox',{name:'Transaction category'}).selectOption('refund');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByText('Refund inquiry',{exact:true}).first()).toBeVisible();
  await panel.getByRole('combobox',{name:'Transaction category'}).selectOption('all');
  await expect(rows).toHaveCount(10);
  await expect(rows.first().getByText('Pending bank reconciliation',{exact:true}).first()).toBeVisible();
  await panel.getByRole('navigation',{name:'Page navigation'}).getByRole('button',{name:'Next'}).click();
  await expect(rows).toHaveCount(4);
  await panel.getByRole('navigation',{name:'Page navigation'}).getByRole('button',{name:'Previous'}).click();
  await expect(rows).toHaveCount(10);
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
    const visibleRows=width>=768 ? panel.getByTestId('taxpayer-transaction-table').locator('tbody tr') : panel.getByTestId('taxpayer-transaction-mobile-cards').locator(':scope > li');
    await expect(visibleRows.first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),`overflow at ${width}px`).toBeLessThanOrEqual(2);
    await panel.getByRole('button',{name:'Details for Pending bank reconciliation'}).click();
    await expect(page.getByRole('dialog',{name:'Pending bank reconciliation'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),`modal overflow at ${width}px`).toBeLessThanOrEqual(2);
    await page.keyboard.press('Escape');
  }
});


test('signed-in Activity has no separate Track payment tab and legacy tracking links resolve to Transactions',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Navigation and account history regression');
  for(const language of ['en','bn'] as const){
    await page.goto('/?action=history&demoUser=user1&trackPayment=true&lang='+language);
    await expect(page.getByRole('navigation',{name:language==='bn'?'লেনদেনের বিভাগ':'Activity sections'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Track payment'})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'পেমেন্ট অনুসন্ধান'})).toHaveCount(0);
    await expect(page.getByTestId('user1-synthetic-workspace').locator('.taxpayer-transaction-panel')).toBeVisible();
    await expect(page.getByTestId('user1-synthetic-workspace').getByTestId('taxpayer-transaction-table').locator('tbody tr')).toHaveCount(10);
    await expect(page.getByTestId('user1-synthetic-workspace').locator('.taxpay-table-pagination')).toBeVisible();
    await expect(page.locator('.receipt-lookup')).toHaveCount(0);
    await expect(page.getByRole('button',{name:language==='bn'?'লেনদেনসমূহ':'Transactions'})).toHaveAttribute('aria-current','page');
  }
});
