import {expect,test} from '@playwright/test';

test('Activity keeps its seven-column table and shows beneficiary filters without inventing identities',async({page})=>{
  await page.goto('/?action=history&demoUser=user1');
  const panel=page.locator('.taxpayer-transaction-panel');
  await expect(panel.getByRole('heading',{name:'Transaction history'})).toBeVisible();
  await expect(panel.getByTestId('taxpayer-transaction-table').locator('thead th')).toHaveCount(7);
  await panel.getByRole('button',{name:'Filter',exact:true}).click();
  await expect(panel.getByRole('combobox',{name:'Filter transactions by beneficiary'})).toBeVisible();
  await expect(panel.getByRole('combobox',{name:'Filter transactions by beneficiary tag'})).toBeVisible();
  const pending=panel.getByTestId('taxpayer-transaction-table').locator('tbody tr')
    .filter({hasText:'Pending bank reconciliation'});
  await expect(pending).toBeVisible();
  await expect(pending.getByRole('button',{name:/Open beneficiary profile for/})).toHaveCount(0);
  await expect(pending.getByText('No beneficiary linked')).toBeVisible();
});

test('Activity beneficiary metadata does not overflow on mobile',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Mobile table acceptance');
  await page.goto('/?action=history&demoUser=user1');
  const panel=page.locator('.taxpayer-transaction-panel');
  await expect(panel.getByTestId('taxpayer-transaction-mobile-cards')).toBeVisible();
  await expect(panel.getByTestId('transaction-beneficiaries').first()).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
