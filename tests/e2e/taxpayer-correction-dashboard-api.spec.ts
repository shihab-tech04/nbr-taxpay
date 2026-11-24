import {expect,test} from '@playwright/test';

test('connected User1 correction dashboard uses authoritative year-scoped history and retries unavailable data',async({page})=>{
  await page.addInitScript(()=>{
    sessionStorage.setItem('taxpay-taxpayer-preview-user','user1');
    sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({
      profileId:'user1',
      capability:'A'.repeat(43),
      paymentSessionId:'00000000-0000-4000-8000-000000000001',
      language:'en',
      selectedListId:null
    }));
  });
  await page.route('**/auth/v1/user',route=>route.fulfill({
    status:401,contentType:'application/json',body:'{"message":"No application Auth session"}'
  }));
  // Explicit API fixtures test the source contract; real persistence is independently
  // covered by demo-profile-persistence-real-local.spec.ts against disposable SQL.
  let correctionUnavailable=false;
  const correctionRows=['DEMO-PAY-01','DEMO-PAY-02'].map((reference,i)=>({
    id:'00000000-0000-4000-8000-00000000000'+(i+2),paymentId:null,originalReference:reference,
    allocationIndex:null,allocationId:null,currentAY:i===0?'2025-2026':'2025-26',proposedAY:'2024-2025',
    currentCircle:'',proposedCircle:'',currentHeadCode:'',proposedHeadCode:'',reason:'Review assessment year '+reference,
    createdAt:'2026-11-24T01:00:00Z',status:'RECORDED',officeSyncState:'ACKNOWLEDGED',reviewState:'PENDING_OFFICER'
  }));
  await page.route(url=>url.pathname.endsWith('/demo-story1-taxpay/corrections'),async route=>{
    const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'apikey, content-type, x-taxpay-guest-capability'};
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    expect(route.request().headers()['x-taxpay-guest-capability']).toBe('A'.repeat(43));
    await route.fulfill({status:correctionUnavailable?503:200,headers,contentType:'application/json',
      body:JSON.stringify(correctionUnavailable?{success:false}:{success:true,simulationOnly:true,data:correctionRows})});
  });
  await page.route(url=>url.pathname.endsWith('/demo-story1-taxpay/payments'),async route=>{
    const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'apikey, content-type, x-taxpay-guest-capability'};
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({success:true,simulationOnly:true,data:{items:[],total:0}})});
  });
  await page.goto('/?action=taxpayer_home&scenarioYear=2025-2026');
  await expect(page.getByRole('heading',{name:'Your tax overview'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2025-2026');
  const overview=page.getByTestId('taxpayer-overview-bento');
  await expect(overview.getByTestId('dashboard-source-indicator')).toContainText('Payments linked to this session');
  await expect(overview.locator('.taxpay-summary-metric--completed strong')).toHaveText('0');
  await expect(overview.locator('.taxpay-summary-metric--requests strong')).toHaveText('2');
  await overview.locator('.taxpay-summary-metric--requests').click();
  await expect(overview.getByTestId('dashboard-recorded-corrections').getByRole('listitem')).toHaveCount(2);
  await expect(overview.getByTestId('dashboard-recorded-corrections')).toContainText('DEMO-PAY-01');
  await expect(overview.getByTestId('dashboard-correction-request-list')).toHaveCount(0);
  const chart=overview.getByTestId('dashboard-payment-analytics');
  await expect(chart).toHaveAttribute('data-chart-source','recorded');
  await expect(overview).not.toContainText('113,500');
  await expect(overview).not.toContainText('Tax with return — part 2');
  await expect(chart.getByTestId('dashboard-chart-source')).toHaveCount(0);
  await overview.locator('.taxpay-summary-metric--completed').click();
  await expect(page.getByRole('heading',{name:'Payments & activity'})).toBeVisible();
  await expect(page.getByTestId('user1-synthetic-workspace')).not.toContainText('DEMO-PAY-');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2025-2026');

  // Changing the selected year updates the same preview projection and never
  // treats pending/failed/withheld transactions as completed payments.
  await page.goto('/?action=taxpayer_home&scenarioYear=2024-2025');
  await expect(page.getByRole('combobox',{name:'Assessment year'})).toHaveValue('2024-2025');
  await expect(page.getByTestId('taxpayer-overview-bento')
    .locator('.taxpay-summary-metric--completed strong')).toHaveText('0');
  await expect(page.getByTestId('taxpayer-overview-bento')
    .locator('.taxpay-summary-metric--requests strong')).toHaveText('0');
  // A failed authoritative read is neither zero nor a sample count.
  correctionUnavailable=true;
  await page.reload();
  await expect(overview.locator('.taxpay-summary-metric--requests strong')).toHaveText('—');
  await overview.locator('.taxpay-summary-metric--requests').click();
  await expect(overview.getByRole('alert').filter({hasText:'Correction request history unavailable.'})).toBeVisible();
  correctionUnavailable=false;
  await overview.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(overview.locator('.taxpay-summary-metric--requests strong')).toHaveText('0');
});

