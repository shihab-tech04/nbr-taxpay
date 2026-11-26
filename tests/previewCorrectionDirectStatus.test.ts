import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewCorrectionStatus, correctionNoticeTitle, validateAppliedPreviewCorrection} from '../src/services/previewCorrections';

test('direct Super Admin result is localized only after Office acknowledgement',()=>{
  assert.equal(previewCorrectionStatus({officeSyncState:'ACKNOWLEDGED',reviewState:'APPROVED'},'en'),'Approved');
  assert.equal(previewCorrectionStatus({officeSyncState:'ACKNOWLEDGED',reviewState:'APPROVED'},'bn'),'অনুমোদিত');
  assert.equal(previewCorrectionStatus({officeSyncState:'PENDING',reviewState:'APPROVED'},'en'),'Awaiting Office');
  assert.equal(previewCorrectionStatus({officeSyncState:'ACKNOWLEDGED',reviewState:'REJECTED'},'en'),'Rejected');
  assert.equal(previewCorrectionStatus({officeSyncState:'ACKNOWLEDGED',reviewState:'APPROVER_CLOSED'},'en'),'Closed');
});
test('direct approval notice is localized without rewriting historical events',()=>{
  assert.equal(correctionNoticeTitle('APPROVED','en'),'Correction approved');
  assert.equal(correctionNoticeTitle('APPROVED','bn'),'সংশোধনের আবেদন অনুমোদিত');
  assert.equal(correctionNoticeTitle('REPORT_APPROVED','en'),'Payment report approved');
  assert.equal(correctionNoticeTitle('APPROVER_CLOSED','en'),'Correction review closed');
});

test('only acknowledged approved ordinary correction can expose exact source applied values',()=>{
 const applied={paymentId:'80000000-0000-4000-8000-000000000041',allocationIndex:0,allocationId:'line-1',
  assessmentYear:'2026-2027',circle:'Circle B',headCode:'HEAD-B',sourceProject:'v2',
  decisionMessageId:'90000000-0000-4000-8000-000000000024'};
 const row={caseKind:'CORRECTION_REVIEW',reviewState:'APPROVED',officeSyncState:'ACKNOWLEDGED',
  paymentId:applied.paymentId,allocationIndex:0,allocationId:'line-1',proposedAY:'2026-2027',
  proposedCircle:'Circle B',proposedHeadCode:'HEAD-B',appliedCorrection:applied};
 assert.deepEqual(validateAppliedPreviewCorrection(row),applied);
 assert.equal(validateAppliedPreviewCorrection({...row,appliedCorrection:null}),null);
 for(const patch of [{caseKind:'UNSOLICITED_PAYMENT_REPORT'},{reviewState:'REJECTED'},
   {officeSyncState:'PENDING'},{allocationId:'other-line'},{proposedAY:'2025-2026'}]){
   assert.throws(()=>validateAppliedPreviewCorrection({...row,...patch}),/Invalid applied correction/);
 }
 assert.throws(()=>validateAppliedPreviewCorrection({...row,appliedCorrection:{...applied,sourceProject:'unknown'}}),/Invalid applied correction/);
});
