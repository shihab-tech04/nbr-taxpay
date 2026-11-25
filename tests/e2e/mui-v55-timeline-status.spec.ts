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

const sharedPayment={
  id:'00000000-0000-4000-8000-000000000911',service:'TAX_WITH_RETURN',
  amountMinor:5000,status:'SIMULATED_SUCCESS',createdAt:'2026-10-25T12:00:00Z',
  details:{payerName:'Journey owner',taxpayerTin:'MULTIPLE_BENEFICIARIES',
    assessmentYear:'2026-27',lines:[
      {headId:68,headNameEn:'Tax head 68A',economicCode:'68A'},
      {headId:69,headNameEn:'Tax head 68B',economicCode:'68B'},
    ],allocations:[
      {taxpayerTin:'012345678901',taxpayerName:'Beneficiary A',headId:68,amountMinor:1500,assessmentYear:'2026-27'},
      {taxpayerTin:'012345678902',taxpayerName:'Beneficiary B',headId:69,amountMinor:3500,assessmentYear:'2025-26'},
    ],
  }
};

// Synthetic owner fixture retained from existing private journey acceptance.
for(const language of ['en','bn'] as const){
  test('MUI timeline status badges retain owner labels and original geometry '+language,async({page})=>{
    await mockAccount(page,true,[sharedPayment]);
    await page.goto('/?action=journey&lang='+language);
    const review=page.locator('[data-mui-coverage="MUI-JOURNEY-REVIEW-STATUS"]');
    const payment=page.locator('[data-mui-coverage="MUI-JOURNEY-PAYMENT-STATUS"]');
    await expect(review).toHaveCount(2);
    await expect(payment).toHaveCount(2);
    await expect(review.last()).toHaveText(language==='en'?'Information requested':'তথ্য চাওয়া হয়েছে');
    await expect(payment.first()).toHaveText(language==='en'?'Recorded':'নথিভুক্ত');
    for(const badge of [review.first(),payment.first()]){
      await expect(badge).toHaveClass(/MuiChip-root/);
      await expect(badge.locator('.MuiChip-label')).toBeVisible();
      await expect(badge).not.toHaveAttribute('role','button');
      const geometry=await badge.evaluate(element=>{
        const chip=element as HTMLElement;
        const native=document.createElement('span');
        native.className=Array.from(chip.classList).filter(c=>!c.startsWith('Mui')&&!c.startsWith('css-')).join(' ');
        native.textContent=chip.textContent;
        const measure=(node:HTMLElement)=>{
          const box=node.getBoundingClientRect(),s=getComputedStyle(node);
          return {width:box.width,height:box.height,color:s.color,background:s.backgroundColor,
            border:s.borderTopWidth,radius:s.borderTopLeftRadius,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight};
        };
        const current=measure(chip);
        chip.replaceWith(native);
        const original=measure(native);
        native.replaceWith(chip);
        return {current,original};
      });
      expect(geometry.current).toEqual(geometry.original);
    }
    const filter=page.getByTestId('account-sql-tax-journey').getByRole('combobox');
    await filter.selectOption('2025-26');
    await expect(payment).toHaveCount(1);
    await filter.selectOption('all');
    await expect(payment).toHaveCount(2);
  });
}
