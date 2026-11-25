import {expect,test,type Page} from '@playwright/test';

const backend='https://nbr-taxpay-test.invalid';
const owner={id:'00000000-0000-4000-8000-000000000202',email:'journey-owner@example.invalid',
  aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},
  user_metadata:{taxpay_display_name:'Journey owner'},
  created_at:'2026-01-01T00:00:00Z',last_sign_in_at:'2026-10-01T00:00:00Z'};
const request={id:'00000000-0000-4000-8000-000000000901',owner_uid:owner.id,category:'ADVANCE_TAX',
  assessment_year:'2026-27',amount_minor:'12345',request_status:'INFO_REQUESTED',submitted_at:'2026-10-01T10:00:00Z'};
const correctionInquiryId='00000000-0000-4000-8000-000000000902';
function session(){
  const exp=Math.floor(Date.now()/1000)+3600;
  const encoded=btoa(JSON.stringify({sub:owner.id,aud:'authenticated',role:'authenticated',exp}));
  return {access_token:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+encoded+'.synthetic',token_type:'bearer',
    expires_in:3600,expires_at:exp,refresh_token:'journey-refresh',user:owner};
}
async function mockAccount(page:Page,hasData:boolean,storedPayments:unknown[]=[],correctionColumns=true,seedAuthOnlyOnce=false){
  await page.addInitScript(({key,value,seedOnlyOnce})=>{
    const seeded='taxpay-test-account-auth-seeded';
    if(seedOnlyOnce&&sessionStorage.getItem(seeded))return;
    localStorage.setItem(key,JSON.stringify(value));
    if(seedOnlyOnce)sessionStorage.setItem(seeded,'1');
  },{key:'sb-nbr-taxpay-test-auth-token',value:session(),seedOnlyOnce:seedAuthOnlyOnce});
  await page.route(backend+'/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    const response=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',
      headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-allow-methods':'GET,POST,OPTIONS'},
      body:JSON.stringify(data)});
    if(req.method()==='OPTIONS')return response({});
    const claim=req.headers().authorization?.replace(/^Bearer\s+/i,'').split('.')[1];
    if(claim){const actual=JSON.parse(atob(claim));expect(actual.sub).toBe(owner.id);}
    if(url.pathname==='/auth/v1/user'){
      if(req.method()==='PATCH'){
        const update=req.postDataJSON() as {data?:Record<string,unknown>};
        Object.assign(owner.user_metadata,update.data??{});
      }
      return response(owner);
    }
    if(url.pathname==='/rest/v1/taxpay_payment_requests'){
      expect(url.searchParams.get('owner_uid')).toBe('eq.'+owner.id);
      return response(hasData?[request]:[]);
    }
    if(url.pathname==='/rest/v1/taxpay_payment_drafts'){
      expect(url.searchParams.get('owner_uid')).toBe('eq.'+owner.id);
      return response(hasData?[{id:'draft-a1',owner_uid:owner.id,category:'ADVANCE_TAX',
        assessment_year:'2026-27',created_at:'2026-10-01T10:00:00Z'}]:[]);
    }
    if(url.pathname==='/rest/v1/taxpay_in_app_notifications'){
      expect(url.searchParams.get('recipient_uid')).toBe('eq.'+owner.id);
      if(req.method()==='PATCH')return response([
        {id:'notice-a1'},{id:'notice-correction-a1'}
      ]);
      const correctionSelect=url.searchParams.get('select')?.includes('correction_inquiry_id');
      if(!correctionColumns&&correctionSelect)
        return response({code:'42703',message:'column taxpay_in_app_notifications.correction_inquiry_id does not exist'},400);
      if(!correctionColumns)return response(hasData?[{id:'notice-a1',request_id:request.id,event_id:'event-a1',
        message_code:'REQUEST_SUBMITTED',is_read:false,created_at:'2026-10-03T10:00:00Z'}]:[]);
      return response(hasData?[
        {id:'notice-a1',request_id:request.id,event_id:'event-a1',message_code:'REQUEST_SUBMITTED',
          is_read:false,created_at:'2026-10-03T10:00:00Z'},
        {id:'notice-correction-a1',request_id:null,event_id:null,correction_inquiry_id:correctionInquiryId,
          correction_decision_id:'decision-a1',message_code:'CORRECTION_MAKER_ACKNOWLEDGED',
          is_read:false,created_at:'2026-10-04T10:00:00Z'},
      ]:[]);
    }
    if(url.pathname==='/rest/v1/rpc/taxpay_claim_office_initiated_corrections'){
      expect(req.postDataJSON()).toEqual({p_limit:20});
      return response(0);
    }
    if(url.pathname==='/rest/v1/taxpay_correction_inquiries'){
      expect(url.searchParams.get('requester_uid')).toBe('eq.'+owner.id);
      return response(hasData?[{
        inquiry_id:correctionInquiryId,original_reference:'SYN-OWNER-REF-001',evidence_state:'PENDING_EVIDENCE',
        created_at:'2026-10-02T11:00:00Z',reason:'Evidence requires a correction review',
        requested_outcome:'Review supplied evidence',change_kind:null,old_value:null,new_value:null,
        office_review_state:'PENDING_OFFICER',office_review_revision:1,
        office_review_updated_at:'2026-10-03T10:00:00Z'
      },{
        inquiry_id:'00000000-0000-4000-8000-000000000903',original_reference:'SYN-OTHER-REF-002',evidence_state:'PENDING_EVIDENCE',
        created_at:'2026-10-01T11:00:00Z',reason:'A different correction review',
        requested_outcome:'Review a separate supplied record',change_kind:null,old_value:null,new_value:null,
        office_review_state:'PENDING_OFFICER',office_review_revision:1,
        office_review_updated_at:'2026-10-02T10:00:00Z'
      }]:[]);
    }
    if(url.pathname==='/rest/v1/taxpay_request_events'){
      expect(url.searchParams.get('request_id')).toContain(request.id);
      return response(hasData?[{
        id:2,request_id:request.id,event_type:'OFFICER_INFO_REQUESTED',
        status_after:'INFO_REQUESTED',occurred_at:'2026-10-03T10:00:00Z'
      }]:[]);
    }
    if(url.pathname==='/rest/v1/rpc/taxpay_claim_story1_session')return response(0);
    // The new optional payer-history claim is authenticated and must not
    // prevent the existing owner-scoped payment history fixture from loading.
    if(url.pathname==='/rest/v1/rpc/taxpay_claim_walkin_payer_payments')return response(0);
    if(url.pathname==='/rest/v1/rpc/taxpay_my_story1_payments')return response({
      items:storedPayments,total:storedPayments.length,page:1,perPage:100
    });
    return response({message:'Not part of account journey acceptance'},403);
  });
}


