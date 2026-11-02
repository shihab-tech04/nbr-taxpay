import {expect,test} from '@playwright/test';

const ledger='/?action=ledger&demoUser=user1';
const history='/?action=history&demoUser=user1';

test('event-based tax ledger filters recorded entries, changes year and opens source details',async({page})=>{
  await page.goto(ledger);
  const events=page.getByTestId('event-tax-ledger');
  await expect(events).toBeVisible();
  await expect(events.getByRole('navigation',{name:'Event categories'})).toBeVisible();
  await expect(events.getByRole('columnheader',{name:'Date / time'})).toBeVisible();
  await expect(events.getByRole('columnheader',{name:'Year · component'})).toBeVisible();
  await expect(events.getByRole('columnheader',{name:'Actor · source'})).toBeVisible();
  await expect(events.getByText('Not verified')).toBeVisible();

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
  await expect(page.getByText('Salary withholding').first()).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
