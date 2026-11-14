import {expect,test,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';

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

test('verified account sees only real owner review events and correct chronological details',async({page})=>{
  await mockAccount(page,true);
  await page.goto('/?action=journey');
  const timeline=page.getByTestId('account-tax-journey');
  await expect(timeline).toBeVisible();
  const items=timeline.getByRole('list',{name:'Chronological account review events'}).locator('li');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('Review request submitted');
  await expect(items.nth(1)).toContainText('Review status event');
  await expect(timeline).toContainText(request.id);
  await expect(timeline).toContainText('Requested amount (not paid): ৳ 123.45');
  await expect(timeline).not.toContainText('Treasury confirmed');
  await expect(timeline).not.toContainText('Tax credit recognized');
  await items.nth(1).getByText('View event details').click();
  await expect(items.nth(1)).toContainText('OFFICER INFO REQUESTED');
  await page.getByRole('combobox',{name:'Journey assessment year'}).selectOption('all');
  await page.reload();
  await expect(page.getByTestId('account-tax-journey').getByRole('listitem')).toHaveCount(2);
});

test('signed-in account with no records never invents financial events',async({page})=>{
  await mockAccount(page,false);
  await page.goto('/?action=journey&lang=bn');
  const timeline=page.getByTestId('account-tax-journey');
  await expect(timeline).toBeVisible();
  await expect(timeline.getByRole('list',{name:'অ্যাকাউন্টের পর্যালোচনা ঘটনাক্রম'})).toHaveCount(0);
  await expect(timeline.getByRole('status')).toContainText('কোনো নথিভুক্ত');
  await expect(page.getByRole('navigation',{name:'করসেবা'})).toBeVisible();
});

test('shared review workspace scopes notification reads and acknowledgements to the signed-in recipient',async({page})=>{
  await mockAccount(page,false);
  const viewed=new Set<string>();
  const notices=[
    {id:'review-notice-1',request_id:request.id,message_code:'REQUEST_ACKNOWLEDGED',is_read:false,created_at:'2026-10-03T10:00:00Z'},
    {id:'review-notice-2',request_id:request.id,message_code:'REQUEST_INFO_REQUESTED',is_read:false,created_at:'2026-10-04T10:00:00Z'}
  ];
  await page.route(backend+'/rest/v1/taxpay_in_app_notifications**',async route=>{
    const req=route.request(),url=new URL(req.url());
    const response=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',
      headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
        'access-control-allow-methods':'GET,POST,PATCH,OPTIONS'},body:JSON.stringify(data)});
    if(req.method()==='OPTIONS')return response({});
    expect(url.searchParams.get('recipient_uid')).toBe('eq.'+owner.id);
    if(req.method()==='PATCH'){
      const idFilter=url.searchParams.get('id');
      expect(idFilter).toBe('eq.review-notice-1');
      viewed.add('review-notice-1');
      return response([{id:'review-notice-1'}]);
    }
    return response(notices.map(notice=>({...notice,is_read:notice.is_read||viewed.has(notice.id)})));
  });

  await page.goto('/?action=secure_workspace');
  await expect(page.getByRole('heading',{name:'Officer review requests'})).toBeVisible();
  const first=page.locator('li').filter({hasText:'Officer acknowledged the request'});
  await expect(first.getByRole('button',{name:'Mark read'})).toBeVisible();
  await first.getByRole('button',{name:'Mark read'}).click();
  await expect(first.getByRole('button',{name:'Mark read'})).toHaveCount(0);
  const second=page.locator('li').filter({hasText:'Officer requested additional information'});
  await expect(second.getByRole('button',{name:'Mark read'})).toBeVisible();
  await expect(first).toContainText(request.id);
  await expect(second).toContainText(request.id);
});

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

