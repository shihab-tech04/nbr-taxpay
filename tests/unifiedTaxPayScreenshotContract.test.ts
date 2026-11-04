import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const source=(file:string)=>readFileSync(file,'utf8');
test('screenshots: ledger, transactions and beneficiaries use shared table components',()=>{
 const shared=source('src/components/ui/TaxPayDataTable.tsx');
 assert.match(shared,/function TaxPayUnifiedTable/);
 assert.match(shared,/function TaxPayRecordList/);
 assert.match(shared,/function TaxPayDataGrid/);
 const ledger=source('src/components/screens/EventBasedTaxLedger.tsx');
 const activity=source('src/components/screens/User1DemoExperience.tsx');
 const beneficiaries=source('src/components/screens/Beneficiaries.tsx');
 assert.match(ledger,/<TaxPayDataGrid variant="ledger"/);
 assert.ok(ledger.includes('testId="event-ledger-table"'));
 assert.match(activity,/<TaxPayDataGrid variant="payments"/);
 assert.match(beneficiaries,/<TaxPayDataGrid variant="beneficiaries"/);
 assert.match(activity,/setSelected\(item\)/);
 assert.match(beneficiaries,/openPersonEditor\(person\)/);
 assert.match(beneficiaries,/payWith\(\[person\]\)/);
 assert.match(beneficiaries,/setDeletePerson\(person\)/);
 assert.match(beneficiaries,/selectedIds\.includes\(person\.id\)/);
});
test('desktop table markup is semantic, and all existing record tables use the same component',()=>{
 const names=["AccountBeneficiaryHistory","AuditTrail","AuthenticatedDashboardPosition","Beneficiaries","DemoServiceRecordsPanel","EventBasedTaxLedger","OfflineEvidence","ParityRegisterModal","PaymentHistory","PaymentSearch","TaxpayerDashboard","TravelTax","User1DemoExperience"];
 for(const name of names){
  const s=source('src/components/screens/'+name+'.tsx');
  assert.doesNotMatch(s,/<table\\b[^>]*taxpay-unified-table/);
  if(["EventBasedTaxLedger","PaymentHistory","AccountBeneficiaryHistory","PaymentSearch","AuditTrail","Beneficiaries","User1DemoExperience","DemoServiceRecordsPanel","OfflineEvidence","TaxpayerDashboard"].includes(name))
    assert.match(s,/<TaxPayDataGrid/,name+" should define columns through the shared data grid");
  else assert.match(s,/<TaxPayUnifiedTable/);
 }
});
test('one stylesheet owns density, columns, zebra rows and mobile card breakpoint',()=>{
 const css=source('src/styles/taxpay-unified-table.css');
 for(const key of ['taxpay-record-list__columns','taxpay-record-list__row','data-record-layout="payments"','data-record-layout="beneficiaries"','max-width:800px','taxpay-table-header-height'])assert.ok(css.includes(key),key);
});
