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
async function mockAccount(page:Page,hasData:boolean,storedPayments:unknown[]=[],correctionColumns=true){
  await page.addInitScript(({key,value})=>{localStorage.setItem(key,JSON.stringify(value));},
    {key:'sb-nbr-taxpay-test-auth-token',value:session()});
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
