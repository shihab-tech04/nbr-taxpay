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
    assert.match(source,/taxpay-unified-table/,screen);
    assert.match(source,/taxpay-table-viewport|TaxPayTableViewport/,screen+' needs controlled horizontal scrolling');
  }
  const beneficiary=read('src/components/screens/Beneficiaries.tsx');
  assert.match(beneficiary,/TaxPayTablePanel/);
  assert.match(beneficiary,/beneficiary-directory__filters taxpay-table-filters/);
  assert.match(beneficiary,/taxpay-unified-table w-full text-sm/);
  assert.match(beneficiary,/Pay Tax for Others/);
  assert.match(beneficiary,/Select all/);
  const ledger=read('src/components/screens/EventBasedTaxLedger.tsx');
  assert.match(ledger,/data-testid="event-ledger-table"/);
  assert.match(ledger,/taxpay-table-tabs/);
});

test('mobile record cards keep the original actions and responsive contract',()=>{
  for(const screen of ['PaymentHistory','AccountBeneficiaryHistory','EventBasedTaxLedger',
    'TaxpayerDashboard','PaymentSearch','DemoServiceRecordsPanel','AuditTrail','OfflineEvidence']){
    const source=read('src/components/screens/'+screen+'.tsx');
    assert.match(source,/taxpay-mobile-table-card|TaxPayMobileTableCard/,screen);
    assert.match(source,/md:hidden/,screen);
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
