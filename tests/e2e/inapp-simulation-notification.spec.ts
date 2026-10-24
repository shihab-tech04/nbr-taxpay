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
