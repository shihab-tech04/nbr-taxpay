import {expect,test} from '@playwright/test';

test('generic taxpayer preview shows the same payer receipts in dashboard and activity but no invented ledger credits',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await expect(page.getByRole('heading',{name:'Overview'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'No activity to summarize'})).toHaveCount(0);
  await expect(page.getByText('AC-2025-06-DEMO-REF-003').filter({visible:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Open transaction history'}).click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.locator('.taxpay-office-register__count')).toContainText('3');
  await expect(page.getByText('AC-2025-06-DEMO-REF-003').filter({visible:true}).first()).toBeVisible();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  if (await rail.isVisible()) await rail.getByRole('button',{name:'Tax ledger',exact:true}).click();
  else await page.getByRole('button',{name:'Tax Ledger',exact:true}).filter({visible:true}).first().click();
  await expect(page.getByRole('heading',{name:'Tax ledger'})).toBeVisible();
  await expect(page.getByTestId('event-tax-ledger')).toBeVisible();
  await expect(page.getByTestId('event-tax-ledger')).toContainText('Not verified');
  await expect(page.getByRole('button',{name:'Export ledger data'})).toBeDisabled();
  await expect(page.getByText('৳ 1,49,500')).toHaveCount(0);
  await expect(page.getByText('AC-2025-09-DEMO-REF-001')).toHaveCount(0);
});

test('other URL-selected fictional accounts do not inherit shared financial balances, receipts or correction submissions',async({page})=>{
  await page.goto('/?action=ledger&demoUser=user2');
  await expect(page.getByTestId('event-tax-ledger')).toBeVisible();
  await expect(page.getByTestId('event-tax-ledger')).toContainText('Not verified');
  await expect(page.getByText('৳ 1,49,500')).toHaveCount(0);
  await page.goto('/?action=history&demoUser=user2');
  await expect(page.getByRole('heading',{name:'Sign in to manage payments'})).toBeVisible();
  await page.goto('/?action=certificates&demoUser=user2');
  await expect(page.getByRole('heading',{name:'Receipts & payment records'})).toBeVisible();
  // Certificate totals now belong inside the shared document modal, not the list page.
  await page.getByRole('button',{name:'Annual payment summary',exact:true}).click();
  const certificate = page.getByRole('dialog',{name:'Certificate summary'});
  await expect(certificate.locator('[data-testid="certificate-summary-document"]')).toBeVisible();
  await expect(certificate.locator('.receipt-view__amount strong')).toContainText(/৳ 0|Unavailable/);
  await expect(certificate.getByText('৳ 1,49,500')).toHaveCount(0);
  await certificate.getByRole('button',{name:'Close modal'}).click();
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

for(const language of ['en','bn'] as const){
  test('payment-record search remains readable across approved widths in '+language,async({page},info)=>{
    test.skip(info.project.name!=='desktop-1280','Run the full responsive matrix once per language');
    const label=language==='en'?'Find a payment record':'পেমেন্ট রেকর্ড খুঁজুন';
    const placeholder=language==='en'?'Reference or TIN':'রেফারেন্স বা টিআইএন';
    await page.goto('/?action=certificates&demoUser=user2&lang='+language);
    const register=page.getByTestId('account-certificate-record-register');
    await expect(register).toBeVisible();
    const toolbar=register.locator('.taxpay-office-register__toolbar');
    const search=toolbar.getByRole('searchbox',{name:label});
    const searchField=toolbar.locator('.taxpay-office-register__search > .taxpay-record-toolbar__search');
    await expect(toolbar.locator('.taxpay-office-register__search-label')).toHaveText(label);
    await expect(searchField).toBeVisible();
    await expect(search).toHaveAttribute('placeholder',placeholder);
    await expect(search).toHaveAttribute('title',placeholder);
    for(const width of [320,375,390,768,1280,1920]){
      await page.setViewportSize({width,height:900});
      const [searchBox,toolbarBox]=await Promise.all([searchField.boundingBox(),toolbar.boundingBox()]);
      expect(searchBox&&toolbarBox&&searchBox.width>=(width<768?200:145),language+' payment-record search field width at '+width+'px').toBe(true);
      expect(searchBox&&toolbarBox&&searchBox.x>=toolbarBox.x-1&&searchBox.x+searchBox.width<=toolbarBox.x+toolbarBox.width+1,
        language+' payment-record search field containment at '+width+'px').toBe(true);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      expect(overflow,language+' payment-record viewport overflow at '+width+'px').toBeLessThanOrEqual(2);
    }
  });
}
