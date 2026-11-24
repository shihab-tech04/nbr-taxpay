import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPreviewStoryPayer, type StoryPaymentInput} from '../src/services/simulatedPaymentStory';

const preview={profileId:'user1',paymentSessionId:'11111111-1111-4111-8111-111111111111'};
const canonical=():StoryPaymentInput=>({
  idempotencyKey:'22222222-2222-4222-8222-222222222222',
  sessionId:preview.paymentSessionId,service:'TAX_WITH_RETURN',amountMinor:1975,
  details:{
    payerMode:'SELF',taxpayerTin:'111111111111',payerTin:'111111111111',
    assessmentYear:'2026-27',receiptReference:'SIM-22222222-2222-4222-8222-222222222222',
    lines:[{headId:125,headNameEn:'Tax with return',totalAmount:19.75}],
    receiptSnapshot:{paymentCategory:'TAX_WITH_RETURN',taxpayerTin:'111111111111',
      payerTin:'111111111111',assessmentYear:'2026-27',totalAmount:19.75,
      items:[{headId:125,totalAmount:19.75}]}
  }
});

test('M04 signed-in Return retains one head, amount, year and beneficiary in owner-bound SQL payload',()=>{
  const input=canonical();
  const output=bindPreviewStoryPayer(input,preview);
  assert.deepEqual(output.details.lines,[{
    beneficiary:'user1',category:'TAX_WITH_RETURN',headId:125,
    totalAmount:19.75,assessmentYear:'2026-27',amountMinor:1975
  }]);
  assert.deepEqual(output.details.receiptLines,input.details.lines);
  assert.equal(output.details.payerId,'user1');
  assert.deepEqual(input.details.lines,[{headId:125,headNameEn:'Tax with return',totalAmount:19.75}]);
});

test('M04 fails closed on a Return head or allocation that disagrees with its immutable receipt',()=>{
  const invalidHead=canonical();
  invalidHead.details.lines=[{headId:8,totalAmount:19.75}];
  assert.throws(()=>bindPreviewStoryPayer(invalidHead,preview),/RETURN_EXCLUSIVE_SINGLE_HEAD_RECIPIENT/);
  const invalidTotal=canonical();
  invalidTotal.details.lines=[{headId:125,totalAmount:18.75}];
  assert.throws(()=>bindPreviewStoryPayer(invalidTotal,preview),/RETURN_EXCLUSIVE_SINGLE_HEAD_RECIPIENT/);
  const mismatchedReceipt=canonical();
  mismatchedReceipt.details.receiptSnapshot={items:[{headId:125,totalAmount:20}]};
  assert.throws(()=>bindPreviewStoryPayer(mismatchedReceipt,preview),/RETURN_EXCLUSIVE_SINGLE_HEAD_RECIPIENT/);
});

test('non-Return preview services preserve their earlier legacy beneficiary contract',()=>{
  const input=canonical();
  input.service='PENALTY';
  const output=bindPreviewStoryPayer(input,preview);
  assert.deepEqual(output.details.lines,[{
    beneficiary:'user1',category:'PENALTY',assessmentYear:'2026-27',amountMinor:1975
  }]);
  assert.deepEqual(output.details.receiptLines,input.details.lines);
});
