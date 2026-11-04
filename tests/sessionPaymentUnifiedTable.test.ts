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
