import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePaymentPrefill} from '../src/services/paymentPrefill';
test('valid selected payment keeps only selected category, year and amount',()=>{
  assert.deepEqual(parsePaymentPrefill({initialCategory:'TAX_WITH_RETURN',initialAssessmentYear:'2025-2026',initialAmount:25000}),{
    category:'TAX_WITH_RETURN',assessmentYear:'2025-26',amount:'25000.00'
  });
});
test('unknown payment categories cannot forge a suggested payment',()=>{
  assert.equal(parsePaymentPrefill({initialCategory:'UNVERIFIED'}),null);
});
test('malformed years and amounts default to editable non-authoritative form values',()=>{
  assert.deepEqual(parsePaymentPrefill({initialCategory:'ASSESSED_DEMAND',initialAssessmentYear:'2025-2039',initialAmount:'-10'}),{
    category:'ASSESSED_DEMAND',assessmentYear:'2026-27',amount:'100.00'
  });
  assert.equal(parsePaymentPrefill({initialCategory:'PENALTY',initialAmount:'0.01'})?.amount,'0.01');
  assert.equal(parsePaymentPrefill({initialCategory:'PENALTY',initialAmount:'999999999999'})?.amount,'100.00');
});
