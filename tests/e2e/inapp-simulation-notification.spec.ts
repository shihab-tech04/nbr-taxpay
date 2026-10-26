import {expect,test,type Page} from '@playwright/test';

const session = '22222222-2222-4222-8222-222222222222';
const paymentId = '33333333-3333-4333-8333-333333333333';

async function mockSessionNotifications(page:Page, amountMinor:number|null) {
  await page.addInitScript(({session}) => {
    sessionStorage.setItem('taxpay-guest-simulation-session',session);
    sessionStorage.setItem('taxpay-guest-story-payment','true');
  }, {session});
  await page.route('**/functions/v1/demo-story1-taxpay/notifications?**', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[
      {id:10,paymentId,type:'SIMULATED_PAYMENT_SUCCESS',createdAt:'2026-10-24T10:00:00Z'}
    ]})});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/payments?**', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:{
      items:amountMinor===null?[]:[{id:paymentId,service:'TAX_WITH_RETURN',amountMinor,status:'SIMULATED_SUCCESS',createdAt:'2026-10-24T10:00:00Z'}],
      total:amountMinor===null?0:1
    }})});
  });
}

test('in-app notice shows the exact SQL amount and says no funds moved',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Session-notice regression on mobile layout');
  await mockSessionNotifications(page,125050);
  await page.goto('/?action=notifications');
  await expect(page.getByRole('heading',{name:'Payment simulation recorded · No money transferred'})).toBeVisible();
  await expect(page.getByText('Simulated amount: ৳1,250.50')).toBeVisible();
  await expect(page.getByText('Payment completed successfully')).toHaveCount(0);
});

test('in-app notice fails closed if stored payment amount cannot be verified',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Session-notice regression on mobile layout');
  await mockSessionNotifications(page,null);
  await page.goto('/?action=notifications');
  await expect(page.getByRole('alert')).toContainText('Could not verify the simulated amount');
  await expect(page.getByText(/Simulated amount:/)).toHaveCount(0);
});

test('preview account notifications show only the payer’s recorded simulation amounts',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Synthetic account notification regression on mobile');
  await page.addInitScript(()=>sessionStorage.setItem('taxpay-taxpayer-preview-user','user1'));
  await page.route('**/rest/v1/rpc/demo_story1_demo_history',async route=>{
    const payment=(payer:string,amountMinor:number)=>({
      id:'id-'+payer,transactionId:'txn-'+payer,payer,state:'SIMULATED',
      createdAt:'2026-10-24T10:00:00Z',simulationOnly:true,totalMinor:amountMinor,
      reviewStatus:'PENDING_OFFICER',allocations:[],events:[]
    });
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
      payment('user1',234567),payment('user2',999999)
    ])});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?**',async route=>{
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[]})});
  });
  await page.goto('/?action=notifications');
  await expect(page.getByRole('heading',{name:'Payment simulation updates'})).toBeVisible();
  await expect(page.getByText('৳2,345.67')).toBeVisible();
  await expect(page.getByText('৳9,999.99')).toHaveCount(0);
  await expect(page.getByText('No funds transferred or tax credit issued.',{exact:false})).toBeVisible();
});

test('beneficiary in-app notification shows only allocated demo amount, not payer total',async({page},info)=>{
  test.skip(info.project.name!=='mobile-375','Account-scoped allocation notification regression');
  await page.addInitScript(()=>sessionStorage.setItem('taxpay-taxpayer-preview-user','user1'));
  await page.route('**/rest/v1/rpc/demo_story1_demo_history',async route=>{
    const body=route.request().postDataJSON() as {p_actor:string;p_view:string};
    expect(body.p_actor).toBe('user1');
    const beneficiary={
      id:'SIM-bene-1',transactionId:'60000000-0000-4000-8000-000000000001',
      payer:'user4',state:'SIMULATED',createdAt:'2026-10-24T13:00:00Z',
      simulationOnly:true,totalMinor:125000,reviewStatus:'MIRRORED_TO_OFFICE',
      allocations:[{id:'line-1',lineNo:1,beneficiary:'user1',category:'TAX_WITH_RETURN',
        assessmentYear:'2026-27',amountMinor:3250}],events:[],
    };
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(body.p_view==='beneficiary'?[beneficiary]:[])});
  });
  await page.goto('/?action=notifications');
  await expect(page.getByRole('heading',{name:'Payment simulation updates'})).toBeVisible();
  await expect(page.getByText('৳32.50')).toBeVisible();
  await expect(page.getByText('Allocated to you in a simulation by user4')).toBeVisible();
  await expect(page.getByText('৳1,250.00')).toHaveCount(0);
  await expect(page.getByText('No funds transferred or tax credit issued.',{exact:false})).toBeVisible();
});

test('preview account also shows this browser session SQL payment notice', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-375', 'Session notification regression');
  await mockSessionNotifications(page, 125050);
  await page.addInitScript(() => sessionStorage.setItem('taxpay-taxpayer-preview-user', 'user1'));
  await page.route('**/rest/v1/rpc/demo_story1_demo_history', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/functions/v1/demo-story1-taxpay/authorizations?**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await page.goto('/?action=notifications');
  await expect(page.getByRole('heading', { name: 'This browser’s payment notifications' })).toBeVisible();
  await expect(page.getByText('Amount: ৳1,250.50')).toBeVisible();
});


test('guest bell opens a public session-only SQL payment notification without account access', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-375', 'Guest bell regression on mobile layout');
  await mockSessionNotifications(page, 125050);
  await page.goto('/?action=verify');
  await page.getByRole('button', { name: 'Notifications' }).first().click();
  await expect(page).toHaveURL(/action=payment_notifications/);
  await expect(page.getByRole('heading', { name: 'Payment simulation recorded · No money transferred' })).toBeVisible();
  await expect(page.getByText('Simulated amount: ৳1,250.50')).toBeVisible();
  await expect(page.getByText('No stored draft activity for this account.')).toHaveCount(0);
});
