import {expect,test} from '@playwright/test';

test('generic taxpayer preview shows the same payer receipts in dashboard and activity but no invented ledger credits',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'No activity to summarize'})).toHaveCount(0);
  await expect(page.getByText('AC-2025-06-DEMO-REF-003').filter({visible:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Open transaction history'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Search and filters'})).toContainText(/Records\s*:\s*3/);
  await expect(page.getByText('AC-2025-06-DEMO-REF-003').filter({visible:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Tax Ledger',exact:true}).filter({visible:true}).first().click();
  await expect(page.getByRole('heading',{name:'Tax ledger'})).toBeVisible();
  await expect(page.getByText('No ledger records are available for this account yet.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Export ledger data'})).toBeDisabled();
  await expect(page.getByText('BDT 1,49,500')).toHaveCount(0);
  await expect(page.getByText('AC-2025-09-DEMO-REF-001')).toHaveCount(0);
});

test('other URL-selected fictional accounts do not inherit shared financial balances, receipts or correction submissions',async({page})=>{
  await page.goto('/?action=ledger&demoUser=user2');
  await expect(page.getByText('No ledger records are available for this account yet.')).toBeVisible();
  await expect(page.getByText('BDT 1,49,500')).toHaveCount(0);
  await page.goto('/?action=history&demoUser=user2');
  await expect(page.getByRole('heading',{name:'Sign in to manage payments'})).toBeVisible();
  await page.goto('/?action=certificates&demoUser=user2');
  await expect(page.getByRole('heading',{name:'Certificate summaries'})).toBeVisible();
  await expect(page.getByText('Not available',{exact:true}).first()).toBeVisible();
  await page.goto('/?action=corrections&demoUser=user2');
  await expect(page.getByText('No payment records are available for correction.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Save request locally'})).toHaveCount(0);
  await page.goto('/?action=payment_details&demoUser=user2&returnTo=history&demoReceipt=rcpt-101');
  await expect(page.getByRole('heading',{name:'No Challan Selected'})).toBeVisible();
});

test('sample correction picker never lists another payer and does not claim official submission',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Open transaction history'}).click();
  await page.getByRole('navigation',{name:'Activity sections'}).getByRole('button',{name:'Issues & corrections'}).click();
  await expect(page.getByRole('heading',{name:'Tax Payment Challan Correction Requests'})).toBeVisible();
  const picker=page.getByLabel('Select A-Challan for Rectification *');
  await expect(picker.locator('option')).toHaveCount(3);
  await expect(picker.locator('option',{hasText:'AC-2025-09-DEMO-REF-005'})).toHaveCount(0);
  await picker.selectOption('AC-2025-06-DEMO-REF-003');
  await expect(page.getByLabel('Current Assessment Year')).toHaveValue('2025-2026');
  await expect(page.getByLabel('Current payment head',{exact:true})).toHaveValue('1-1141-0015-0201');
  await expect(page.getByLabel('Proposed payment head (unverified options)')).toHaveValue('1-1141-0015-0201');
  await picker.selectOption('AC-2025-09-DEMO-REF-001');
  await expect(page.getByLabel('Current Assessment Year')).toHaveValue('2024-2025');
  await expect(page.getByLabel('Current payment head',{exact:true})).toHaveValue('1-1141-0010-0101');
  await expect(page.getByRole('button',{name:'Save request locally'})).toBeVisible();
});
