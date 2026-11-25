import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

test('browser session notifications use one shared semantic responsive register',()=>{
 const src=readFileSync('src/components/screens/SessionPaymentNotifications.tsx','utf8');
 assert.match(src,/TaxPayDataGrid variant="tabular"/);
 assert.match(src,/testId="session-payment-table"/);
 assert.match(src,/mobileTestId="session-payment-cards"/);
 assert.match(src,/renderMobileCard=/);
 assert.match(src,/rows=\{filtered\}/);
 assert.match(src,/getRowKey=\{notice=>String\(notice.id\)\}/);
 assert.match(src,/type="search"/);
 assert.match(src,/onClick=\{\(\)=>setSearch\(''\)\}/);
 assert.match(src,/reconcileStoryPaymentNotices\(events, payments\)/);
 assert.match(src,/getStoryNotices\(\)/);
 assert.match(src,/getStorySessionPayments\(\)/);
 assert.match(src,/Settlement and tax credit are not confirmed/);
 assert.doesNotMatch(src,/<ul className="divide-y divide-taxpay-border"/);
});

test('preview correction request history keeps existing form and records but uses a unified table',()=>{
 const src=readFileSync('src/components/screens/CorrectionRequests.tsx','utf8');
 assert.match(src,/data-testid="preview-correction-register"/);
 assert.match(src,/TaxPayDataGrid variant="tabular"/);
 assert.match(src,/testId="preview-correction-table"/);
 assert.match(src,/mobileTestId="preview-correction-cards"/);
 assert.match(src,/value=\{caseSearch\}/);
 assert.match(src,/renderMobileCard=/);
 assert.match(src,/localCorrections = corrections\.filter\(c=>visibleReceipts\.some/);
 assert.match(src,/visibleCorrections:[^\n]+=serverMode/);
 assert.match(src,/\?\(historyOwner===ownerKey\?serverRecords:\[\]\)\.map/);
 assert.match(src,/:localCorrections;/);
 assert.match(src,/listPreviewCorrections\(\)/);
 assert.match(src,/await submitPreviewCorrection\(/);
 assert.match(src,/setServerRecords\(rows=>\[saved,/);
 assert.match(src,/addCorrectionRequest\(/);
 assert.match(src,/c\.approverRemarks/);
 assert.match(src,/c\.currentCircle/);
 assert.match(src,/c\.proposedCircle/);
 assert.match(src,/c\.workflowStage/);
 assert.doesNotMatch(src,/\{visibleCorrections\.map\(/);
});


test('contextual correction form uses shared footer, while the account register reads authoritative history',()=>{
 const src=readFileSync('src/components/screens/CorrectionRequests.tsx','utf8');
 const workspace=readFileSync('src/components/screens/User1DemoExperience.tsx','utf8');
 assert.match(src,/createPortal\(saveAction,footerTarget\)/);
 assert.match(src,/<UiButton type="submit" form=\{formId\} variant="primary"/);
 assert.match(src,/!embedded&&<section className="taxpayer-records-panel/);
 assert.match(src,/taxpay:preview-corrections-changed/);
 assert.doesNotMatch(src,/text-amber-300/);
 assert.match(workspace,/footer=\{<><\/>\}\s+className="taxpayer-correction-modal"/);
 assert.match(workspace,/<CorrectionRequests historyOnly=/);
});
