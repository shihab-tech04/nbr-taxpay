import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptPaymentRequestSize,officeMirrorIdentity,MAX_LEGACY_PAYMENT_PAYLOAD_CHARS,MAX_COMBINED_PAYMENT_PAYLOAD_CHARS} from '../supabase/functions/demo-story1-taxpay/combinedPaymentRequest';

const combined={service:'OTHER_TAX_PAYMENT',details:{combinedPayment:true,allocations:[{taxpayerTin:'123456789012'}]}};
test('large canonical combined payments accepted within SQL limit',()=>{
  assert.equal(acceptPaymentRequestSize(MAX_LEGACY_PAYMENT_PAYLOAD_CHARS+1,combined),true);
  assert.equal(acceptPaymentRequestSize(MAX_COMBINED_PAYMENT_PAYLOAD_CHARS,combined),true);
  assert.equal(acceptPaymentRequestSize(MAX_COMBINED_PAYMENT_PAYLOAD_CHARS+1,combined),false);
});
test('legacy limits and malformed shapes are not expanded',()=>{
  assert.equal(acceptPaymentRequestSize(MAX_LEGACY_PAYMENT_PAYLOAD_CHARS,{service:'ADVANCE_TAX'}),true);
  for(const x of [{service:'ADVANCE_TAX',details:{combinedPayment:true}},{service:'OTHER_TAX_PAYMENT',details:{combinedPayment:'true'}},{service:'OTHER_TAX_PAYMENT',details:{combinedPayment:false}},null])
    assert.equal(acceptPaymentRequestSize(MAX_LEGACY_PAYMENT_PAYLOAD_CHARS+1,x),false);
});
test('Office signed handoff contains only identifiers, no payment allocations',()=>{
  const out=officeMirrorIdentity('payment-id','session-id');
  assert.deepEqual(out,{id:'payment-id',sessionId:'session-id'});
  assert.deepEqual(Object.keys(out),['id','sessionId']);
});
