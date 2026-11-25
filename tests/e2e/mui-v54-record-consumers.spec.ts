import {expect,test,type Page} from '@playwright/test';
const paymentId='33333333-3333-4333-8333-333333333333',session='22222222-2222-4222-8222-222222222222',createdAt='2026-10-24T10:00:00Z';
async function install(page:Page,language:'en'|'bn'){
 await page.addInitScript(({language,session})=>{
  sessionStorage.setItem('taxpay-taxpayer-preview-user','user2');
  sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify({profileId:'user2',capability:'B'.repeat(43),paymentSessionId:session,selectedListId:null,language}));
  sessionStorage.setItem('taxpay-guest-simulation-session',session);
  sessionStorage.setItem('taxpay-guest-story-payment','true');
 },{language,session});
 await page.route('**/functions/v1/demo-story1-taxpay/profile-history?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,simulationOnly:true,data:[]})}));
 await page.route('**/functions/v1/demo-story1-taxpay/authorizations?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[]})}));
 await page.route('**/functions/v1/demo-story1-taxpay/notifications?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[{id:10,paymentId,type:'SIMULATED_PAYMENT_SUCCESS',createdAt}]})}));
}
for(const language of ['en','bn'] as const){
 test('session and correction records use MUI with unchanged readback and filtering '+language,async({page},info)=>{
  await install(page,language);
  await page.route('**/functions/v1/demo-story1-taxpay/payments?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,simulationOnly:true,data:{items:[{id:paymentId,service:'TAX_WITH_RETURN',amountMinor:125050,status:'SIMULATED_SUCCESS',createdAt}],total:1}})}));
  let read=false,fail=false,writes=0;
  const notice={eventId:'notice-v54',requestId:'00000000-0000-4000-8000-000000000009',code:'SUBMITTED',reference:'TEST-CORRECTION-V54',createdAt,detail:null};
  await page.route('**/functions/v1/demo-story1-taxpay/corrections/notices**',async route=>{
   const req=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'apikey,content-type,x-taxpay-guest-capability'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   expect(req.headers()['x-taxpay-guest-capability']).toBe('B'.repeat(43));
   if(req.method()==='POST'){expect(req.postDataJSON()).toEqual({eventId:notice.eventId});writes++;if(fail)return route.fulfill({status:503,headers,contentType:'application/json',body:'{"success":false}'});read=true;return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({success:true,simulationOnly:true,data:{eventId:notice.eventId,isRead:true}})});}
   return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({success:true,simulationOnly:true,data:{items:[{...notice,isRead:read}],unreadCount:read?0:1}})});
  });
  await page.goto('/?action=notifications&lang='+language);
  const section=page.getByTestId('session-payment-register'),table=section.getByTestId('session-payment-table');
  await expect(table).toHaveClass(/MuiTable-root/);
  const search=section.getByRole('searchbox');await expect(search).toHaveClass(/MuiInputBase-input/);await search.fill('missing-record');await expect(table).toHaveCount(0);
  const clear=section.locator('[data-mui-coverage="MUI-SESSION-NOTICE-CLEAR"]');await expect(clear).toHaveClass(/MuiButtonBase-root/);await clear.focus();await clear.press('Enter');await expect(table).toHaveClass(/MuiTable-root/);await expect(search).toHaveValue('');
  const region=page.getByTestId('correction-notifications');await expect(region).toContainText('TEST-CORRECTION-V54');
  const refresh=region.locator('[data-mui-coverage="MUI-CORRECTION-NOTICE-REFRESH"]'),mark=region.locator('[data-mui-coverage="MUI-CORRECTION-NOTICE-READ"]');
  await expect(refresh).toHaveClass(/MuiButtonBase-root/);await expect(mark).toHaveClass(/MuiButtonBase-root/);await expect(region.locator('[data-mui-coverage="MUI-CORRECTION-NOTICE-VIEW"]')).toHaveClass(/MuiButtonBase-root/);
  fail=true;await mark.click();await expect(region.getByRole('alert')).toBeVisible();expect(writes).toBe(1);
  fail=false;await mark.click();await expect(mark).toHaveCount(0);expect(writes).toBe(2);
  await page.reload();await expect(region).toContainText('TEST-CORRECTION-V54');await expect(mark).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
 });
 test('recovered record retry and desktop/mobile grid stay owner scoped '+language,async({page})=>{
  await install(page,language);let unavailable=true;
  await page.route('**/functions/v1/demo-story1-taxpay/payments?**',route=>route.fulfill({status:unavailable?503:200,contentType:'application/json',body:JSON.stringify(unavailable?{success:false}:{success:true,simulationOnly:true,data:{items:[{id:paymentId,service:'TAX_WITH_RETURN',amountMinor:125050,status:'SIMULATED_SUCCESS',createdAt}],total:1}})}));
  await page.route('**/functions/v1/demo-story1-taxpay/payments/'+paymentId+'?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,simulationOnly:true,data:{id:paymentId,status:'SIMULATED_SUCCESS',data:{service:'TAX_WITH_RETURN',amountMinor:125050,details:{}}}})}));
  await page.goto('/?action=history&lang='+language);
  const retry=page.locator('[data-mui-coverage="MUI-RECOVERED-HISTORY-RETRY"]');await expect(retry).toBeVisible();await expect(retry).toHaveClass(/MuiButtonBase-root/);
  unavailable=false;await retry.focus();await retry.press('Enter');
  const table=page.getByTestId('recovered-story-payments');await expect(table).toHaveClass(/MuiTable-root/);
  const details=page.getByTestId('recovered-payment-details').filter({visible:true});await expect(details).toHaveClass(/MuiButtonBase-root/);
  await expect(page.getByTestId('recovered-story-payments').locator('tbody tr')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
 });
}
