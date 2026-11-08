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
test('saved beneficiary payment uses the exact selected TIN without inventing consent',()=>{
 const input={...payment,details:{...payment.details,payerMode:'OTHER',taxpayerTin:'2222222222222'}};
 const bound=bindPreviewStoryPayer(input,preview);
 assert.deepEqual(bound.details.lines,[{beneficiary:'user2',category:'TAX_WITH_RETURN',assessmentYear:'2025-2026',amountMinor:1000}]);
 assert.deepEqual(bound.details.receiptLines,payment.details.lines);
 assert.throws(()=>bindPreviewStoryPayer({...input,details:{...input.details,taxpayerTin:'not-in-the-demo-directory'}},preview),/saved demo beneficiary/);
});
test('an owned external saved TIN keeps its identity in synthetic payments',()=>{
 const tin='000000000018';
 const input={...payment,details:{...payment.details,payerMode:'OTHER',taxpayerTin:tin}};
 const bound=bindPreviewStoryPayer(input,preview);
 assert.deepEqual(bound.details.lines,[{
  beneficiary:'SAVED_TIN:'+tin,category:'TAX_WITH_RETURN',assessmentYear:'2025-2026',amountMinor:1000
 }]);
 assert.deepEqual(bound.details.receiptLines,payment.details.lines);
 assert.equal(bound.idempotencyKey,input.idempotencyKey);
 assert.deepEqual(bound,bindPreviewStoryPayer(input,preview),'same-key retry must not change payload');
 assert.throws(()=>bindPreviewStoryPayer({...input,details:{...input.details,taxpayerTin:'1234'}},preview),/saved demo beneficiary/);
});
test('existing authorization workspace and public guest payloads stay unchanged',()=>{
 const original={...payment,details:{payerId:'user1',lines:[{beneficiary:'user1',amountMinor:1000}]}};
 assert.deepEqual(bindPreviewStoryPayer(original,preview),original);
 assert.strictEqual(bindPreviewStoryPayer(payment,null),payment);
 assert.throws(()=>bindPreviewStoryPayer(payment,{...preview,paymentSessionId:'99999999-2222-4333-8444-555555555555'}),/Demo account changed/);
});
