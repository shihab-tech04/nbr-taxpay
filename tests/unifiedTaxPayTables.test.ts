import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=(path:string)=>readFileSync(path,'utf8');

test('one shared table stylesheet and React layout primitives own the table visual contract',()=>{
  const css=read('src/styles/taxpay-unified-table.css');
  const component=read('src/components/ui/TaxPayDataTable.tsx');
  const entry=read('src/index.css');
  assert.match(entry, /@import ['"]\.\/styles\/taxpay-unified-table\.css['"]/);
  for(const key of ['--taxpay-table-border','--taxpay-table-heading','--taxpay-table-stripe',
    '--taxpay-table-hover','--taxpay-table-row-height','taxpay-table-toolbar',
    'taxpay-mobile-table-card','taxpay-table-state','prefers-reduced-motion'])
    assert.ok(css.includes(key),key);
  assert.match(component,/variant==='tabular'\?<TaxPayTableViewport/, 'tabular grids must provide the shared desktop overflow viewport');
  assert.match(css,/\.taxpay-mobile-table-cards\[class~="md:hidden"\] \{display:none;\}/,
    "desktop hides mobile cards in citizen and officer shells");
  for(const name of ['TaxPayTablePanel','TaxPayTableToolbar','TaxPayTableViewport',
    'TaxPayMobileTableCards','TaxPayMobileTableCard','TaxPayTableState'])
    assert.ok(component.includes('function '+name),name);
});

test('every record table uses the same presentation contract without deleting its content or actions',()=>{
  const recordScreens=[
    'PaymentHistory','AccountBeneficiaryHistory','EventBasedTaxLedger','TaxpayerDashboard',
    'PaymentSearch','TravelTax','DemoServiceRecordsPanel','AuthenticatedDashboardPosition',
    'User1DemoExperience','AuditTrail','OfflineEvidence','ParityRegisterModal',
  ];
  for(const screen of recordScreens){
    const source=read('src/components/screens/'+screen+'.tsx');
    assert.match(source,/taxpay-unified-table|TaxPayDataGrid/,screen);
    // The column-driven tabular variant owns the viewport centrally.
    assert.match(source,/taxpay-table-viewport|TaxPayTableViewport|<TaxPayDataGrid variant="tabular"/,screen+' needs controlled horizontal scrolling');
  }
  const beneficiary=read('src/components/screens/Beneficiaries.tsx');
  assert.match(beneficiary,/TaxPayTablePanel/);
  assert.match(beneficiary,/beneficiary-directory__filters taxpay-table-filters/);
  assert.match(beneficiary,/taxpay-unified-table w-full text-sm/);
  assert.match(beneficiary,/Pay Tax for Others/);
  assert.match(beneficiary,/Select all/);
  const ledger=read('src/components/screens/EventBasedTaxLedger.tsx');
  assert.match(ledger,/testId="event-ledger-table"/);
  assert.match(ledger,/taxpay-table-tabs/);
});

test('mobile record cards keep the original actions and responsive contract',()=>{
  for(const screen of ['PaymentHistory','AccountBeneficiaryHistory','EventBasedTaxLedger',
    'TaxpayerDashboard','PaymentSearch','DemoServiceRecordsPanel','AuditTrail','OfflineEvidence']){
    const source=read('src/components/screens/'+screen+'.tsx');
    assert.match(source,/taxpay-mobile-table-card|TaxPayMobileTableCard|renderMobileCard=/,screen);
    assert.match(source,/md:hidden|renderMobileCard=/,screen);
  }
  const beneficiary=read('src/components/screens/Beneficiaries.tsx');
  assert.match(beneficiary,/beneficiary-directory__tabular-row/);
  assert.match(beneficiary,/renderMobileCard=\{person=>/);
  assert.match(beneficiary,/beneficiary-directory__actions/);
  const payment=read('src/components/screens/AccountBeneficiaryHistory.tsx');
  assert.match(payment,/getAccountStoryPayments/);
  assert.match(payment,/ReceiptView/);
});

test('official receipt and certificate print tables remain outside generic table redesign',()=>{
  for(const path of ['src/components/common/ReceiptView.tsx','src/components/screens/CertificatesView.tsx']){
    const source=read(path);
    assert.match(source,/receipt-view__financial-table/);
    assert.doesNotMatch(source,/taxpay-unified-table/);
  }
});

test('ledger, Activity and Beneficiaries share one column-driven data renderer with preserved actions',()=>{
  const component=read('src/components/ui/TaxPayDataTable.tsx');
  assert.ok(component.includes('export function TaxPayDataGrid<Row>'));
  assert.ok(component.includes('columns.map(column=>'));
  assert.ok(component.includes('rows.map(row=>'));
  for(const screen of ['EventBasedTaxLedger','User1DemoExperience','Beneficiaries']){
    const source=read('src/components/screens/'+screen+'.tsx');
    assert.ok(source.includes('<TaxPayDataGrid'),screen);
    assert.ok(source.includes('columns={['),screen);
    assert.ok(source.includes('getRowKey='),screen);
  }
  const beneficiaries=read('src/components/screens/Beneficiaries.tsx');
  for(const action of ['payWith([person])','openPersonEditor(person)','setDeletePerson(person)'])assert.ok(beneficiaries.includes(action),action);
  assert.ok(read('src/components/screens/EventBasedTaxLedger.tsx').includes('renderMobileCard='));
});

test('actual signed-in payment paths use shared semantic desktop tables and complete mobile field cards',()=>{
 const switcher=read('src/components/screens/AuthenticatedHistorySwitch.tsx');
 const history=read('src/components/screens/AccountReviewHistory.tsx');
 const activity=read('src/components/screens/DemoPaymentActivity.tsx');
 const shared=read('src/components/ui/TaxPayDataTable.tsx');
 const css=read('src/styles/taxpay-unified-table.css');
 assert.match(switcher,/AccountReviewHistory/);
 assert.match(switcher,/DemoPaymentActivity/);
 for(const [name,source] of [['owner',history],['linked',activity]] as const){
   assert.match(source,/<TaxPayDataGrid variant="tabular"/,name);
   assert.match(source,/TaxPayTableControls/,name);
   assert.match(source,/TaxPayTableCounter/,name);
   assert.match(source,/mobileTestId=/,name);
   assert.match(source,/getRowKey=/,name);
   assert.match(source,/type="search"/,name);
 }
 assert.match(activity,/onClick=\{\(\)=>setSelectedPayment\(tx\)\}/);
 assert.match(activity,/tx\.allocations\.map/);
 assert.match(activity,/tx\.events\.map/);
 assert.match(history,/\.eq\('owner_uid',ownerUid\)/);
 assert.match(history,/formattedReviewAmount\(row\.amount_minor,language\)/);
 assert.match(shared,/renderMobileCard \? renderMobileCard\(row\) : <dl/);
 assert.match(css,/\.taxpay-mobile-table-card__field dd/);
});


test('Convay shared structure keeps semantic record rows, mobile views, controlled page navigation and all table states',()=>{
  const source=read('src/components/ui/TaxPayDataTable.tsx');
  const css=read('src/styles/taxpay-unified-table.css');
  assert.match(source,/role="table"/);
  assert.match(source,/role="columnheader"/);
  assert.match(source,/role="row" data-selected=/);
  assert.match(source,/role="cell"/);
  assert.match(source,/export function TaxPayTablePagination/);
  assert.match(source,/onPageChange\(current[+-]1\)/);
  assert.match(source,/rows\.length===0&&emptyLabel/);
  assert.match(source,/loading\?<TaxPayTableState/);
  assert.match(source,/error\?<TaxPayTableState/);
  assert.match(css,/\.taxpay-table-pagination__controls/);
  assert.match(css,/\.taxpay-record-list__cell/);
  assert.match(read('src/components/screens/User1DemoExperience.tsx'),/pagination=\{\{page:currentHistoryPage/);
});


test('every signed-in payment history uses visible Convay column hierarchy, not only user1',()=>{
 const story=read('src/components/screens/User1DemoExperience.tsx');
 const bound=read('src/components/screens/DemoPaymentActivity.tsx');
 const review=read('src/components/screens/AccountReviewHistory.tsx');
 const css=read('src/styles/taxpay-unified-table.css');
 assert.match(story,/className="taxpayer-transaction-table(?: [^"]+)?"/);
 assert.match(bound,/className="taxpay-convay-signed-in-table"/);
 assert.match(review,/className="taxpay-convay-signed-in-table"/);
 for(const key of ['reference','date','payer','allocation','amount','status','actions']){
   assert.ok(bound.includes("{key:'"+key+"'"),'Missing bound transaction column '+key);
 }
 assert.match(bound,/renderMobileCard=\{tx=>/);
 assert.match(bound,/tx\.allocations\.map/);
 assert.match(bound,/setSelectedPayment\(tx\)/);
 assert.match(css,/table\.taxpay-convay-signed-in-table thead th/);
 assert.match(css,/table\.taxpay-convay-signed-in-table tbody td/);
 assert.match(css,/table\.taxpay-convay-signed-in-table tbody tr:nth-child\(even\)/);
});

test('draft workspace follows the Korbritto blue type scale instead of legacy green/serif styling',()=>{
  const src=read('src/components/screens/SecureWorkspace.tsx');
  assert.doesNotMatch(src,/emerald|font-serif-fraunces/);
  assert.match(src,/bg-taxpay-primary/);
  assert.match(src,/text-taxpay-text/);
  assert.doesNotMatch(src,/text-xs/);
});

test('shared table feedback is subtle and disabled for reduced-motion preferences',()=>{
  const css=read('src/styles/taxpay-unified-table.css');
  assert.match(css,/Shared record-table motion/);
  assert.match(css,/\.taxpay-table-pagination__button/);
  assert.match(css,/\.taxpay-mobile-table-card:focus-within/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.taxpay-table-pagination__button[\s\S]*?transition: none/);
});