test('owner SQL payment events show beneficiary allocations with the same reference used by Office',async({page})=>{
  await mockAccount(page,true,[sharedPayment]);
  await page.goto('/?action=journey');
  const saved=page.getByTestId('account-sql-tax-journey');
  await expect(saved).toBeVisible();
  await expect(saved.getByRole('listitem')).toHaveCount(2);
  await expect(saved).toContainText('Beneficiary A');
  await expect(saved).toContainText('Beneficiary B');
  await expect(saved).toContainText('৳ 15.00');
  await expect(saved).toContainText('৳ 35.00');
  await expect(saved).toContainText(sharedPayment.id);
  await saved.getByRole('combobox',{name:'Payment journey assessment year'}).selectOption('2025-26');
  await expect(saved.getByRole('listitem')).toHaveCount(1);
  await expect(saved).toContainText('Beneficiary B');
  await expect(saved).not.toContainText('Beneficiary A');
  await saved.getByRole('combobox',{name:'Payment journey assessment year'}).selectOption('all');
  await saved.getByRole('button',{name:'View payment details'}).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('account-tax-journey')).toContainText(request.id);
});

test('unbound signed-in history retains review activity and SQL-owned beneficiary receipts',async({page})=>{
  await mockAccount(page,true,[sharedPayment]);
  await page.goto('/?action=history');
  const history=page.getByTestId('beneficiary-payment-history');
  await expect(history).toBeVisible();
  // The shared record grid displays a semantic desktop table and accessible
  // mobile cards; assert the actually rendered variant, not hidden table rows.
  const mobile=(page.viewportSize()?.width??1280)<768;
  const records=mobile
    ? history.getByTestId('beneficiary-payment-mobile-cards').getByRole('listitem')
    : history.getByRole('row');
  await expect(records).toHaveCount(mobile?2:3);
  await expect(history).toContainText('Beneficiary A');
  await expect(history).toContainText('Beneficiary B');
  await expect(history).toContainText(sharedPayment.id);
  await expect(history).toContainText('Tax head 68A');
  await expect(history).toContainText('Tax head 68B');
  await history.getByRole('searchbox',{name:'Search beneficiary, TIN or payment reference'}).fill('012345678902');
  await expect(records).toHaveCount(mobile?1:2);
  await expect(history).not.toContainText('Beneficiary A');
  await expect(history).toContainText('Beneficiary B');
});


const travelHistoryId='00000000-0000-4000-8000-000000000913';
const travelHistoryPassengers=[
  {name:'JOURNEY OWNER',passportMasked:'••••3456',nationality:'BD',ageBand:'ADULT',age:35,amount:1000},
  {name:'FRIEND SECOND',passportMasked:'••••4321',nationality:'FOREIGN',country:'India',ageBand:'CHILD',age:9,amount:500}
];
const travelHistoryLines=[
  {headId:155,headNameEn:'Travel tax — JOURNEY OWNER',economicCode:'1144102',
    taxAmount:1000,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:1000,
    note:'LAND | Benapole | India | 2026-11-20 | Passport ••••3456'},
  {headId:156,headNameEn:'Travel tax — FRIEND SECOND',economicCode:'1144102',
    taxAmount:500,penaltyAmount:0,surchargeAmount:0,interestAmount:0,totalAmount:500,
    note:'LAND | Benapole | India | 2026-11-20 | Passport ••••4321'}
];
const travelHistoryDetails={
  mode:'LAND',departurePort:'Benapole',destination:'India',travelDate:'2026-11-20',
  economicCode:'1144102',passengers:travelHistoryPassengers
};
const travelHistorySnapshot={
  id:'rcpt-trv-history-913',taxEventId:'SIM-EVENT-history-913',
  paymentTransactionId:'SIM-TOKEN-history-913',challanNo:'SIM-history-913',
  tokenNumber:'SIM-TOKEN-history-913',paymentCategory:'TRAVEL_TAX',assessmentYear:'2026-27',
  payerName:'JOURNEY OWNER',payerTin:'NON-TIN-PASSENGER',receiptMobile:'01712345678',
  isRepresentativePayment:false,taxZone:'',taxCircle:'',isWithholding:false,
  travelDetails:travelHistoryDetails,items:travelHistoryLines,totalAmount:1500,
  paymentMethod:'NAGAD',gatewayTransactionId:'SIM-TXN-history-913',
  treasuryStatus:'GATEWAY_SUCCESS',taxCreditStatus:'NOT_APPLICABLE',
  createdAt:'2026-11-14T08:00:00.000Z',completedAt:'2026-11-14T08:00:00.000Z',
  isSimulatedDemo:true
};
const signedInTravelTaxPayment={
  id:travelHistoryId,service:'TRAVEL_TAX',amountMinor:150000,status:'SIMULATED_SUCCESS',
  createdAt:'2026-11-14T08:00:00.000Z',
  details:{
    payerName:'JOURNEY OWNER',assessmentYear:'2026-27',paymentMethod:'NAGAD',
    paymentChannel:'NOW',receiptReference:travelHistorySnapshot.tokenNumber,
    receiptMobile:'01712345678',travelMode:'LAND',departurePort:'Benapole',
    destination:'India',travelDate:'2026-11-20',economicCode:'1144102',
    passengers:travelHistoryPassengers,lines:travelHistoryLines,receiptSnapshot:travelHistorySnapshot
  }
};

