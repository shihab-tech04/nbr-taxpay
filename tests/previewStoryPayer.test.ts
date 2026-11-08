import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {bindPreviewStoryPayer, type StoryPaymentInput} from '../src/services/simulatedPaymentStory';

const session='11111111-2222-4333-8444-555555555555';
function payment():StoryPaymentInput {
  return {
    idempotencyKey:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    sessionId:session,
    service:'TAX_WITH_RETURN',
    amountMinor:1000,
    details:{payerMode:'SELF',taxpayerTin:'123456789012',payerId:'untrusted-form-id',
      receiptSnapshot:{isSimulatedDemo:true}}
  };
}
test('signed-in preview simulation binds the payer to server-issued profile identity, not form or beneficiary',()=>{
  const input=payment();
  const result=bindPreviewStoryPayer(input,{profileId:'user1',paymentSessionId:session});
  assert.equal(result.details.payerId,'user1');
  assert.equal(result.details.taxpayerTin,'123456789012');
  assert.equal(result.details.payerMode,'SELF');
  assert.equal((result.details.receiptSnapshot as {isSimulatedDemo:boolean}).isSimulatedDemo,true);
  assert.equal(input.details.payerId,'untrusted-form-id','must not modify original payment snapshot');
  assert.equal(result.sessionId,input.sessionId);
  assert.equal(result.idempotencyKey,input.idempotencyKey,'retry must retain idempotency key');
});
test('profile-scoped simulation rejects a mismatched session instead of selecting another profile',()=>{
  assert.throws(()=>bindPreviewStoryPayer(payment(),{
    profileId:'user2',paymentSessionId:'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  }),/Demo account changed/);
});
test('non-profile guest simulation is unchanged',()=>{
  const original=payment();
  assert.equal(bindPreviewStoryPayer(original,null),original);
});