for (const language of ['en','bn'] as const) {
  const bn=language==='bn';
  test('profile activity MUI retry recovers owner-only records '+language,async({page})=>{
    await mockAccount(page,false);
    let fail=true;
    const row={id:'activity-v51',owner_uid:owner.id,event_type:'PAGE_OPENED',route:'account_settings',occurred_at:'2026-10-01T10:00:00Z'};
    await page.route(backend+'/rest/v1/taxpay_account_activity**',async route=>{
      const req=route.request(),url=new URL(req.url());
      const respond=(value:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
      if(req.method()==='OPTIONS')return respond({});
      if(req.method()==='POST')return respond({...row,...req.postDataJSON()});
      expect(url.searchParams.get('owner_uid')).toBe('eq.'+owner.id);
      return fail?respond({message:'Synthetic transient activity failure'},503):respond([row]);
    });
    await page.goto('/?action=account_profile&lang='+language);
    const region=page.locator('section[aria-labelledby="account-recent-activity"]');
    await expect(region.getByRole('alert')).toBeVisible();
    const retry=region.getByRole('button',{name:bn?'আবার চেষ্টা':'Retry'});
    await expect(retry).toHaveClass(/MuiButtonBase-root/);
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    fail=false;
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(region.getByRole('list')).toContainText(bn?'প্রোফাইল সেটিংস':'Profile settings');
    await expect(retry).toHaveCount(0);
  });
  test('shared review MUI controls preserve owner-scoped refresh and acknowledgment '+language,async({page})=>{
    await mockAccount(page,false);
    const draft={id:'draft-review-v51',owner_uid:owner.id,record_status:'DRAFT',purpose:'TAX_LIABILITY_PAYMENT',category:'ADVANCE_TAX',assessment_year:'2026-27',amount_minor:12345,memo:null,created_at:'2026-10-01T10:00:00Z'};
    const notice={id:'notice-v51',request_id:request.id,message_code:'REQUEST_ACKNOWLEDGED',is_read:false,created_at:'2026-10-03T10:00:00Z'};
    let read=false,submitted=false,reads=0;
    const respond=(route:import('@playwright/test').Route,data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    await page.route(backend+'/rest/v1/taxpay_payment_drafts**',async route=>{
      expect(new URL(route.request().url()).searchParams.get('owner_uid')).toBe('eq.'+owner.id);
      return respond(route,[draft]);
    });
    await page.route(backend+'/rest/v1/taxpay_payment_requests**',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(req.method()==='POST'){
        expect(req.postDataJSON().owner_uid).toBe(owner.id);
        expect(req.postDataJSON().source_draft_id).toBe(draft.id);
        submitted=true;
        return respond(route,{id:request.id});
      }
      expect(url.searchParams.get('owner_uid')).toBe('eq.'+owner.id);
      const row={...request,source_draft_id:draft.id,request_status:'SUBMITTED_FOR_REVIEW',processing_mode:'NON_FINANCIAL_REVIEW'};
      return respond(route,url.searchParams.has('id')?row:submitted?[row]:[]);
    });
    await page.route(backend+'/rest/v1/taxpay_in_app_notifications**',async route=>{
      const req=route.request(),url=new URL(req.url());
      expect(url.searchParams.get('recipient_uid')).toBe('eq.'+owner.id);
      if(req.method()==='PATCH'){
        expect(url.searchParams.get('id')).toBe('eq.'+notice.id);
        expect(req.postDataJSON()).toEqual({is_read:true});
        read=true;return respond(route,[{id:notice.id}]);
      }
      reads++;return respond(route,[{...notice,is_read:read}]);
    });
    await page.goto('/?action=secure_workspace&lang='+language);
    const region=page.getByRole('region',{name:bn?'রিভিউ অনুরোধ':'Shared review requests'});
    const refresh=region.getByRole('button',{name:bn?'অবস্থা হালনাগাদ':'Refresh status'});
    const submit=region.getByRole('button',{name:bn?'পর্যালোচনার জন্য পাঠান':'Send for review'});
    const mark=region.getByRole('button',{name:bn?'পড়া হয়েছে':'Mark read'});
    for(const button of [refresh,submit,mark]){
      await expect(button).toHaveClass(/MuiButtonBase-root/);
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const before=reads;
    await refresh.click();await expect.poll(()=>reads).toBeGreaterThan(before);
    await mark.click();await expect(mark).toHaveCount(0);
    await submit.click();
    await expect(region.getByRole('button',{name:bn?'ইতোমধ্যে জমা':'Already submitted'})).toBeDisabled();
    await expect(region).toContainText(request.id);
    expect(submitted).toBe(true);
    expect(read).toBe(true);
    await page.reload();
    await expect(region.getByRole('button',{name:bn?'ইতোমধ্যে জমা':'Already submitted'})).toBeDisabled();
    await expect(mark).toHaveCount(0);
  });
}
