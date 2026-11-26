import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewCorrectionStatus, correctionNoticeTitle} from '../src/services/previewCorrections';

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
