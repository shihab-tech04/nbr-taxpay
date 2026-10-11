import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCorrectionInquiry} from '../src/services/correctionInquiryValidation.ts';

const valid={originalReference:'TPAY-REF-123456',reason:'The draft reference needs review due to the discrepancy.',desiredOutcome:'Please explain whether this reference can be corrected.'};
test('COR-001 accepts only an unverified private inquiry',()=>{
 const r=validateCorrectionInquiry(valid);
 assert.equal(r.allowedToRecordInquiry,true);
 assert.equal(r.error,null);
 assert.equal(r.verifiedClaimant,false);
 assert.equal(r.verifiedOriginalReceipt,false);
 assert.equal(r.authorizesFinancialCorrection,false);
});
test('COR-001 rejects missing or invalid source reference without financial effect',()=>{
 for(const x of ['', 'x','other @ personal','/' ,'aaaa'.repeat(30)]) {
  const r=validateCorrectionInquiry({...valid,originalReference:x});
  assert.equal(r.allowedToRecordInquiry,false);
  assert.equal(r.authorizesFinancialCorrection,false);
 }
});
test('COR-001 rejects empty, short, oversized reason/outcome',()=>{
 for(const x of ['', 'too short','x'.repeat(1001)])
  assert.equal(validateCorrectionInquiry({...valid,reason:x}).allowedToRecordInquiry,false);
 for(const x of ['', 'short', 'x'.repeat(601)])
  assert.equal(validateCorrectionInquiry({...valid,desiredOutcome:x}).allowedToRecordInquiry,false);
});
test('COR-001 never infers claimant or real receipt ownership from user-supplied text',()=>{
 for(const x of ['RECEIPT1234','0000000000','TPAY-REF-123456']) {
  const r=validateCorrectionInquiry({...valid,originalReference:x});
  assert.equal(r.verifiedClaimant,false);
  assert.equal(r.verifiedOriginalReceipt,false);
 }
});

test('COR-002 accepts only a structured, unequal, unverified before-and-after proposal',()=>{
 const input={...valid,change:{field:'ASSESSMENT_YEAR' as const,previousValue:'2024-25',proposedValue:'2025-26'}};
 const result=validateCorrectionInquiry(input);
 assert.equal(result.allowedToRecordInquiry,true);
 assert.equal(result.authorizesFinancialCorrection,false);
 assert.equal(result.verifiedOriginalReceipt,false);
});
test('COR-002 rejects identical, unsupported and oversized attribution proposals',()=>{
 const same={...valid,change:{field:'CIRCLE' as const,previousValue:'Circle 1',proposedValue:'circle 1'}};
 assert.equal(validateCorrectionInquiry(same).allowedToRecordInquiry,false);
 const invalid={...valid,change:{field:'REFUND' as any,previousValue:'Old',proposedValue:'New'}};
 assert.equal(validateCorrectionInquiry(invalid).allowedToRecordInquiry,false);
 const tooLong={...valid,change:{field:'PAYMENT_HEAD' as const,previousValue:'x'.repeat(121),proposedValue:'New'}};
 assert.equal(validateCorrectionInquiry(tooLong).allowedToRecordInquiry,false);
 const noValue={...valid,change:{field:'ATTRIBUTION' as const,previousValue:'',proposedValue:'New'}};
 assert.equal(validateCorrectionInquiry(noValue).allowedToRecordInquiry,false);
});