for(const language of ['en','bn'] as const){
  test('F-162 / US-119, US-158, US-159 recover signed-in Travel Tax history after sign-out in '+language,
    async({page})=>{
      await mockAccount(page,true,[signedInTravelTaxPayment],true,true);
      const guestSessionId='ed18e1b3-8abf-4a19-a22d-0b5d6dca7101';
      const claimedSessionIds:string[]=[];
      await page.addInitScript(id=>sessionStorage.setItem('taxpay-guest-simulation-session',id),guestSessionId);
      await page.route(backend+'/rest/v1/rpc/taxpay_claim_story1_session',async route=>{
        const request=route.request();
        const headers={'access-control-allow-origin':'*',
          'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
          'access-control-allow-methods':'GET,POST,OPTIONS'};
        if(request.method()==='OPTIONS')
          return route.fulfill({status:200,contentType:'application/json',headers,body:'{}'});
        const payload=request.postDataJSON() as {p_session_id?:string};
        claimedSessionIds.push(payload.p_session_id??'');
        return route.fulfill({status:200,contentType:'application/json',headers,body:'1'});
      });
      await page.goto('/?action=history&lang='+language);
      const history=page.getByTestId('beneficiary-payment-history');
      await expect(history).toBeVisible();
      await expect(history).toContainText(travelHistoryId);
      await expect(claimedSessionIds).toEqual([guestSessionId]);
      const mobile=(page.viewportSize()?.width??1280)<768;
      const record=mobile
        ?history.getByTestId('beneficiary-payment-mobile-cards').getByRole('listitem').filter({hasText:travelHistoryId})
        :history.getByRole('row').filter({hasText:travelHistoryId});
      await expect(record).toHaveCount(1);
      await record.getByRole('button',{name:language==='bn'?/দেখুন/:/View/}).click();
      const dialog=page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const certificateToggle=dialog.getByRole('button',{
        name:/View payment certificate|পেমেন্ট সনদ দেখুন/
      });
      await expect(certificateToggle).toBeVisible();
      await certificateToggle.click();
      let certificate=dialog.getByTestId('payment-certificate-document');
      await expect(certificate).toBeVisible();
      await expect(certificate.getByTestId('payment-certificate-reference'))
        .toContainText('SK-PC-'+travelHistoryId);
      await expect(certificate).toContainText(travelHistoryId);
      await expect(certificate).toContainText('JOURNEY OWNER');
      await expect(certificate).toContainText('FRIEND SECOND');
      await expect(certificate).toContainText('••••4321');
      await expect(certificate).toContainText('Benapole');

      // Refresh recovers the same owner-scoped SQL row and certificate reference.
      await page.reload();
      const recovered=page.getByTestId('beneficiary-payment-history');
      await expect(recovered).toBeVisible();
      await expect(recovered).toContainText(travelHistoryId);
      const recoveredRecord=mobile
        ?recovered.getByTestId('beneficiary-payment-mobile-cards').getByRole('listitem')
          .filter({hasText:travelHistoryId})
        :recovered.getByRole('row').filter({hasText:travelHistoryId});
      await expect(recoveredRecord).toHaveCount(1);
      await recoveredRecord.getByRole('button',{name:language==='bn'?/দেখুন/:/View/}).click();
      const recoveredDialog=page.getByRole('dialog');
      await recoveredDialog.getByRole('button',{name:/View payment certificate|পেমেন্ট সনদ দেখুন/}).click();
      certificate=recoveredDialog.getByTestId('payment-certificate-document');
      await expect(certificate.getByTestId('payment-certificate-reference'))
        .toContainText('SK-PC-'+travelHistoryId);
      await expect(certificate).toContainText('FRIEND SECOND');

      // Sign out through the existing account screen, then re-enter the same owner
      // session while keeping the opaque guest session that was claimed above.
      await page.goto('/?action=account_profile&lang='+language);
      const signOut=page.getByRole('button',{name:language==='bn'?/সাইন আউট/:/Sign out/});
      await expect(signOut).toBeVisible();
      await signOut.click();
      await expect(page).toHaveURL(/(?:[?&]action=landing|\/$)/);
      await expect.poll(()=>page.evaluate(()=>localStorage.getItem('sb-nbr-taxpay-test-auth-token'))).toBeNull();

      // A signed-out owner must not reopen the private payment register or its certificate.
      // The one-shot fixture must not silently seed the old token during this navigation.
      await page.goto('/?action=history&lang='+language);
      await expect.poll(()=>page.evaluate(()=>localStorage.getItem('sb-nbr-taxpay-test-auth-token'))).toBeNull();
      await expect(page.getByRole('heading',{name:language==='bn'?'করদাতার ব্যক্তিগত তথ্য':'Private taxpayer workspace'})).toBeVisible();
      await expect(page.getByRole('link',{name:language==='bn'?'সাইন ইন':'Sign In'})).toBeVisible();
      await expect(page.getByTestId('beneficiary-payment-history')).toHaveCount(0);
      await expect(page.getByTestId('payment-certificate-document')).toHaveCount(0);
      await expect(page.getByText(travelHistoryId,{exact:false})).toHaveCount(0);

      await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{
        key:'sb-nbr-taxpay-test-auth-token',value:session()
      });
      await page.goto('/?action=history&lang='+language);
      const relogged=page.getByTestId('beneficiary-payment-history');
      await expect(relogged).toBeVisible();
      await expect(relogged).toContainText(travelHistoryId);
      await expect(claimedSessionIds).toEqual([guestSessionId,guestSessionId,guestSessionId]);
      const restoredRecord=mobile
        ?relogged.getByTestId('beneficiary-payment-mobile-cards').getByRole('listitem')
          .filter({hasText:travelHistoryId})
        :relogged.getByRole('row').filter({hasText:travelHistoryId});
      await expect(restoredRecord).toHaveCount(1);
      await restoredRecord.getByRole('button',{name:language==='bn'?/দেখুন/:/View/}).click();
      const restoredDialog=page.getByRole('dialog');
      await restoredDialog.getByRole('button',{name:/View payment certificate|পেমেন্ট সনদ দেখুন/}).click();
      const restoredCertificate=restoredDialog.getByTestId('payment-certificate-document');
      await expect(restoredCertificate.getByTestId('payment-certificate-reference'))
        .toContainText('SK-PC-'+travelHistoryId);
      await expect(restoredCertificate).toContainText('FRIEND SECOND');
    });
}

