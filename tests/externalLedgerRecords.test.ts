import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {
  EXTERNAL_LEDGER_SOURCES,escapeLedgerCsvCell,projectExternalLedgerEvents,
  type ExternalCreditPosting,type ExternalPaymentRecord
} from '../src/services/externalLedgerRecords';

const owner='00000000-0000-4000-8000-000000000111';
const base:ExternalPaymentRecord={
  id:'payment-1',owner_uid:owner,source_system:'BRTA',
  source_transaction_id:'BRTA-transaction-1',source_allocation_id:'line-1',
  taxpayer_tin:'100000000001',payer_tin:null,identity_binding_evidence_ref:'verified-binding-1',
  source_reference:'BRTA-reference-1',
  challan_no:'CH-1',dhara:'Section supplied by source',assessment_year:'2026-27',
  tax_head:'Source-tax head',amount_minor:'12501',source_status:'RECORDED_AT_SOURCE',
  occurred_at:'2026-11-15T05:00:00Z',source_evidence_ref:'BRTA-import-evidence-1'
};
const credit:ExternalCreditPosting={
  id:'credit-1',payment_record_id:'payment-1',owner_uid:owner,
  official_credit_reference:'OFFICIAL-CREDIT-1',official_credit_source:'Official tax ledger',
  credited_amount_minor:'5001',credited_at:'2026-11-16T05:00:00Z',
  verification_evidence_ref:'official-posting-proof-1'
};

test('all seven external sources preserve provider, Dhara and year; recorded payments are not credits',()=>{
  const payments=Object.keys(EXTERNAL_LEDGER_SOURCES).map((source_system,i)=>({
    ...base,id:'payment-'+(i+1),source_system,source_transaction_id:'provider-tx-'+(i+1),
    source_allocation_id:'provider-line-'+(i+1),
    source_reference:'provider-ref-'+(i+1),dhara:'Dhara-'+(i+1),
    assessment_year:i%2?'2025-26':'2026-27',
    amount_minor:i%2?10001:'12501'
  }));
  const events=projectExternalLedgerEvents(owner,payments,[],'en');
  assert.equal(events.length,7);
  assert.deepEqual(new Set(events.map(e=>e.source)),new Set(Object.values(EXTERNAL_LEDGER_SOURCES)));
  assert.equal(events.every(e=>e.code==='EXTERNAL_PAYMENT_RECORDED'&&e.effectMinor===null&&
    e.balanceAfterMinor===null&&e.creditEvidenceStatus==='RECORDED_ONLY'),true);
  payments.forEach(p=>{
    const event=events.find(e=>e.sourceCode===p.source_system);
    assert.equal(event?.dhara,p.dhara);
    assert.equal(event?.assessmentYear,p.assessment_year);
    assert.equal(event?.amountMinor,Number(p.amount_minor));
    assert.equal(event?.challanNo,p.challan_no);
  });
});

test('official credit requires a separate posting with independent evidence',()=>{
  const events=projectExternalLedgerEvents(owner,[base],[credit],'en');
  assert.equal(events.length,2);
  assert.equal(events.find(e=>e.code==='EXTERNAL_PAYMENT_RECORDED')?.effectMinor,null);
  const official=events.find(e=>e.code==='EXTERNAL_OFFICIAL_TAX_CREDIT');
  assert.equal(official?.effectMinor,-5001);
  assert.equal(official?.source,'BRTA');
  assert.equal(official?.dhara,base.dhara);
  assert.equal(official?.reference,credit.official_credit_reference);
  assert.equal(official?.creditEvidenceStatus,'OFFICIAL_POSTING');
  assert.equal(official?.balanceAfterMinor,null);
  assert.equal(projectExternalLedgerEvents(owner,[{...base,source_status:'PAID'}],[],'en')[0].effectMinor,null);
});

test('partial postings cannot exceed the original source amount',()=>{
  const partial={...credit,credited_amount_minor:7000};
  const another={...credit,id:'credit-2',official_credit_reference:'OFFICIAL-CREDIT-2',
    credited_amount_minor:6000};
  assert.throws(()=>projectExternalLedgerEvents(owner,[base],[partial,another],'en'),/exceeds/);
  assert.equal(projectExternalLedgerEvents(owner,[base],[credit], 'bn')[0].code,'EXTERNAL_OFFICIAL_TAX_CREDIT');
});

