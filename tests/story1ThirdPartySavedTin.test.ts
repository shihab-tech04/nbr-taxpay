import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPreviewStoryPayer, type StoryPaymentInput} from '../src/services/simulatedPaymentStory';

// The SQL contract accepts literal SAVED_TIN identity for third-party
// recipients. It independently checks that TIN in the exact payer session's
// saved list. Never infer a userN account from a matching sample TIN.
test('third-party Tax with Return binds the exact saved TIN, not a fictional user alias', () => {
  const sessionId='00000000-0000-4000-8000-000000000001';
  const amountMinor=80000;
  const receiptLines=[{headId:125,totalAmount:800}];
  const input: StoryPaymentInput={
    idempotencyKey:'00000000-0000-4000-8000-000000000002',
    sessionId,service:'TAX_WITH_RETURN',amountMinor,
    details:{
      payerMode:'OTHER',taxpayerTin:'909000000027',payerName:'Payer',
      assessmentYear:'2026-27',
      receiptSnapshot:{taxpayerTin:'909000000027',items:receiptLines},
      lines:receiptLines,
    }
  };
  const result=bindPreviewStoryPayer(input,{profileId:'user1',paymentSessionId:sessionId});
  assert.equal(result.details.payerId,'user1');
  assert.deepEqual(result.details.receiptLines,receiptLines);
  const allocations=result.details.lines as Array<Record<string,unknown>>;
  assert.equal(allocations.length,1);
  assert.equal(allocations[0].beneficiary,'SAVED_TIN:909000000027');
  assert.equal(allocations[0].amountMinor,amountMinor);
  assert.equal(allocations[0].category,'TAX_WITH_RETURN');
  assert.deepEqual(input.details.lines,receiptLines);
});

test('unknown third-party TIN cannot be turned into an authorization', () => {
  const sessionId='00000000-0000-4000-8000-000000000001';
  const input: StoryPaymentInput={
    idempotencyKey:'00000000-0000-4000-8000-000000000003',
    sessionId,service:'TAX_WITH_RETURN',amountMinor:100,
    details:{
      payerMode:'OTHER',taxpayerTin:'invalid',
      lines:[{headId:1,totalAmount:1}],receiptSnapshot:{taxpayerTin:'invalid'}
    }
  };
  assert.throws(()=>bindPreviewStoryPayer(input,{profileId:'user1',paymentSessionId:sessionId}),
    /Choose a saved demo beneficiary/);
});
