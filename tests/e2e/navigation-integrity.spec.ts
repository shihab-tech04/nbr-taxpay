import {expect, test} from '@playwright/test';

test('public header, FAQ topics, footer links, language and browser history reach their intended destinations', async ({page}) => {
  await page.goto('/?action=landing');
  const publicNav = page.getByRole('navigation',{name:'Primary navigation'});
  if (page.viewportSize()!.width <= 900) await page.getByRole('button',{name:'Menu'}).click();
  await publicNav.getByRole('link',{name:'FAQs'}).click();
  await expect(page).toHaveURL(/action=user_guide/);
  await expect(page.getByRole('heading',{name:'TaxPay user guide'})).toBeVisible();
  await page.getByRole('button',{name:'Travel tax',exact:true}).click();
  await expect(page).toHaveURL(/action=user_guide&category=travel/);
  await expect(page.getByRole('heading',{name:'Travel tax',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Travel tax',exact:true})).toBeVisible();
  // This destination is the same route with a different tab; it must select the target tab.
  await page.getByRole('contentinfo',{name:'TaxPay footer'}).getByRole('button',{name:'Security & support'}).click();
  await expect(page).toHaveURL(/action=user_guide&category=security/);
  await expect(page.getByRole('heading',{name:'Security & support'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Security & support'})).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/action=user_guide&category=travel/);
  await expect(page.getByRole('heading',{name:'Travel tax',exact:true})).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading',{name:'Security & support'})).toBeVisible();
  await page.getByRole('button',{name:'বাংলা'}).first().click();
  await expect(page).toHaveURL(/lang=bn/);
  await page.reload();
  await expect(page.getByRole('heading',{name:'TaxPay ব্যবহার নির্দেশিকা'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'নিরাপত্তা ও সহায়তা'})).toBeVisible();
});

test('public service actions and receipt result return stay in their own public flows', async ({page}) => {
  await page.goto('/?action=landing');
  await page.getByRole('button',{name:'Check payment status & receipt'}).click();
  await expect(page.getByRole('dialog',{name:/Payment status & receipt/})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Close modal'}).click();
  await page.getByRole('button',{name:'Pay travel tax'}).click();
  await expect(page.getByRole('dialog',{name:/Travel tax/})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Close modal'}).click();

  await page.goto('/?action=verify');
  await expect(page.getByRole('heading',{name:'Receipt lookup'})).toBeVisible();
  await page.getByRole('button',{name:/Use reference:/}).first().click();
  await expect(page.getByRole('heading',{name:'TaxPay — Receipt details'})).toBeVisible();
  await page.getByRole('button',{name:'Back to records'}).click();
  await expect(page.getByRole('heading',{name:'Receipt lookup'})).toBeVisible();
  await expect(page).toHaveURL(/action=verify/);
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'TaxPay — Receipt details'})).toHaveCount(0);
});

test('guest menus and bell route to their named services; contextual payment choices survive reload', async ({page}) => {
  await page.goto('/?action=verify');
  // The notifications bell is a mobile-only control; desktop visitors can open
  // the same safe account-notifications destination through its deep link.
  if (page.viewportSize()!.width <= 900) {
    await page.locator('.citizen-header').getByRole('button',{name:'Notifications'}).click();
  } else {
    await page.goto('/?action=account_notifications');
  }
  await expect(page).toHaveURL(/action=account_notifications/);
  await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  await page.getByRole('dialog',{name:'Select payment type'}).getByRole('button',{name:'Advance Tax',exact:true}).click();
  await expect(page).toHaveURL(/action=guest&initialCategory=ADVANCE_TAX/);
  await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toBeVisible();
  await expect(page.getByText('Selected purpose: Advance Tax')).toBeVisible();
});

test('taxpayer desktop sidebar, account sub-menu and payment guide each open the labeled destination',async({page},info)=>{
  test.skip(info.project.name!=='desktop-1280','Desktop sidebar is presented above 900px');
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const rail=page.getByRole('complementary',{name:'Taxpayer desktop navigation'});
  const links=[
    ['Activity','history'],
    ['Tax ledger','ledger'],
    ['Certificates','certificates'],
    ['Corrections','corrections'],
    ['Notifications','account_notifications']
  ] as const;
  for(const [label,route] of links){
    await rail.getByRole('button',{name:label,exact:true}).click();
    await expect(page).toHaveURL(new RegExp('action='+route+'(?:&|$)'));
    await expect(page.locator('main h1').first()).toBeVisible();
  }
  await rail.locator('.taxpayer-reference-account > summary').click();
  await rail.getByRole('button',{name:'Profile',exact:true}).click();
  await expect(page).toHaveURL(/action=account_profile/);
  await rail.getByRole('button',{name:'Profile settings'}).click();
  await expect(page).toHaveURL(/action=account_settings/);
  await rail.getByRole('button',{name:'Payment guide'}).click();
  await expect(page).toHaveURL(/action=user_guide&category=payments/);
  await expect(page.getByRole('heading',{name:'TaxPay user guide'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Guest Income Tax Payment'})).toHaveCount(0);
});

test('taxpayer mobile menu and payment action link to the correct routes in both languages',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Mobile navigation at 375px');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const open=()=>page.getByRole('button',{name:'Open menu'}).first().click();
  await open();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Connected Services'}).click();
  await expect(page).toHaveURL(/action=services/);
  await open();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'Tax Journey'}).click();
  await expect(page).toHaveURL(/action=journey/);
  await page.getByRole('button',{name:'Pay — select payment type'}).click();
  await expect(page).toHaveURL(/action=wizard/);
  await expect(page.locator('.taxpay-payment-wizard')).toBeVisible();
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await open();
  await page.getByRole('dialog',{name:'Services & menu'}).getByRole('button',{name:'বাংলা'}).click();
  await page.getByRole('dialog',{name:'সেবা ও মেনু'}).getByRole('button',{name:'সনদ',exact:true}).click();
  await expect(page).toHaveURL(/action=certificates/);
  await expect(page.getByRole('heading',{name:'সনদের নমুনা'})).toBeVisible();
});

test('every taxpayer mobile service-menu destination matches its visible label',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Full taxpayer menu is exercised at 375px');
  await page.goto('/?action=taxpayer_home');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  const destinations=[
    ['Home','taxpayer_home'],['Activity','history'],['Tax Ledger','ledger'],
    ['Certificates','certificates'],['Corrections','corrections'],
    ['Tax Journey','journey'],['Connected Services','services'],
    ['Notifications','account_notifications'],['Profile','account_profile'],
    ['Profile settings','account_settings'],['Help','guidance']
  ] as const;
  for(const [label,route] of destinations){
    await page.getByRole('button',{name:'Open menu'}).first().click();
    const dialog=page.getByRole('dialog',{name:'Services & menu'});
    await dialog.getByRole('button',{name:label,exact:true}).first().click();
    await expect(page).toHaveURL(new RegExp('action='+route+'(?:&|$)'));
    await expect(page.locator('main h1').first()).toBeVisible();
  }
});

test('unknown destination falls back to Home without leaving an incorrect URL',async({page})=>{
  await page.goto('/?action=missing_destination');
  await expect(page.getByRole('heading',{name:'Understand tax payments. Stay in control.'})).toBeVisible();
  await expect(page).toHaveURL(/action=landing/);
});

test('a sample taxpayer preview restores only its own browser-history entry',async({page})=>{
  await page.goto('/?action=taxpayer_home');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Dashboard summary'})).toBeVisible();
  // The preview is not account authentication or a transferable URL credential.
  await page.goto('/?action=ledger');
  await expect(page.getByRole('heading',{name:'Private taxpayer workspace'})).toBeVisible();
});

test('Officer receipt inspection stays in Officer layout and returns to its exact source list',async({page})=>{
  await page.goto('/?action=payment_search');
  await expect(page.getByRole('heading',{name:'Universal Cross-Treasury Payment Search'})).toBeVisible();
  await page.getByRole('button',{name:'Inspect'}).first().click();
  await expect(page).toHaveURL(/action=payment_details&returnTo=payment_search/);
  await expect(page.getByRole('heading',{name:'TaxPay — Receipt details'})).toBeVisible();
  await expect(page.locator('header.bg-emerald-950')).toBeVisible();
  await expect(page.locator('.citizen-header,.taxpayer-reference-rail')).toHaveCount(0);
  await page.getByRole('button',{name:'Back to records'}).click();
  await expect(page).toHaveURL(/action=payment_search/);
  await expect(page.getByRole('heading',{name:'Universal Cross-Treasury Payment Search'})).toBeVisible();

  await page.getByRole('button',{name:'Inspect'}).first().click();
  await expect(page).toHaveURL(/demoReceipt=rcpt-101/);
  await page.reload();
  await expect(page.locator('header.bg-emerald-950')).toBeVisible();
  await expect(page.getByRole('heading',{name:'TaxPay — Receipt details'})).toBeVisible();
  await expect(page.getByText('AC-2025-09-DEMO-REF-001',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'No Challan Selected'})).toHaveCount(0);
  await page.getByRole('button',{name:'Back to Payment Search'}).click();
  await expect(page).toHaveURL(/action=payment_search/);

  await page.goto('/?action=taxpayer_360');
  const challans=page.getByRole('heading',{name:/Treasury A-Challans Linked to TIN/}).locator('..');
  await challans.getByRole('button',{name:/AC-2025-09-DEMO-REF-001/}).click();
  await expect(page).toHaveURL(/action=payment_details&returnTo=taxpayer_360/);
  await expect(page).toHaveURL(/demoReceipt=rcpt-101/);
  await expect(page.locator('header.bg-emerald-950')).toBeVisible();
  await page.getByRole('button',{name:'Back to records'}).click();
  await expect(page).toHaveURL(/action=taxpayer_360/);
});

test('Taxpayer receipt inspection retains its private navigation and returns to activity',async({page},info)=>{
  // The approved desktop reference rail appears at >=1440px, not at 1280px.
  if(info.project.name==='desktop-1280') await page.setViewportSize({width:1600,height:900});
  await page.goto('/?action=history');
  await page.getByRole('button',{name:'Explore taxpayer workspace'}).click();
  await page.getByRole('button',{name:'Activity',exact:true}).first().click();
  await expect(page).toHaveURL(/action=history/);
  if(page.viewportSize()!.width >= 1440){
    await expect(page.getByRole('complementary',{name:'Taxpayer desktop navigation'})).toBeVisible();
    await page.getByRole('button',{name:'View',exact:true}).first().click();
  } else {
    await page.getByRole('button',{name:'View details'}).first().click();
  }
  await expect(page).toHaveURL(/action=payment_details&returnTo=history/);
  await expect(page.getByRole('heading',{name:'TaxPay — Receipt details'})).toBeVisible();
  await expect(page).toHaveURL(/demoReceipt=rcpt-101/);
  await page.reload();
  await expect(page.getByRole('heading',{name:'TaxPay — Receipt details'})).toBeVisible();
  await expect(page.getByText('AC-2025-09-DEMO-REF-001',{exact:true})).toBeVisible();
  if(page.viewportSize()!.width >= 1440){
    await expect(page.getByRole('complementary',{name:'Taxpayer desktop navigation'})).toBeVisible();
  }
  await page.getByRole('button',{name:'Back to records'}).click();
  await expect(page).toHaveURL(/action=history/);
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
});

test('Officer modules, receipt rows and ontology choices are keyboard-operable',async({page})=>{
  await page.goto('/?action=officer_home');
  const searchLink=page.getByRole('link',{name:/Universal Payment Search/});
  await expect(searchLink).toHaveAttribute('href','?action=payment_search');
  await searchLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/action=payment_search/);
  await expect(page.getByRole('heading',{name:'Universal Cross-Treasury Payment Search'})).toBeVisible();

  await page.goto('/?action=taxpayer_360');
  const receipt=page.getByRole('button',{name:/AC-2025-09-DEMO-REF-001/});
  await receipt.focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/action=payment_details&returnTo=taxpayer_360&demoReceipt=rcpt-101/);
  await expect(page.getByRole('heading',{name:'TaxPay — Receipt details'})).toBeVisible();

  await page.goto('/?action=ontology');
  const payer=page.getByRole('button',{name:/Payer \(Ortho-prodan-kari\)/});
  await expect(payer).toHaveAttribute('aria-pressed','false');
  await payer.focus();
  await page.keyboard.press('Space');
  await expect(payer).toHaveAttribute('aria-pressed','true');
});
