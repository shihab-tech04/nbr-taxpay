import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=(screen:string)=>readFileSync('src/components/screens/'+screen+'.tsx','utf8');

test('dashboard, service activity and offline evidence use one column-driven record source',()=>{
  for(const screen of ['TaxpayerDashboard','DemoServiceRecordsPanel','OfflineEvidence']){
    const source=read(screen);
    assert.match(source, /<TaxPayDataGrid variant="tabular" rows=/,screen);
    assert.match(source, /renderMobileCard=/,screen+' must preserve mobile record representation');
    assert.doesNotMatch(source, /<TaxPayUnifiedTable/,screen+' must not also render a separate desktop table');
    assert.match(source, /getRowKey=/,screen+' must preserve stable row identity');
  }
});

test('dashboard still filters records, caps the summary, and opens receipt details',()=>{
  const source=read('TaxpayerDashboard');
  assert.match(source,/rows=\{records\.slice\(0,10\)\}/);
  assert.match(source,/value=\{query\} onChange=/);
  assert.match(source,/selectReceipt\(r\.id\)/);
  assert.match(source,/mobileTestId="taxpayer-dashboard-mobile-records"/);
  assert.match(source,/Treasury status not verified/);
});

test('service records retain owner-provided values, record inspection and language',()=>{
  const source=read('DemoServiceRecordsPanel');
  for(const item of ['record.recordId','record.assessmentYear','record.relatedUserId',
    'amount(record.amountMinor,locale)','renderState(record)','renderDate(record.recordedAt)',
    'setSelectedRecordId(record.recordId)'])
    assert.ok(source.includes(item),item);
  assert.match(source,/ariaLabel=\{tr\('Service records'/);
});

test('offline evidence retains exact audit state and amounts without altering its form',()=>{
  const source=read('OfflineEvidence');
  assert.match(source,/mobileTestId="offline-evidence-mobile-cards"/);
  assert.match(source,/formatCurrency\(item.amount,language\)/);
  assert.match(source,/item.status==='VERIFIED_SCROLLED'/);
  assert.match(source,/Verify & Sync with Ledger/);
});


test('Track payment is exclusively a lookup and never mounts the dashboard service register',()=>{
  const source=read('User1DemoExperience');
  assert.match(source,/\{overviewRoute&&<DemoServiceRecordsPanel/);
  assert.doesNotMatch(source,/\{route==='history'&&<DemoServiceRecordsPanel/);
  assert.match(source,/data-testid="track-payment-history-link"/);
  assert.match(source,/actions=\{!trackingActivity &&/);
});

test('service records use the shared Board-inspired toolbar and interactive grid contract',()=>{
  const screen=read('DemoServiceRecordsPanel');
  const table=readFileSync('src/components/ui/TaxPayDataTable.tsx','utf8');
  assert.match(screen,/toolbar=\{\{/);
  assert.match(screen,/onViewRow=\{record=>setSelectedRecordId\(record\.recordId\)\}/);
  assert.match(screen,/onSearchChange:setRecordSearch/);
  assert.match(screen,/Filter record status/);
  assert.match(screen,/Sort service records/);
  assert.match(screen,/emptyLabel=/);
  assert.match(table,/export function TaxPayRecordToolbar/);
  assert.match(table,/onKeyDown=\{onViewRow/);
  assert.match(table,/taxpay-mobile-table-cards/);
  assert.match(table,/onRetry/);
});
