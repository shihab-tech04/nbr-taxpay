import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAccountBeneficiaryHistoryCsv} from '../src/services/accountBeneficiaryHistoryCsv';
import type {BeneficiaryPaymentEntry} from '../src/services/story1AccountPaymentHistory';

function entry(overrides:Partial<BeneficiaryPaymentEntry>={}):BeneficiaryPaymentEntry{
  return {
    key:'payment-1:line-1',paymentId:'payment-1',beneficiaryName:'Beneficiary A',taxpayerTin:'012345678901',
    assessmentYear:'2026-27',paymentHead:'Advance tax',amountMinor:1500,batchId:'combined-1',
    receipt:{createdAt:'2026-10-25T12:00:00.000Z',tokenNumber:'must-not-export'} as BeneficiaryPaymentEntry['receipt'],
    ...overrides
  } as BeneficiaryPaymentEntry;
}

test('history CSV contains only the supplied filtered allocation rows and exact identifiers and amount',()=>{
  const csv=buildAccountBeneficiaryHistoryCsv([entry()], 'en');
  const rows=csv.replace(/^\uFEFF/,'').split('\r\n');
  assert.equal(rows.length,2);
  assert.equal(rows[0],[
    'Payment date','Beneficiary','TIN','Payment head','Assessment year',
    'Payment reference','Combined reference','Amount ৳'
  ].map(value=>'"'+value+'"').join(','));
  assert.match(rows[1],/"payment-1","combined-1","15\.00"$/);
  assert.match(rows[1],/"012345678901"/);
  assert.equal(csv.includes('must-not-export'),false);
});

test('history CSV localizes headings and neutralizes spreadsheet formulas in text fields',()=>{
  const csv=buildAccountBeneficiaryHistoryCsv([entry({beneficiaryName:'=HYPERLINK("https://example.invalid")'})],'bn');
  assert.ok(csv.startsWith('\uFEFF"পেমেন্টের তারিখ","উপকারভোগী"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.invalid"")"'));
});

test('history CSV fails closed for malformed recipient, reference, timestamp or amount',()=>{
  for(const invalid of [
    entry({taxpayerTin:'typed-tin'}),
    entry({paymentId:' '}),
    entry({receipt:{createdAt:'invalid'} as BeneficiaryPaymentEntry['receipt']}),
    entry({amountMinor:0}),
    entry({amountMinor:Number.MAX_SAFE_INTEGER+1})
  ])assert.throws(()=>buildAccountBeneficiaryHistoryCsv([invalid],'en'));
});