const repeatableAdvancePayment={
  id:'00000000-0000-4000-8000-000000000912',service:'ADVANCE_TAX',
  amountMinor:1234,status:'SIMULATED_SUCCESS',createdAt:'2026-10-25T12:00:00Z',
  details:{payerName:'Journey owner',payerTin:'1111111111111',taxpayerName:'Beneficiary A',
    taxpayerTin:'012345678901',assessmentYear:'2026-27',lines:[{
      headId:11,headNameEn:'Advance Tax - 1st Quarter Installment (Section 154)',
      economicCode:'1-1141-0015-0201',taxAmount:12.34,penaltyAmount:0,
      surchargeAmount:0,interestAmount:0,totalAmount:12.34
    }]
  }
};

for(const language of ['en','bn'] as const){
  test('beneficiary-history Pay Again opens an editable copy without changing the original in '+language,
    async({page},info)=>{
      const original=JSON.stringify(repeatableAdvancePayment);
      await mockAccount(page,true,[repeatableAdvancePayment]);
      await page.route(backend+'/rest/v1/rpc/sim_my_taxpayer_profile**',async route=>{
        const req=route.request();
        const headers={'access-control-allow-origin':'*',
          'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info',
          'access-control-allow-methods':'GET,POST,OPTIONS'};
        if(req.method()==='OPTIONS')
          return route.fulfill({status:200,contentType:'application/json',headers,body:'{}'});
        const claim=req.headers().authorization?.replace(/^Bearer\s+/i,'').split('.')[1];
        if(claim){const actual=JSON.parse(atob(claim));expect(actual.sub).toBe(owner.id);}
        return route.fulfill({status:200,contentType:'application/json',headers,body:'null'});
      });
      const savedList={id:'00000000-0000-4000-8000-000000000920',owner_uid:owner.id,
        name:'Clients',created_at:'2026-10-01T00:00:00Z'};
      const savedBeneficiary={id:'00000000-0000-4000-8000-000000000921',owner_uid:owner.id,
        list_id:savedList.id,tin:'012345678901',display_name:'Beneficiary A',tag:'clients',
        relationship:null,other_label:null,created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'};
      await page.route(backend+'/rest/v1/taxpay_beneficiary_lists**',async route=>{
        const req=route.request(),url=new URL(req.url());
        const headers={'access-control-allow-origin':'*',
          'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info, range',
          'access-control-allow-methods':'GET,POST,OPTIONS','content-range':'0-0/1'};
        if(req.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'});
        expect(url.searchParams.get('owner_uid')).toBe('eq.'+owner.id);
        return route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify([savedList])});
      });
      await page.route(backend+'/rest/v1/taxpay_beneficiaries**',async route=>{
        const req=route.request(),url=new URL(req.url());
        const headers={'access-control-allow-origin':'*',
          'access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info, range',
          'access-control-allow-methods':'GET,POST,OPTIONS','content-range':'0-0/1'};
        if(req.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'});
        expect(url.searchParams.get('owner_uid')).toBe('eq.'+owner.id);
        return route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify([savedBeneficiary])});
      });
      const profileRead=page.waitForResponse(response=>
        response.request().method()==='POST'&&response.url().includes('/rpc/sim_my_taxpayer_profile'));
      await page.goto('/?action=history&lang='+language);
      await profileRead;
      const history=page.getByTestId('beneficiary-payment-history');
      await expect(history).toBeVisible();
      const mobile=(page.viewportSize()?.width??1280)<768;
      const repeat=history.getByTestId(mobile?'account-pay-again-mobile':'account-pay-again-desktop');
      await expect(repeat).toBeVisible();
      await repeat.click();
      const copied=page.getByTestId('pay-again-reuse-notice');
      await expect(copied).toBeVisible();
      await expect(copied).toContainText(repeatableAdvancePayment.id);
      await expect(copied).toContainText(language==='bn'?'মূল পেমেন্ট অপরিবর্তিত':'Original payment unchanged');
      await expect(page.locator('[data-payment-service="ADVANCE_TAX"]')).toBeVisible();
      const picker=page.getByTestId('saved-beneficiary-picker');
      await expect(picker).toContainText('012345678901');
      await expect(picker.getByRole('radio')).toBeChecked();
      await expect(page.locator('#guest-tin')).toHaveCount(0);
      expect(JSON.stringify(repeatableAdvancePayment)).toBe(original);
    });
}

