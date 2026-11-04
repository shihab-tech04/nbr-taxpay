import {expect,test} from '@playwright/test';

const ledger='/?action=ledger&demoUser=user1';
const history='/?action=history&demoUser=user1';

test('event-based tax ledger filters recorded entries, changes year and opens source details',async({page})=>{
  await page.goto(ledger);
  const events=page.getByTestId('event-tax-ledger');
  await expect(events).toBeVisible();
  await expect(events.getByRole('navigation',{name:'Event categories'})).toBeVisible();
  await expect(events.getByRole('navigation',{name:'Event categories'})).toHaveClass(/taxpay-table-tabs/);
  const activeCategory=events.getByRole('button',{name:'All',exact:true});
  await expect(activeCategory).toBeVisible();
  await expect(activeCategory).toHaveAttribute('aria-pressed','true');
  const colors=await activeCategory.evaluate(element=>({
    text:getComputedStyle(element).color,
    background:getComputedStyle(element).backgroundColor,
    width:element.getBoundingClientRect().width
  }));
  expect(colors.text).toBe('rgb(255, 255, 255)');
  expect(colors.background).not.toBe(colors.text);
  expect(colors.width).toBeGreaterThanOrEqual(64);
  await expect(events.locator('.taxpay-table-viewport')).toHaveCount(1);
  await expect(events.getByTestId('event-ledger-table')).toHaveClass(/taxpay-unified-table/);
  if((page.viewportSize()?.width??1280)>=768){
    await expect(events.getByRole('columnheader',{name:'Date / time'})).toBeVisible();
    await expect(events.getByRole('columnheader',{name:'Year · component'})).toBeVisible();
    await expect(events.getByRole('columnheader',{name:'Actor · source'})).toBeVisible();
  }else{
    await expect(events.getByTestId('event-ledger-table')).toBeHidden();
  }
  await expect(events.getByText('Calculated balance for selected year')).toBeVisible();
  await expect(events.getByText('৳ 25,000').first()).toBeVisible();

  await events.getByRole('combobox',{name:'Filter ledger by year'}).selectOption('2025-2026');
  await events.getByRole('button',{name:'Credits'}).click();
  await expect(events.getByRole('button',{name:/Salary withholding/}).first()).toBeVisible();
  await expect(events.getByText('Opening liability')).toHaveCount(0);
  await events.getByRole('button',{name:/Salary withholding/}).first().click();

  const details=page.getByTestId('tax-event-details');
  await expect(details).toBeVisible();
  await expect(details).toContainText('Ledger entry ID');
  await expect(details).toContainText('Source system');
  await expect(details).toContainText('Related references');
  await expect(details).toContainText('DEMO-ETDS-SAL-01');
});

test('historical payment record exposes the complete lifecycle template without invented settlement',async({page})=>{
  await page.goto(history);
  await page.getByRole('button',{name:'Details for Salary withholding'}).click();
  const details=page.getByTestId('payment-lifecycle-details');
  await expect(details).toBeVisible();
  for(const heading of ['Payment identity','Payer & taxpayer','Payment lifecycle','Activity history',
    'Tax treatment','Where this payment counts']){
    await expect(details.getByRole('heading',{name:heading})).toBeVisible();
  }
  await expect(details).toContainText('Assessment year');
  await expect(details).toContainText('Income year');
  await expect(details).toContainText('Payment channel');
  await expect(details).toContainText('Not verified');
});

test('event ledger keeps the mobile viewport free from page-level horizontal overflow',async({page})=>{
  await page.setViewportSize({width:320,height:760});
  await page.goto(ledger);
  await expect(page.getByTestId('event-tax-ledger')).toBeVisible();
  await expect(page.getByTestId('event-ledger-table')).toBeHidden();
  await expect(page.getByTestId('event-tax-ledger').locator('.taxpay-mobile-table-card').first()).toBeVisible();
  await expect(page.getByTestId('event-tax-ledger').getByRole('button',{name:/Salary withholding/}).first()).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});


test('desktop ledger keeps one year control and the complete table within its own scroll region',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto(ledger);
  await expect(page.getByTestId('event-tax-ledger')).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year',exact:true})).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Filter ledger by year'})).toHaveCount(1);
  const table=page.getByTestId('event-ledger-table');
  const scroller=table.locator('..');
  await expect(table).toBeVisible();
  const widths=await scroller.evaluate(el=>({
    scroll:el.scrollWidth,client:el.clientWidth,
    viewport:document.documentElement.scrollWidth-document.documentElement.clientWidth
  }));
  expect(widths.scroll).toBeGreaterThan(widths.client);
  expect(widths.viewport).toBeLessThanOrEqual(2);
});