test('source owner and official posting integrity fail closed',()=>{
  assert.throws(()=>projectExternalLedgerEvents(owner,[{...base,owner_uid:'outsider'}],[],'en'),/Unreconciled/);
  assert.throws(()=>projectExternalLedgerEvents(owner,[{...base,source_system:'UNKNOWN'}],[],'en'),/Unknown external/);
  assert.throws(()=>projectExternalLedgerEvents(owner,[base,{...base}],[],'en'),/Unreconciled/);
  assert.throws(()=>projectExternalLedgerEvents(owner,[base],[{...credit,owner_uid:'outsider'}],'en'),/Unreconciled/);
  assert.throws(()=>projectExternalLedgerEvents(owner,[base],[{...credit,payment_record_id:'missing'}],'en'),/Unmatched/);
  assert.throws(()=>projectExternalLedgerEvents(owner,[base],[{...credit,verification_evidence_ref:''}],'en'),/Unreconciled/);
  assert.throws(()=>projectExternalLedgerEvents(owner,[{...base,amount_minor:'9007199254740993'}],[],'en'),/Invalid external ledger amount/);
});

test('SQL contract is private, explicitly read-only for taxpayers, and separates evidence',()=>{
  const sql=readFileSync('supabase/migrations/20261116040500_taxpay_external_ledger_sources.sql','utf8');
  for(const source of Object.keys(EXTERNAL_LEDGER_SOURCES))assert.ok(sql.includes("'"+source+"'"));
  assert.match(sql,/create table public\.taxpay_external_payment_records/);
  assert.match(sql,/create table public\.taxpay_external_credit_postings/);
  assert.match(sql,/grant select on public\.taxpay_external_payment_records to authenticated/);
  assert.match(sql,/grant select on public\.taxpay_external_credit_postings to authenticated/);
  assert.match(sql,/revoke all on public\.taxpay_external_payment_records from public,anon,authenticated,service_role/);
  assert.match(sql,/owner_uid=\(select auth\.uid\(\)\)/);
  assert.doesNotMatch(sql,/grant (insert|update|delete).*to authenticated/i);
});

test('ledger CSV exports neutralize untrusted provider formulas but preserve exact financial numbers',()=>{
  assert.equal(escapeLedgerCsvCell('=HYPERLINK("bad","open")'),'"\'=HYPERLINK(""bad"",""open"")"');
  assert.equal(escapeLedgerCsvCell('  +SUM(1,2)'),'"\'  +SUM(1,2)"');
  assert.equal(escapeLedgerCsvCell('\t@SUM(1,2)'),'"\'\t@SUM(1,2)"');
  assert.equal(escapeLedgerCsvCell('-financial-reference'),'"\'-financial-reference"');
  assert.equal(escapeLedgerCsvCell('safe-"reference"'),'"safe-""reference"""');
  assert.equal(escapeLedgerCsvCell(-5001),'"-5001"');
  assert.equal(escapeLedgerCsvCell(12501),'"12501"');
  assert.equal(escapeLedgerCsvCell(null),'""');
});


test('provider line cannot be replayed through a second source-row ID',()=>{
  assert.throws(()=>projectExternalLedgerEvents(owner,[base,{...base,id:'second-source-id'}],[],'en'),/Duplicate external source allocation/);
  const second={...base,id:'distinct-line',source_allocation_id:'line-2'};
  assert.equal(projectExternalLedgerEvents(owner,[base,second],[],'en').length,2);
});

test('official posting references are unique per allocation, but may split across distinct lines',()=>{
  const second={...base,id:'payment-2',source_allocation_id:'line-2'};
  const split={...credit,id:'credit-2',payment_record_id:'payment-2'};
  const events=projectExternalLedgerEvents(owner,[base,second],[credit,split],'en');
  assert.equal(events.filter(e=>e.code==='EXTERNAL_OFFICIAL_TAX_CREDIT').length,2);
  assert.throws(()=>projectExternalLedgerEvents(owner,[base],[credit,{...credit,id:'new-credit-id',credited_amount_minor:1000}],'en'),/Duplicate official credit posting/);
});


test('database strengthens global provider allocation identity while supporting shared credit references across distinct rows',()=>{
  const sql=readFileSync('supabase/migrations/20261116054000_external_ledger_source_credit_idempotency.sql','utf8');
  assert.match(sql,/unique index if not exists taxpay_external_source_allocation_unique/);
  assert.match(sql,/\(source_system,source_transaction_id,source_allocation_id\)/);
  assert.match(sql,/unique index if not exists taxpay_external_credit_allocation_ref_unique/);
  assert.match(sql,/\(payment_record_id,official_credit_source,official_credit_reference\)/);
  assert.doesNotMatch(sql,/drop table|truncate|delete from|drop policy|disable row level security/i);
});