for(const language of ['en','bn'] as const){
  test('authenticated Notifications and Corrections show shared searchable tables in '+language,async({page},info)=>{
    await mockAccount(page,true);
    await page.goto('/?action=account_notifications&lang='+language);
    const inbox=page.getByTestId('authenticated-notification-registers');
    await expect(inbox).toBeVisible();
    const desktop=info.project.name==='desktop-1280';
    const reviews=page.getByTestId(desktop?'authenticated-review-notification-register':'authenticated-review-notification-cards');
    const drafts=page.getByTestId(desktop?'authenticated-draft-notification-register':'authenticated-draft-notification-cards');
    const reviewRows=desktop?reviews.locator('tbody tr'):reviews.getByRole('listitem');
    await expect(reviewRows).toHaveCount(2);
    await expect(desktop?drafts.locator('tbody tr'):drafts.getByRole('listitem')).toHaveCount(1);
    await expect(reviews).toContainText(request.id);
    await expect(reviews).toContainText(language==='bn'
      ?'সংশোধনের অনুরোধ গ্রহণ করা হয়েছে':'Correction request acknowledged');
    await expect(reviews).toContainText('SYN-OWNER-REF-001');
    await expect(drafts).toContainText('ADVANCE_TAX');
    const search=page.getByRole('searchbox',{name:language==='bn'?'বিজ্ঞপ্তি খুঁজুন':'Search account notifications'});
    await search.fill('no-matching-reference');
    await expect(reviews).toHaveCount(0);
    await expect(drafts).toHaveCount(0);
    await page.getByRole('button',{name:language==='bn'?'অনুসন্ধান মুছুন':'Clear search'}).click();
    await expect(reviewRows).toHaveCount(2);
    await page.getByRole('button',{name:language==='bn'?'সবগুলো দেখা হয়েছে':'Mark all as viewed'}).click();
    await expect(reviews).toContainText(language==='bn'?'দেখা':'Viewed');
    const count=desktop?await reviewRows.first().locator('td').count()
      :await reviewRows.first().locator('dt').count();
    expect(count).toBe(4);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    mkdirSync('test-results/screenshots',{recursive:true});
    await page.screenshot({path:'test-results/screenshots/taxpay-auth-notifications-'+language+'-'+info.project.name+'.png',
      animations:'disabled'});
    const correctionLink=reviews.getByRole('button',{name:language==='bn'
      ?'সংশোধন মামলা খুলুন: SYN-OWNER-REF-001':'Open correction case: SYN-OWNER-REF-001'});
    await expect(correctionLink).toBeVisible();
    await correctionLink.click();
    await expect(page).toHaveURL(/action=corrections/);
    const corrections=page.getByTestId('authenticated-correction-register');
    await expect(corrections).toBeVisible();
    const table=page.getByTestId(desktop?'authenticated-correction-inquiry-table':'authenticated-correction-inquiry-cards');
    const caseRows=desktop?table.locator('tbody tr'):table.getByRole('listitem');
    await expect(caseRows).toHaveCount(1);
    await expect(table).toContainText('SYN-OWNER-REF-001');
    await expect(table).not.toContainText('SYN-OTHER-REF-002');
    await page.goto('/?action=corrections&lang='+language);
    const allCorrections=page.getByTestId(desktop?'authenticated-correction-inquiry-table':'authenticated-correction-inquiry-cards');
    const allCaseRows=desktop?allCorrections.locator('tbody tr'):allCorrections.getByRole('listitem');
    await expect(allCaseRows).toHaveCount(2);
    await expect(allCorrections).toContainText('SYN-OTHER-REF-002');
    await allCorrections.locator('summary').first().click();
    await expect(allCorrections).toContainText('Review supplied evidence');
    await page.getByRole('searchbox',{name:language==='bn'?'অনুসন্ধান খুঁজুন':'Search review inquiries'})
      .fill('not-the-reference');
    await expect(allCorrections).toHaveCount(0);
    await page.getByRole('button',{name:language==='bn'?'অনুসন্ধান মুছুন':'Clear search'}).click();
    await expect(allCaseRows).toHaveCount(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({path:'test-results/screenshots/taxpay-auth-corrections-'+language+'-'+info.project.name+'.png',
      animations:'disabled'});
  });
}

test('notification register keeps payment reviews available before correction columns are deployed',async({page},info)=>{
  await mockAccount(page,true,[],false);
  await page.goto('/?action=account_notifications');
  const mobile=info.project.name.startsWith('mobile-');
  const reviews=page.getByTestId(mobile
    ?'authenticated-review-notification-cards'
    :'authenticated-review-notification-register');
  await expect(reviews).toBeVisible();
  await expect(reviews).toContainText(request.id);
  await expect(reviews).not.toContainText('case-a1');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
