import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {bindPreviewStoryPayer,type StoryPaymentInput} from '../src/services/simulatedPaymentStory.ts';

const preview={profileId:'user1',paymentSessionId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'};
const payment:StoryPaymentInput={
 idempotencyKey:'11111111-2222-4333-8444-555555555555',
 sessionId:preview.paymentSessionId,service:'TAX_WITH_RETURN',amountMinor:1000,
 details:{
  payerMode:'SELF',taxpayerTin:'111111111111',assessmentYear:'2025-2026',
  lines:[{headId:1,economicCode:'1111101',totalAmount:10}],
  receiptSnapshot:{isSimulatedDemo:true,challanNo:'SIM-test'}
 }
};

test('signed-in wizard simulates own tax with the SQL authorization allocation contract',()=>{
 const scoped=bindPreviewStoryPayer(payment,preview);
 assert.equal(scoped.details.payerId,'user1');
 assert.deepEqual(scoped.details.lines,[{beneficiary:'user1',category:'TAX_WITH_RETURN',assessmentYear:'2025-2026',amountMinor:1000}]);
 assert.deepEqual(scoped.details.receiptLines,payment.details.lines);
 assert.deepEqual(scoped.details.receiptSnapshot,payment.details.receiptSnapshot);
 assert.deepEqual(scoped,bindPreviewStoryPayer(payment,preview),'idempotent replay must have identical SQL payload');
});
test('another demo payer requires an active authorization and preserves the consent ID',()=>{
 const input={...payment,details:{...payment.details,payerMode:'OTHER',taxpayerTin:'222222222222'}};
 assert.throws(()=>bindPreviewStoryPayer(input,preview),/active payment authorization/);
 assert.throws(()=>bindPreviewStoryPayer(input,preview,{beneficiary:'user2'}),/Active authorization/);
 const bound=bindPreviewStoryPayer(input,preview,{beneficiary:'user2',authorizationId:'99999999-2222-4333-8444-555555555555'});
 assert.deepEqual(bound.details.lines,[{beneficiary:'user2',category:'TAX_WITH_RETURN',assessmentYear:'2025-2026',amountMinor:1000,authorizationId:'99999999-2222-4333-8444-555555555555'}]);
});
test('existing authorization workspace and public guest payloads stay unchanged',()=>{
 const original={...payment,details:{payerId:'user1',lines:[{beneficiary:'user1',amountMinor:1000}]}};
 assert.deepEqual(bindPreviewStoryPayer(original,preview),original);
 assert.strictEqual(bindPreviewStoryPayer(payment,null),payment);
 assert.throws(()=>bindPreviewStoryPayer(payment,{...preview,paymentSessionId:'99999999-2222-4333-8444-555555555555'}),/Demo account changed/);
});
