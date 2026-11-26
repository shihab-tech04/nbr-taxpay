import {expect,test} from '@playwright/test';

const capability='A'.repeat(43),paymentSessionId='00000000-0000-4000-8000-000000004444';
const paymentId='00000000-0000-4000-8000-000000005511',eventId=paymentId+':allocation:1';
const reportId='00000000-0000-4000-8000-000000005512',allocationId='recipient-alloc-01';
const createdAt='2026-11-25T10:30:00Z',reason='I did not recognize this simulated payment.';
for(const language of ['en','bn'] as const){
 test('disposable report refresh failure retains confirmed status and recovers ('+language+')',async({page})=>{
  test.skip(process.env.VITE_RECIPIENT_NOTICE_FEED_ENABLED!=='true','Requires existing fictional recipient feed flag.');
  const bn=language==='bn';
  const tr=(en:string,বাংলা:string)=>bn?বাংলা:en;
  const settings={profileId:'user2',capability,paymentSessionId,language,selectedListId:null};
  let read=false,completed=false,reported=false,officeAck=false,reviewed=false,posts=0,requestKey:string|undefined;
  let failRefresh=false;
  const notice=()=>({eventId,paymentId,allocationId,recipientTin:null,serviceCode:'GIFT_TAX',headId:'GIFT',assessmentYear:'2026-27',amountMinor:12345,receiptReference:'FIXTURE-5511',createdAt,payerName:'Recorded payer',paymentStatus:completed?'SIMULATED_SUCCESS':'SIMULATED_INITIATED',isRead:read,acknowledgedAt:read?createdAt:null});
  const report=()=>({id:reportId,paymentId,originalReference:'FIXTURE-5511',allocationId,allocationIndex:0,caseKind:'UNSOLICITED_PAYMENT_REPORT',recipientEventId:eventId,paymentCompleted:completed,currentAY:'2026-27',proposedAY:'2026-27',currentCircle:'',proposedCircle:'',currentHeadCode:'GIFT',proposedHeadCode:'GIFT',reason,createdAt,status:'RECORDED',officeSyncState:officeAck?'ACKNOWLEDGED':'PENDING',reviewState:reviewed?'MAKER_ACKNOWLEDGED':'PENDING_OFFICER'});
  await page.addInitScript(s=>{
   if(!sessionStorage.getItem('fixture-session-initialized')){
    sessionStorage.setItem('fixture-session-initialized','1');
    sessionStorage.setItem('taxpay-taxpayer-preview-user',s.profileId);
    sessionStorage.setItem('korbritto.demo-profile-session.v1',JSON.stringify(s));
   }
  },settings);
  await page.route('**/auth/v1/user',route=>route.fulfill({status:401,json:{}}));
  await page.route('**/functions/v1/taxpay-guest-beneficiaries',async route=>{
   const input=route.request().postDataJSON() as Record<string,unknown>;
   const send=(data:unknown)=>route.fulfill({json:{success:true,data}});
   if(input.action==='demo-settings'||input.action==='demo-login')return send(settings);
   if(input.action==='received-notices-ack'){
    expect(route.request().headers()['x-taxpay-guest-capability']).toBe(capability);
    expect(input.eventId).toBe(eventId);read=true;return send({eventId,isRead:true,acknowledgedAt:createdAt});
   }
   if(input.action==='received-notices-list'||input.action==='received-notices-unread'){
    expect(route.request().headers()['x-taxpay-guest-capability']).toBe(capability);
    const items=input.action==='received-notices-unread'&&read?[]:[notice()];
    return send({items,total:items.length,offset:input.offset,limit:input.limit,hasMore:false});
   }
   if(['lists','people','payment-draft-list'].includes(String(input.action)))return send([]);
   if(input.action==='open')return send({active:true});
   return route.fulfill({status:404,json:{success:false}});
  });
  await page.route('**/functions/v1/demo-story1-taxpay/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   const send=(data:unknown)=>route.fulfill({json:{success:true,simulationOnly:true,data}});
   if(url.pathname.endsWith('/corrections/notices')){
    const items=reported?[{eventId:'fixture-status-1',requestId:reportId,code:reviewed?'REPORT_MAKER_ACKNOWLEDGED':'REPORT_RECORDED',reference:'FIXTURE-5511',createdAt,detail:null,isRead:false}]:[];
    return send({items,unreadCount:items.length});
   }
   if(url.pathname.endsWith('/corrections')){
    expect(request.headers()['x-taxpay-guest-capability']).toBe(capability);
    if(request.method()==='GET'){
     if(failRefresh)return route.fulfill({status:503,json:{success:false}});
     return send(reported?[report()]:[]);
    }
    const body=request.postDataJSON();
    expect(body).toMatchObject({caseKind:'UNSOLICITED_PAYMENT_REPORT',eventId,reason});
    expect(Object.keys(body).sort()).toEqual(['caseKind','eventId','reason','requestKey']);
    if(requestKey)expect(body.requestKey).toBe(requestKey);else requestKey=body.requestKey;
    posts++;
    if(posts===1)return route.fulfill({status:503,json:{success:false}});
    reported=true;
    if(posts===3){officeAck=true;}
    return send(report());
   }
   if(url.pathname.endsWith('/profile-history')||url.pathname.endsWith('/authorizations'))return send([]);
   return route.fulfill({status:404,json:{success:false}});
  });
  await page.goto('/?action=taxpayer_home&lang='+language);
  const popup=page.getByTestId('received-payment-notice');
  await expect(popup).toBeVisible();
  const initial=page.getByRole('dialog',{name:tr('A payment has been initiated on your behalf','আপনার পক্ষ থেকে একটি পেমেন্ট শুরু হয়েছে')});
  await expect(initial).toBeVisible();
  await expect(popup.locator('dt')).toHaveCount(7);
  await initial.getByRole('button',{name:tr('Report Payment','পেমেন্ট রিপোর্ট করুন'),exact:true}).click();
  const dialog=page.getByRole('dialog',{name:tr('Report Payment','পেমেন্ট রিপোর্ট করুন'),exact:true});
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/action=corrections/);
  const submit=dialog.getByRole('button',{name:tr('Submit Report','রিপোর্ট জমা দিন'),exact:true});
  await expect(submit).toBeDisabled();
  await dialog.getByRole('textbox').fill(reason);
  await submit.click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await submit.click();
  await expect(dialog).toContainText(reportId);
  await expect(dialog).toContainText(tr('Awaiting Office','অফিসে পাঠানো হচ্ছে'));
  await dialog.getByRole('button',{name:tr('Retry Office delivery','অফিসে আবার পাঠান'),exact:true}).click();
  await expect(dialog).toContainText(tr('Submitted to Office','অফিসে জমা হয়েছে'));
  const stale=dialog.getByText(tr('Unable to refresh status. Showing last confirmed details; retrying automatically.','অবস্থা হালনাগাদ করা যায়নি। সর্বশেষ নিশ্চিত তথ্য দেখানো হচ্ছে; স্বয়ংক্রিয়ভাবে আবার চেষ্টা করা হবে।'),{exact:true});
  await expect(stale).toHaveCount(0);
  failRefresh=true;reviewed=true;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(stale).toBeVisible();
  await expect(dialog).toContainText(reportId);
  await expect(dialog).toContainText(tr('Submitted to Office','অফিসে জমা হয়েছে'));
  await expect(dialog.getByText(tr('Acknowledged','অফিস গ্রহণ করেছে'),{exact:true})).toHaveCount(0);
  // A second automatic poll fails; stale remains visible without resubmitting.
  const failedRead=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname.endsWith('/corrections')&&r.status()===503);
  await failedRead;
  await expect(stale).toBeVisible();
  expect(posts).toBe(3);
  failRefresh=false;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(dialog).toContainText(tr('Acknowledged','অফিস গ্রহণ করেছে'));
  await expect(stale).toHaveCount(0);
  await expect(dialog).toContainText(reportId);
  expect(posts).toBe(3);
  await dialog.getByRole('button',{name:tr('Close','বন্ধ করুন'),exact:true}).click();
  await expect(dialog).toHaveCount(0);
 });
}