test('activity filters share one desktop row and details use the shared wide modal',async({page})=>{
  await page.setViewportSize({width:1600,height:900});
  await page.goto(history);
  const controls=page.locator('.taxpayer-transaction-panel .taxpayer-transaction-filters > label');
  await expect(controls).toHaveCount(4);
  const positions=await controls.evaluateAll(nodes=>nodes.map(el=>Math.round(el.getBoundingClientRect().top)));
  expect(new Set(positions).size).toBe(1);
  await page.getByRole('button',{name:'Details for Salary withholding'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByTestId('payment-lifecycle-details')).toBeVisible();
  const dimensions=await dialog.boundingBox();
  expect(dimensions?.width).toBeGreaterThanOrEqual(800);
  await expect(dialog.getByText('Tax circle',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Close transaction details'}).click();
  await expect(dialog).toBeHidden();
});

test('small-screen transaction details stay within a scrollable bottom sheet',async({page})=>{
  await page.setViewportSize({width:320,height:760});
  await page.goto(history);
  await page.getByRole('button',{name:'Details for Salary withholding'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByTestId('payment-lifecycle-details')).toBeVisible();
  const box=await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x+box!.width).toBeLessThanOrEqual(321);
  expect(box!.y+box!.height).toBeGreaterThanOrEqual(758);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

test('payment journey matches the history identities on desktop and mobile',async({page})=>{
  await page.setViewportSize({width:320,height:760});
  await page.goto(history);
  await page.getByRole('navigation',{name:'Activity sections'}).getByRole('button',{name:'Tax journey'}).click();
  const timeline=page.getByTestId('taxpay-payment-journey');
  await expect(timeline).toBeVisible();
  await expect(timeline.getByText('DEMO-PAY-02')).toBeVisible();
  await expect(timeline.getByText('DEMO-PAY-24-01')).toBeVisible();
  await expect(timeline.locator('li')).toHaveCount(21);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});


test('mobile ledger preserves financial fields, source and unverified balance in English and Bengali',async({page})=>{
  await page.setViewportSize({width:320,height:760});
  for(const language of ['en','bn'] as const){
    await page.goto(ledger+'&lang='+language);
    const panel=page.getByTestId('event-tax-ledger');
    const card=panel.locator('.taxpay-mobile-table-card').first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(language==='bn'?'নথিভুক্ত পরিমাণ':'Recorded amount');
    await expect(card).toContainText(language==='bn'?'ব্যালেন্সের প্রভাব':'Effect on balance');
    await expect(card).toContainText(language==='bn'?'পরবর্তী ব্যালেন্স':'balance after');
    await expect(card).toContainText(language==='bn'?'নথিভুক্ত অবস্থা':'Recorded status');
    await expect(card).toContainText(language==='bn'?'উৎস':'Source');
    await expect(panel.getByTestId('event-ledger-table')).toBeHidden();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'mobile financial fields must not widen the page').toBeLessThanOrEqual(2);
    await card.getByRole('button').click();
    await expect(page.getByTestId('tax-event-details')).toBeVisible();
    await page.getByRole('dialog').getByRole('button',{name:/Close/i}).first().click();
  }
});


test('ledger filtered-empty state does not display a duplicate empty financial table or card list',async({page})=>{
  await page.goto(ledger);
  const panel=page.getByTestId('event-tax-ledger');
  await panel.getByRole('combobox',{name:'Filter ledger by year'}).selectOption('2024-2025');
  await panel.getByRole('button',{name:'Refunds',exact:true}).click();
  await expect(panel.locator('.taxpay-table-state')).toContainText('No recorded events match the selected filters.');
  await expect(panel.getByTestId('event-ledger-table')).toHaveCount(0);
  await expect(panel.locator('.taxpay-mobile-table-card')).toHaveCount(0);
});


test('all six ledger categories retain their own source events and selection state',async({page})=>{
  await page.goto(ledger);
  const panel=page.getByTestId('event-tax-ledger');
  await expect(panel.getByRole('button',{name:'All',exact:true})).toHaveAttribute('aria-pressed','true');
  for(const [category,record] of [
    ['Liabilities','Opening liability'],
    ['Credits','Salary withholding'],
    ['Payment lifecycle','Pending bank reconciliation'],
    ['Corrections','Credit reassignment inquiry'],
    ['Refunds','Refund inquiry']
  ] as const){
    const tab=panel.getByRole('button',{name:category,exact:true});
    await tab.click();
    await expect(tab).toHaveAttribute('aria-pressed','true');
    await expect(panel.getByRole('button',{name:new RegExp(record)}).first()).toBeVisible();
  }
});
