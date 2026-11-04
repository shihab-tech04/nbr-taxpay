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
  assert.match(beneficiary,/beneficiary-directory__row/);
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
