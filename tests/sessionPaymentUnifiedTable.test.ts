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
 assert.match(src,/visibleCorrections = corrections\.filter/);
 assert.match(src,/addCorrectionRequest\(/);
 assert.match(src,/c\.approverRemarks/);
 assert.match(src,/c\.currentCircle/);
 assert.match(src,/c\.proposedCircle/);
 assert.match(src,/c\.workflowStage/);
 assert.doesNotMatch(src,/\{visibleCorrections\.map\(/);
});
