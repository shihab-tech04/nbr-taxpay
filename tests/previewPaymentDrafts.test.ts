import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGuestPaymentDraft,parseTravelTaxDraft,parsePreviewFormDraft,
  type GuestPaymentDraftState,type TravelTaxDraftState} from '../src/services/previewPaymentDrafts.ts';

const guest:GuestPaymentDraftState={
  schema:'1',journey:'guest_payment',step:2,forSelf:false,
  tin:'123456789012',payerName:'',otherTaxpayerName:'Test taxpayer',
  additionalTaxpayers:[{id:'b-1',tin:'123456789013',name:'Other'}],
  otherTaxLines:[{id:'l-1',taxpayerId:'b-1',headId:88,assessmentYear:'2026-27',amount:'1.25'}],
  phone:'',receiptEmail:'',assessmentYear:'2026-27',noticeReference:'',
  incomeTaxType:'NON_COMPANY',category:'OTHER_TAX_PAYMENT',selectedHeadIds:[88],
  amountInputs:{'88':'1.25'},paymentChannel:null,methodGroup:null,paymentMethod:null
};
const travel:TravelTaxDraftState={
  schema:'1',journey:'travel_tax',step:1,mode:'LAND',port:'Benapole',
  waterPort:'',destination:'India',travelDate:'2026-12-01',
  passengers:[{id:'first',nationality:'BD',passport:'TEST123456',name:'Sample',
    ageBand:'ADULT',birthDate:'1992-04-18',country:'Bangladesh',
    identitySource:'PASSPORT_SAMPLE',medicalPortReferral:false}],
  phone:'',paymentChannel:null,methodGroup:null,paymentMethod:null
};

test('keeps partially completed actual payment and multi-taxpayer allocations',()=>{
  assert.deepEqual(parseGuestPaymentDraft(JSON.parse(JSON.stringify(guest))),guest);
  assert.deepEqual(parsePreviewFormDraft(guest),guest);
  assert.deepEqual(parsePreviewFormDraft(travel),travel);
});
test('keeps partial travel tax passenger data for later verification',()=>{
  assert.deepEqual(parseTravelTaxDraft({...travel,passengers:[
    {...travel.passengers[0],name:'',passport:'',identitySource:'PENDING'}]} )?.passengers[0].passport,'');
});
test('rejects secret/verification/owner fields in payment draft payload',()=>{
  for(const rogue of ['capability','owner_uid','authorizedTaxpayerId','createdReceipt','acknowledged']){
    assert.equal(parseGuestPaymentDraft({...guest,[rogue]:true}),null);
    assert.equal(parseTravelTaxDraft({...travel,[rogue]:true}),null);
  }
});
test('rejects excessive arrays, invalid types and payment result steps',()=>{
  assert.equal(parseGuestPaymentDraft({...guest,step:4}),null);
  assert.equal(parseTravelTaxDraft({...travel,step:3}),null);
  assert.equal(parseGuestPaymentDraft({...guest,selectedHeadIds:['invalid']}),null);
  assert.equal(parseGuestPaymentDraft({...guest,amountInputs:{'88':{error:'object'}}}),null);
  assert.equal(parseTravelTaxDraft({...travel,passengers:new Array(21).fill(travel.passengers[0])}),null);
  assert.equal(parseTravelTaxDraft({...travel,passengers:[]}),null);
  assert.equal(parseTravelTaxDraft({...travel,passengers:[{...travel.passengers[0],passport:'x'.repeat(60)}]}),null);
});
test('SQL gateway owns drafts via active capability, not submitted user ID or public role',()=>{
  const sql=readFileSync('supabase/migrations/20261107071500_preview_payment_drafts.sql','utf8');
  const edge=readFileSync('supabase/functions/taxpay-preview-drafts/index.ts','utf8');
  const component=readFileSync('src/components/ui/PreviewDraftControls.tsx','utf8');
  const guestFlow=readFileSync('src/components/screens/GuestPayment.tsx','utf8');
  const travelFlow=readFileSync('src/components/screens/TravelTax.tsx','utf8');
  assert.match(sql,/taxpay_guest_private\.touch_session\(p_capability_hash\)/);
  assert.match(sql,/owner_demo_id=v_demo_id/);
  assert.match(sql,/version=p_expected_version/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.taxpay_demo_payment_drafts/);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/);
  assert.match(edge,/x-taxpay-guest-capability/);
  assert.match(edge,/p_capability_hash:capabilityHash/);
  assert.match(component,/getPreviewDraft\(saved\.id\)/);
  assert.match(guestFlow,/journey="guest_payment"/);
  assert.match(travelFlow,/journey="travel_tax"/);
  assert.doesNotMatch(component,/localStorage|sessionStorage/);
});
