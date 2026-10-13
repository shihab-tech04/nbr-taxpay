import {test,expect} from '@playwright/test';

const url='https://eyqhoavnitkrajvyqvxn.supabase.co/rest/v1/rpc/';
const simulatedTransaction={
  id:'SIM-TEST-001',transactionId:'T-TEST-001',payer:'user1',state:'SIMULATED',
  createdAt:'2026-10-13T08:00:00Z',simulationOnly:true,totalMinor:12050,
  reviewStatus:'PENDING',allocations:[{
    id:'AL-TEST-001',lineNo:1,beneficiary:'user1',
    category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:12050
  }],events:[]
};

async function start(page:import('@playwright/test').Page){
  await page.goto('/?action=taxpayer_home&demoUser=user1');
  await page.locator('.citizen-taxpayer-hero__actions').getByRole('button',{name:'Make Payment'}).click();
  await expect(page.getByRole('heading',{name:'Make Payment'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Payment category'})).toBeVisible();
  await page.locator('.taxpay-guided-category').filter({hasText:'Advance Tax'}).click();
  await expect(page.locator('.taxpay-guided-category').filter({hasText:'Advance Tax'})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Category information'})).toBeVisible();
  await page.getByRole('button',{name:/Make payment/i}).last().click();
  await expect(page.getByRole('heading',{name:'Make payment',exact:true})).toBeVisible();
}
test('five-stage category → guidance → allocation → server simulation → readback result',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Payment flow covered on representative mobile viewport');
  let writes=0;
  await page.route(url+'sim_payment_history',async route=>{
    const request=route.request().postDataJSON();
    const rows=request.p_view==='payer'&&writes>0?[simulatedTransaction]:[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});
  });
  await page.route(url+'sim_submit_payment',async route=>{
    writes++;
    const input=route.request().postDataJSON();
    expect(input.p_lines).toEqual([{beneficiary:'user1',category:'ADVANCE_TAX',assessmentYear:'2026-27',amountMinor:12050}]);
    expect(typeof input.p_idempotency_key).toBe('string');
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      transactionId:'T-TEST-001',reference:'SIM-TEST-001',totalMinor:12050,replayed:false
    })});
  });
  await start(page);
  await page.getByRole('textbox',{name:/Amount \(BDT\)/}).fill('120.50');
  await page.getByRole('button',{name:/Review payment/}).click();
  await expect(page.getByRole('heading',{name:'Payment simulation'})).toBeVisible();
  await expect(page.getByText('৳120.50').first()).toBeVisible();
  expect(writes,'No server write before review confirmation').toBe(0);
  await page.getByRole('button',{name:/Run payment simulation/}).click();
  await expect(page.getByRole('heading',{name:'Result'})).toBeVisible();
  await expect(page.getByText('Simulation saved successfully')).toBeVisible();
  await expect(page.getByText('SIM-TEST-001')).toBeVisible();
  await expect(page.getByText(/No funds moved or official tax credit was created/)).toBeVisible();
  expect(writes,'Exactly one SQL operation').toBe(1);
  await expect(page.locator('.taxpay-guided-payment')).toBeVisible();
  await expect(page.locator('.taxpay-taxpayer-reference')).toBeVisible();
});
test('rejects missing amounts and does not show false success on failed readback',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Negative financial gate');
  let writes=0;
  await page.route(url+'sim_payment_history',async route=>await route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.route(url+'sim_submit_payment',async route=>{
    writes++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      transactionId:'T-TEST-001',reference:'SIM-TEST-001',totalMinor:12050,replayed:false
    })});
  });
  await start(page);
  await page.getByRole('button',{name:/Review payment/}).click();
  await expect(page.getByRole('alert')).toContainText('positive amount');
  expect(writes).toBe(0);
  await page.getByRole('textbox',{name:/Amount \(BDT\)/}).fill('120.50');
  await page.getByRole('button',{name:/Review payment/}).click();
  await page.getByRole('button',{name:/Run payment simulation/}).click();
  await expect(page.getByRole('alert')).toContainText('read-back did not reconcile');
  await expect(page.getByText('Simulation saved successfully')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Payment simulation'})).toBeVisible();
  expect(writes).toBe(1);
});